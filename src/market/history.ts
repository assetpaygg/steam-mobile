import { SteamError } from "../core/errors.js";
import type { RawMarketHistoryAsset, RawMarketHistoryResponse } from "../core/types.js";
import { getPriceValueAsInt } from "./prices.js";

// "-" = sale (item left, we were paid), "+" = purchase (e.g. a buy-order fill), else a listing
// created/cancelled event.
export type MarketHistoryEventType = "sale" | "purchase" | "listing_event";

// One rendered /market/myhistory row; field names as SCM-autoseller (CSFloat's extractHistoryEvents)
// uses them. Asset identity is only resolvable on sales/purchases — listing events have no hover data.
export interface MarketHistoryEvent {
  itemName: string;
  gameName: string;
  listedOn: string;
  actedOn: string;
  displayPrice: string;
  priceInCents: number;
  type: MarketHistoryEventType;
  marketName: string | null;
  appID: number | null;
  contextID: string | null;
  assetID: string | null;
  classID: string | null;
  instanceID: string | null;
  unOwnedContextID: string | null;
  unOwnedID: string | null;
}

export interface MarketSale extends MarketHistoryEvent {
  historyId: string;
  listingid: string;
  receivedAmount: number;
}

export interface MarketPurchase extends MarketHistoryEvent {
  historyId: string;
  listingid: string;
  paidAmount: number;
}

export interface MarketListingEvent extends MarketHistoryEvent {
  historyId: string;
  listingid: string;
  eventid: string;
}

export interface MarketHistory {
  sales: MarketSale[];
  purchases: MarketPurchase[];
  listingEvents: MarketListingEvent[];
  totalCount: number | undefined;
}

// Parse the rendered myhistory response. The norender=1 JSON variant is deliberately not used: it
// duplicates listings and misreports purchase amounts, while the rows carry an unambiguous +/-.
export function parseMarketHistory(body: RawMarketHistoryResponse): MarketHistory {
  const history: MarketHistory = {
    sales: [],
    purchases: [],
    listingEvents: [],
    totalCount: body.total_count,
  };
  if (!body.results_html) return history;
  const hovers = body.hovers ?? "";
  const assets = body.assets ?? {};
  const html = body.results_html.replace(/<!--[\s\S]*?-->/g, "");

  for (const row of findByClass(html, "market_listing_row", "market_recent_listing_row")) {
    const dates = findByClass(row.inner, "market_listing_listed_date");
    const itemName = textOf(row.inner, "market_listing_item_name");
    const gameName = textOf(row.inner, "market_listing_game_name");
    const actedOn = dates[0] ? elementText(dates[0]).trim() : "";
    const listedOn = dates[1] ? elementText(dates[1]).trim() : "";
    const displayPrice = textOf(row.inner, "market_listing_price").trim();
    const rowId = attrValue(row.attrs, "id") ?? "";

    const priceInCents = getPriceValueAsInt(displayPrice);
    // A real price string parsing to 0 would silently book free money — fail loud instead.
    if (priceInCents === 0 && displayPrice) {
      throw new SteamError(
        `Market history price parsed to 0 cents for "${displayPrice}" in row ${rowId || "?"}`,
      );
    }

    const gainOrLoss = textOf(row.inner, "market_listing_gainorloss").trim();
    const type: MarketHistoryEventType =
      gainOrLoss === "-" ? "sale" : gainOrLoss === "+" ? "purchase" : "listing_event";

    const idMatch = rowId.match(/^history_row_(\d+)_(\d+)$/);
    if (!idMatch) continue;
    const listingid = idMatch[1]!;
    const eventid = idMatch[2]!;

    const event: MarketHistoryEvent = {
      itemName,
      gameName,
      listedOn,
      actedOn,
      displayPrice,
      priceInCents,
      type,
      marketName: null,
      appID: null,
      contextID: null,
      assetID: null,
      classID: null,
      instanceID: null,
      unOwnedContextID: null,
      unOwnedID: null,
    };
    if (type !== "listing_event") attachAsset(event, rowId, hovers, assets);

    if (type === "sale") {
      history.sales.push({ historyId: rowId, listingid, receivedAmount: priceInCents, ...event });
    } else if (type === "purchase") {
      history.purchases.push({ historyId: rowId, listingid, paidAmount: priceInCents, ...event });
    } else {
      history.listingEvents.push({ historyId: rowId, listingid, eventid, ...event });
    }
  }
  return history;
}

// hovers carries, per row:
//   CreateItemHoverFromContainer( g_rgAssets, '<rowId>_name', appid, 'ctx', 'assetid', 0 );
// Split exactly like the reference; a malformed hover keeps whatever was parsed before it failed.
function attachAsset(
  event: MarketHistoryEvent,
  rowId: string,
  hovers: string,
  assets: Record<string, Record<string, Record<string, RawMarketHistoryAsset>>>,
): void {
  try {
    const args = hovers.split(`${rowId}_name`)[1]!.split(")")[0]!.split(",");
    event.appID = Number.parseInt(args[1]!, 10);
    event.contextID = args[2]!.split("'")[1] ?? null;
    event.assetID = args[3]!.split("'")[1] ?? null;

    if (event.contextID === null || event.assetID === null) return;
    const asset = assets[String(event.appID)]?.[event.contextID]?.[event.assetID];
    if (asset) {
      event.classID = asset.classid ?? null;
      event.instanceID = asset.instanceid ?? null;
      event.unOwnedContextID = asset.unowned_contextid ?? null;
      event.unOwnedID = asset.unowned_id ?? null;
      event.marketName = asset.market_hash_name ?? null;
    }
  } catch {
    // Asset data unavailable — keep the row's basic data.
  }
}

// Minimal cheerio stand-ins over Steam's machine-generated markup (same regex-scrape approach as
// userDetails.ts): `.cls` selection, `.text()`, `.attr()`.

interface HtmlElement {
  attrs: string;
  inner: string;
}

const TAG = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

// Every element whose class list contains all `classes`, in document order (descendants included).
function findByClass(html: string, ...classes: string[]): HtmlElement[] {
  const found: HtmlElement[] = [];
  for (const m of html.matchAll(TAG)) {
    const attrs = m[2] ?? "";
    const tokens = (attrValue(attrs, "class") ?? "").split(/\s+/);
    if (!classes.every((c) => tokens.includes(c))) continue;
    const tag = m[1]!.toLowerCase();
    const start = m.index + m[0].length;
    const empty = VOID_TAGS.has(tag) || attrs.trimEnd().endsWith("/");
    found.push({ attrs, inner: empty ? "" : html.slice(start, closeIndex(html, tag, start)) });
  }
  return found;
}

// Index of the `</tag>` matching an element opened just before `from` (end of input if unclosed).
function closeIndex(html: string, tag: string, from: number): number {
  const re = new RegExp(`<(/?)${tag}\\b((?:"[^"]*"|'[^']*'|[^'">])*)>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) {
      if (--depth === 0) return m.index;
    } else if (!(m[2] ?? "").trimEnd().endsWith("/")) {
      depth++;
    }
  }
  return html.length;
}

function attrValue(attrs: string, name: string): string | undefined {
  const m = attrs.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"),
  );
  const raw = m?.[1] ?? m?.[2] ?? m?.[3];
  return raw === undefined ? undefined : decodeEntities(raw);
}

// cheerio's .text() over a selection: the concatenated text of every match.
function textOf(html: string, className: string): string {
  return findByClass(html, className).map(elementText).join("");
}

function elementText(el: HtmlElement): string {
  return decodeEntities(el.inner.replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, ""));
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code =
        ref[1] === "x" || ref[1] === "X"
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}
