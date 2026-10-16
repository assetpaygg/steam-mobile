import { afterEach, describe, expect, it, vi } from "vitest";
import type { Confirmation, ConfirmationManager } from "../src/community/confirmations.js";
import { EConfirmationType } from "../src/core/enums.js";
import {
  BuyOrderError,
  ConfirmationError,
  ConfirmationOutcomeUnknownError,
  CurrencyMismatchError,
  HttpStatusError,
  MarketBlockedError,
  MarketConfirmationLimitError,
  MarketIneligibleError,
  MarketItemUnavailableError,
  ProxyError,
  RateLimitError,
  SteamError,
  SteamSessionExpiredError,
  ThrottledError,
  WalletBalanceLimitError,
  WalletCurrencyUnknownError,
} from "../src/core/errors.js";
import type { HttpClient, RequestOptions } from "../src/http/HttpClient.js";
import type { ApiCallParams, WebApiClient } from "../src/http/webApi.js";
import { parseMarketHistory, priceTextCurrency } from "../src/market/history.js";
import { MarketNamespace, summarizeOrderbook } from "../src/market/MarketNamespace.js";
import { getPriceValueAsInt } from "../src/market/prices.js";
import type { SessionManager } from "../src/session/SessionManager.js";

interface Reply {
  statusCode?: number;
  body?: unknown;
  headers?: Record<string, string>;
  throws?: unknown;
}

class FakeHttp {
  requests: { method: string; url: string; opts: RequestOptions }[] = [];
  private readonly replies: Reply[] = [];

  reply(...replies: Reply[]): this {
    this.replies.push(...replies);
    return this;
  }
  async get(url: string, opts: RequestOptions = {}) {
    return this.respond("GET", url, opts);
  }
  async post(url: string, opts: RequestOptions = {}) {
    return this.respond("POST", url, opts);
  }
  async getSessionId() {
    return "sess";
  }
  private respond(method: string, url: string, opts: RequestOptions) {
    this.requests.push({ method, url, opts });
    const r = this.replies.shift() ?? {};
    if (r.throws !== undefined) throw r.throws;
    return { statusCode: r.statusCode ?? 200, headers: r.headers ?? {}, body: r.body };
  }
}

class FakeConfirmations {
  // Each getPending() call takes the next entry; the last one repeats.
  pendingSequence: Confirmation[][] = [[]];
  accepted: Pick<Confirmation, "id" | "key">[][] = [];
  rejected: Pick<Confirmation, "id" | "key">[][] = [];
  acceptError: unknown;
  pendingError: unknown;
  pendingCalls = 0;

  set pending(confs: Confirmation[]) {
    this.pendingSequence = [confs];
  }
  async getPending() {
    this.pendingCalls++;
    if (this.pendingError) throw this.pendingError;
    return this.pendingSequence.length > 1
      ? this.pendingSequence.shift()!
      : this.pendingSequence[0]!;
  }
  async acceptConfirmations(confs: Pick<Confirmation, "id" | "key">[]) {
    if (this.acceptError) throw this.acceptError;
    this.accepted.push(confs);
  }
  async rejectConfirmations(confs: Pick<Confirmation, "id" | "key">[]) {
    this.rejected.push(confs);
  }
}

function makeMarket(options: { apiBody?: unknown; currency?: number } = {}) {
  const http = new FakeHttp();
  const confirmations = new FakeConfirmations();
  const apiCalls: ApiCallParams[] = [];
  const api = {
    call: async (params: ApiCallParams) => {
      apiCalls.push(params);
      return options.apiBody ?? {};
    },
  };
  const session = {
    async getAccessToken() {},
    steamID: { getSteamID64: () => OWN_STEAMID },
  } as unknown as SessionManager;
  const market = new MarketNamespace(
    http as unknown as HttpClient,
    session,
    confirmations as unknown as ConfirmationManager,
    api as unknown as WebApiClient,
  );
  if (options.currency !== undefined) market.seedWalletCurrency(options.currency);
  return { market, http, confirmations, apiCalls };
}

const OWN_STEAMID = "76561198000000001";

// A market whose wallet currency is known AND verified by a live wallet read, as before any write.
async function verified(currency: number) {
  const m = makeMarket({ apiBody: { response: { has_wallet: true, currency_code: currency } } });
  await m.market.getWalletDetails();
  m.apiCalls.length = 0;
  return m;
}
const eur = () => verified(3);
const usd = () => verified(1);

function conf(
  id: string,
  type: number,
  sending: string,
  createdAt: number,
  creator = `c${id}`,
): Confirmation {
  return {
    id,
    type,
    creator,
    key: `k${id}`,
    title: "",
    receiving: "",
    sending,
    time: new Date(createdAt * 1000).toISOString(),
    timestamp: new Date(createdAt * 1000),
    icon: "",
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getPriceValueAsInt (Steam's GetPriceValueAsInt)", () => {
  it("parses every Steam price format to integer cents", () => {
    expect(getPriceValueAsInt("2,25€")).toBe(225);
    expect(getPriceValueAsInt("$19.99")).toBe(1999);
    expect(getPriceValueAsInt("1 245,00€")).toBe(124500);
    expect(getPriceValueAsInt("5,--€")).toBe(500);
    expect(getPriceValueAsInt("1.147")).toBe(114700); // thousands heuristic: overprice, never under
    expect(getPriceValueAsInt("1,147.6")).toBe(114760);
    expect(getPriceValueAsInt("0.999")).toBe(99);
    expect(getPriceValueAsInt("")).toBe(0);
    expect(getPriceValueAsInt(undefined)).toBe(0);
    expect(getPriceValueAsInt("abc")).toBe(0);
  });
});

describe("priceTextCurrency", () => {
  it("pins USD and EUR price strings and refuses anything else", () => {
    expect(priceTextCurrency("$19.99")).toBe(1);
    expect(priceTextCurrency("  $1,147.60 ")).toBe(1);
    expect(priceTextCurrency("2,25€")).toBe(3);
    expect(priceTextCurrency("1 245,00€")).toBe(3);
    expect(priceTextCurrency("CDN$ 5.00")).toBeUndefined();
    expect(priceTextCurrency("A$ 5.00")).toBeUndefined();
    expect(priceTextCurrency("R$ 5,00")).toBeUndefined();
    expect(priceTextCurrency("£5.00")).toBeUndefined();
    expect(priceTextCurrency("5,00 pуб.")).toBeUndefined();
    expect(priceTextCurrency("$5 €")).toBeUndefined();
    expect(priceTextCurrency("$U 1.234")).toBeUndefined();
    expect(priceTextCurrency("$1.23 USD")).toBe(1);
    expect(priceTextCurrency("")).toBeUndefined();
  });
});

// Row markup from a real rendered /market/myhistory response (via SCM-autoseller's
// test-history-parser.js); listing/asset ids replaced with synthetic ones.
const SALE_ROW = `<div class="market_listing_row market_recent_listing_row" id="history_row_1001_1002">
\t\t<div class="market_listing_left_cell market_listing_gainorloss">
\t\t-\t</div>
\t<img id="history_row_1001_1002_image" src="https://example.com/img.png" class="market_listing_item_img" alt="" />
\t\t<div class="market_listing_right_cell market_listing_their_price">
\t\t<span class="market_table_value">
\t\t\t<span class="market_listing_price">
\t\t\t\t\t\t\t\t2,25€\t\t\t\t\t\t\t</span>
\t\t\t<br/>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</span>
\t</div>
\t<div class="market_listing_right_cell market_listing_listed_date can_combine">
\t\t31 Jan\t</div>
\t<div class="market_listing_right_cell market_listing_listed_date can_combine">
\t\t29 Jan\t</div>
\t<div class="market_listing_right_cell market_listing_whoactedwith">
\t\t<div class="market_listing_whoactedwith_name_block">
\t\t</div>
\t</div>
\t\t<div class="market_listing_item_name_block">
\t\t<span id="history_row_1001_1002_name" class="market_listing_item_name" style="color: #a7ec2e;">Road Raider Bandana</span>
\t\t<br/>\t\t\t<span class="market_listing_game_name">Rust</span>
\t\t\t\t<div class="market_listing_listed_date_combined">
\t\t\tSold: 29 Jan\t\t</div>
\t</div>
\t<div style="clear: both"></div>
</div>`;

const PURCHASE_ROW = `<div class="market_listing_row market_recent_listing_row" id="history_row_2001_2002">
\t<div class="market_listing_left_cell market_listing_gainorloss">+</div>
\t<span class="market_listing_price">1.147,00&#8364;</span>
\t<div class="market_listing_right_cell market_listing_listed_date can_combine">1 Feb</div>
\t<div class="market_listing_right_cell market_listing_listed_date can_combine">1 Feb</div>
\t<span id="history_row_2001_2002_name" class="market_listing_item_name">Collector&#39;s &amp; Co</span>
\t<span class="market_listing_game_name">Counter-Strike 2</span>
</div>`;

const LISTING_EVENT_ROW = `<div class="market_listing_row market_recent_listing_row" id="history_row_3001_3002">
\t<div class="market_listing_left_cell market_listing_gainorloss">\t</div>
\t<span class="market_listing_price">0,03€</span>
\t<div class="market_listing_right_cell market_listing_listed_date can_combine">2 Feb</div>
\t<span class="market_listing_item_name">Listing Created</span>
</div>`;

const HISTORY_BODY = {
  success: true,
  total_count: 3,
  results_html: SALE_ROW + PURCHASE_ROW + LISTING_EVENT_ROW,
  hovers:
    "\tCreateItemHoverFromContainer( g_rgAssets, 'history_row_1001_1002_name', 252490, '2', '5001', 0 );\n" +
    "\tCreateItemHoverFromContainer( g_rgAssets, 'history_row_1001_1002_image', 252490, '2', '5001', 0 );\n" +
    "\tCreateItemHoverFromContainer( g_rgAssets, 'history_row_2001_2002_name', 730, '2', '6001', 0 );",
  assets: {
    "252490": {
      "2": {
        "5001": {
          classid: "3888092888",
          instanceid: "0",
          market_hash_name: "Road Raider Bandana",
          unowned_contextid: "2",
          unowned_id: "5001",
        },
      },
    },
    "730": { "2": { "6001": { market_hash_name: "AK-47 | Redline (Field-Tested)" } } },
  },
};

describe("parseMarketHistory", () => {
  it("parses a sale with its asset identity from hovers + assets", () => {
    const h = parseMarketHistory(HISTORY_BODY);
    expect(h.totalCount).toBe(3);
    expect(h.sales).toEqual([
      {
        historyId: "history_row_1001_1002",
        listingid: "1001",
        eventid: "1002",
        receivedAmount: 225,
        itemName: "Road Raider Bandana",
        gameName: "Rust",
        listedOn: "29 Jan",
        actedOn: "31 Jan",
        displayPrice: "2,25€",
        priceInCents: 225,
        type: "sale",
        marketName: "Road Raider Bandana",
        appID: 252490,
        contextID: "2",
        assetID: "5001",
        classID: "3888092888",
        instanceID: "0",
        unOwnedContextID: "2",
        unOwnedID: "5001",
      },
    ]);
    expect(h.malformed).toEqual([]);
  });

  it("parses purchases (entities decoded) and listing events (no asset data)", () => {
    const h = parseMarketHistory(HISTORY_BODY);
    const p = h.purchases[0]!;
    expect(p.paidAmount).toBe(114700);
    expect(p.displayPrice).toBe("1.147,00€");
    expect(p.itemName).toBe("Collector's & Co");
    expect(p.marketName).toBe("AK-47 | Redline (Field-Tested)");
    expect(p.appID).toBe(730);
    expect(p.instanceID).toBeNull();

    const e = h.listingEvents[0]!;
    expect(e.eventid).toBe("3002");
    expect(e.priceInCents).toBe(3);
    expect(e.listedOn).toBe("");
    expect(e.appID).toBeNull();
    expect(e.marketName).toBeNull();
  });

  it("keeps every row in page order in events (the sales/purchases interleaving)", () => {
    const h = parseMarketHistory(HISTORY_BODY);
    expect(h.events.map((e) => [e.type, e.eventid])).toEqual([
      ["sale", "1002"],
      ["purchase", "2002"],
      ["listing_event", "3002"],
    ]);
    expect(h.events[0]).toBe(h.sales[0]);
  });

  it("reads attributes by position: no space before id, id= inside another attribute value", () => {
    const html = SALE_ROW.replace(
      '<div class="market_listing_row market_recent_listing_row" id="history_row_1001_1002">',
      '<div title="x id=history_row_9_9" class="market_listing_row market_recent_listing_row"id="history_row_1001_1002">',
    );
    const h = parseMarketHistory({ ...HISTORY_BODY, results_html: html });
    expect(h.sales.map((s) => s.historyId)).toEqual(["history_row_1001_1002"]);
    expect(h.sales[0]!.marketName).toBe("Road Raider Bandana");
  });

  it("skips rows without a history_row id and survives a malformed hover", () => {
    const noId = SALE_ROW.replace('id="history_row_1001_1002"', 'id="history_row_bad"');
    const h1 = parseMarketHistory({ ...HISTORY_BODY, results_html: noId });
    expect(h1.events).toEqual([]);

    const h2 = parseMarketHistory({
      ...HISTORY_BODY,
      results_html: SALE_ROW,
      hovers: "CreateItemHoverFromContainer( g_rgAssets, 'history_row_1001_1002_name', 252490 );",
    });
    expect(h2.sales[0]!.appID).toBe(252490);
    expect(h2.sales[0]!.assetID).toBeNull();
    expect(h2.sales[0]!.marketName).toBeNull();
  });

  it("quarantines a row whose real price string parses to 0 cents instead of booking it", () => {
    const bad = {
      ...HISTORY_BODY,
      results_html: SALE_ROW.replace("2,25€", "?,??€") + PURCHASE_ROW,
    };
    const h = parseMarketHistory(bad);
    expect(h.sales).toEqual([]);
    expect(h.events.map((e) => e.historyId)).toEqual(["history_row_2001_2002"]);
    expect(h.malformed).toEqual([
      {
        historyId: "history_row_1001_1002",
        displayPrice: "?,??€",
        gainOrLoss: "-",
        reason: "zero_price",
      },
    ]);
  });

  it("quarantines a sale or purchase carrying no price at all", () => {
    const noPrice = SALE_ROW.replace(/<span class="market_listing_price">[\s\S]*?<\/span>/, "");
    const h = parseMarketHistory({ ...HISTORY_BODY, results_html: noPrice });
    expect(h.sales).toEqual([]);
    expect(h.malformed).toMatchObject([
      { historyId: "history_row_1001_1002", reason: "missing_price" },
    ]);
  });

  it("returns nothing for an empty page", () => {
    const h = parseMarketHistory({ success: true, results_html: "" });
    expect(h.sales).toEqual([]);
    expect(h.purchases).toEqual([]);
    expect(h.listingEvents).toEqual([]);
    expect(h.malformed).toEqual([]);
  });
});

describe("MarketNamespace.getMyListings", () => {
  const listing = (id: string, price: number, currencyid = "2003") => ({
    listingid: id,
    price,
    fee: 15,
    currencyid,
    asset: { id: `a${id}`, appid: 730, market_hash_name: `Item ${id}`, amount: "1" },
  });

  it("paginates by page length; buy orders + to-confirm come from the first page only", async () => {
    const { market, http } = await eur();
    http.reply(
      {
        body: {
          success: true,
          num_active_listings: 3,
          listings: [listing("1", 100), listing("2", 200)],
          listings_to_confirm: [listing("9", 50)],
          buy_orders: [
            { buy_orderid: "555", appid: 730, hash_name: "X", price: "10", wallet_currency: 3 },
          ],
        },
      },
      {
        body: {
          success: true,
          num_active_listings: 3,
          results: { listings: [listing("3", 300)] },
          listings_to_confirm: [listing("IGNORED", 1)],
          buy_orders: [{ buy_orderid: "IGNORED" }],
        },
      },
    );

    const r = await market.getMyListings();

    expect(r.listings.map((l) => l.listingid)).toEqual(["1", "2", "3"]);
    expect(r.listings_to_confirm.map((l) => l.listingid)).toEqual(["9"]);
    expect(r.buy_orders.map((o) => o.buy_orderid)).toEqual(["555"]);
    expect(r.num_active_listings).toBe(3);
    expect(r.complete).toBe(true);
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/mylistings/");
    expect(http.requests[0]!.opts.searchParams).toEqual({
      norender: 1,
      currency: 3,
      start: 0,
      count: 100,
    });
    expect(http.requests[1]!.opts.searchParams!.start).toBe(2);
  });

  it("dedupes a listing that shifted onto the next page and flags the census incomplete", async () => {
    const { market, http } = await eur();
    http.reply(
      {
        body: {
          success: true,
          num_active_listings: 3,
          listings: [listing("1", 1), listing("2", 2)],
        },
      },
      { body: { success: true, num_active_listings: 3, listings: [listing("2", 2)] } },
    );
    const r = await market.getMyListings();
    expect(r.listings.map((l) => l.listingid)).toEqual(["1", "2"]);
    expect(r.complete).toBe(false);
  });

  it("stops on an empty page even if the total says more, and is then incomplete", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true, num_active_listings: 5, listings: [] } });
    const r = await market.getMyListings();
    expect(r.listings).toEqual([]);
    expect(r.complete).toBe(false);
    expect(http.requests).toHaveLength(1);
  });

  it("refuses to read listings without a known currency, before any request", async () => {
    const { market, http } = makeMarket();
    await expect(market.getMyListings()).rejects.toBeInstanceOf(WalletCurrencyUnknownError);
    expect(http.requests).toHaveLength(0);
  });

  it("skips the currency (and its checks) only when explicitly told to with null", async () => {
    const { market, http } = makeMarket();
    http.reply({
      body: {
        success: true,
        num_active_listings: 1,
        listings: [listing("1", 1, "2001")],
        buy_orders: [{ buy_orderid: "1", wallet_currency: 1 }],
      },
    });
    const r = await market.getMyListings({ currency: null });
    expect(r.listings).toHaveLength(1);
    expect(http.requests[0]!.opts.searchParams!.currency).toBeUndefined();
  });

  it("refuses buy orders or listings in another currency", async () => {
    const a = await eur();
    a.http.reply({
      body: {
        success: true,
        num_active_listings: 0,
        buy_orders: [{ buy_orderid: "1", wallet_currency: 1 }],
      },
    });
    await expect(a.market.getMyListings()).rejects.toBeInstanceOf(CurrencyMismatchError);

    const b = await eur();
    b.http.reply({
      body: { success: true, num_active_listings: 1, listings: [listing("1", 1, "2001")] },
    });
    await expect(b.market.getMyListings()).rejects.toBeInstanceOf(CurrencyMismatchError);

    const c = await eur();
    c.http.reply({
      body: { success: true, num_active_listings: 0, buy_orders: [{ buy_orderid: "1" }] },
    });
    await expect(c.market.getMyListings()).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it("refuses an explicit currency different from the wallet's", async () => {
    const { market, http } = await eur();
    await expect(market.getMyListings({ currency: 1 })).rejects.toBeInstanceOf(
      CurrencyMismatchError,
    );
    expect(http.requests).toHaveLength(0);
  });

  it("flags the census incomplete when the total moved between pages", async () => {
    const { market, http } = await eur();
    const page1 = Array.from({ length: 100 }, (_, i) => listing(String(i), 1));
    http.reply(
      { body: { success: true, num_active_listings: 101, listings: page1, buy_orders: [] } },
      { body: { success: true, num_active_listings: 100, listings: [], buy_orders: [] } },
    );
    const r = await market.getMyListings();
    expect(r.listings).toHaveLength(100);
    expect(r.num_active_listings).toBe(100);
    expect(r.complete).toBe(false);
  });

  it("flags the census incomplete without a buy_orders array, and keeps listings_on_hold", async () => {
    const { market, http } = await eur();
    http.reply({
      body: { success: true, num_active_listings: 0, listings_on_hold: [listing("h", 5)] },
    });
    const r = await market.getMyListings();
    expect(r.complete).toBe(false);
    expect(r.listings_on_hold.map((l) => l.listingid)).toEqual(["h"]);
  });

  it("refuses a listing that does not state its currency", async () => {
    const { market, http } = await eur();
    const bare = { listingid: "1", price: 1, fee: 1, asset: { id: "a", appid: 730 } };
    http.reply({
      body: { success: true, num_active_listings: 1, listings: [bare], buy_orders: [] },
    });
    await expect(market.getMyListings()).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it("throws on success=false and classifies a 429", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: false } }, { statusCode: 429 });
    await expect(market.getMyListings()).rejects.toThrow(/mylistings/);
    await expect(market.getMyListings()).rejects.toBeInstanceOf(RateLimitError);
  });

  it("passes abort and timeout controls to every page request", async () => {
    const { market, http } = await eur();
    const signal = new AbortController().signal;
    http.reply({ body: { success: true, num_active_listings: 0 } });
    await market.getMyListings({ signal, timeoutMs: 15000 });
    expect(http.requests[0]!.opts.signal).toBe(signal);
    expect(http.requests[0]!.opts.timeoutMs).toBe(15000);
  });
});

describe("MarketNamespace.getMyHistory", () => {
  it("defaults to count=500 and passes start for pagination", async () => {
    const { market, http } = await eur();
    http.reply({ body: HISTORY_BODY }, { body: HISTORY_BODY });

    const h = await market.getMyHistory();
    await market.getMyHistory({ count: 100, start: 500 });

    expect(h.sales).toHaveLength(1);
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/myhistory");
    expect(http.requests[0]!.opts.searchParams).toEqual({ count: 500, start: undefined });
    expect(http.requests[1]!.opts.searchParams).toEqual({ count: 100, start: 500 });
  });

  it("sets rows priced in another currency aside instead of returning them as money", async () => {
    const { market, http } = await usd();
    http.reply({ body: HISTORY_BODY });
    const h = await market.getMyHistory();
    expect(h.events).toHaveLength(0);
    expect(h.sales).toHaveLength(0);
    expect(h.purchases).toHaveLength(0);
    expect(h.malformed.map((r) => [r.historyId, r.gainOrLoss, r.reason])).toEqual([
      ["history_row_1001_1002", "-", "other_currency"],
      ["history_row_2001_2002", "+", "other_currency"],
      ["history_row_3001_3002", "", "other_currency"],
    ]);
  });

  it("keeps the rows in the wallet's currency when the page mixes currencies", async () => {
    const { market, http } = await eur();
    const usdRow = SALE_ROW.replace("2,25€", "$2.25").replaceAll(
      "history_row_1001_1002",
      "history_row_9_9",
    );
    http.reply({ body: { ...HISTORY_BODY, results_html: SALE_ROW + usdRow } });
    const h = await market.getMyHistory();
    expect(h.sales.map((r) => r.historyId)).toEqual(["history_row_1001_1002"]);
    expect(h.malformed.map((r) => [r.historyId, r.reason])).toEqual([
      ["history_row_9_9", "other_currency"],
    ]);
  });

  it("never returns a row with unrecognized currency markers as money", async () => {
    const { market, http } = await eur();
    http.reply({
      body: { ...HISTORY_BODY, results_html: SALE_ROW.replace("2,25€", "CDN$ 3.10") },
    });
    const h = await market.getMyHistory();
    expect(h.sales).toHaveLength(0);
    expect(h.malformed[0]?.reason).toBe("other_currency");
  });

  it("refuses without a known currency; null skips the check", async () => {
    const { market, http } = makeMarket();
    await expect(market.getMyHistory()).rejects.toBeInstanceOf(WalletCurrencyUnknownError);
    http.reply({ body: HISTORY_BODY });
    expect((await market.getMyHistory({ currency: null })).sales).toHaveLength(1);
  });

  it("throws on success=false", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: false } });
    await expect(market.getMyHistory()).rejects.toThrow(/myhistory/);
  });
});

describe("MarketNamespace.getOrderbook", () => {
  const DATA = {
    eCurrency: 3,
    amtMinSellOrder: 120,
    amtMaxBuyOrder: 110,
    rgCompactSellOrders: [120, 2, 125, 1],
    rgCompactBuyOrders: [110, 5, 105, 3],
  };

  it("sends the JSON [appid, name] pair encodeURIComponent-encoded and returns the data", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true, data: DATA } });
    const book = await market.getOrderbook(730, "AK-47 | Redline (Field-Tested)");
    expect(book).toEqual(DATA);
    expect(http.requests[0]!.url).toBe(
      `https://steamcommunity.com/market/orderbook?q=Load&qp=${encodeURIComponent('[730,"AK-47 | Redline (Field-Tested)"]')}`,
    );
  });

  it("unwraps the {data: {success, data}} envelope", async () => {
    const { market, http } = await eur();
    http.reply({ body: { data: { success: true, data: DATA } } });
    expect(await market.getOrderbook(252490, "Some Rust Item")).toEqual(DATA);
  });

  it("throws on a failed payload (old or new shape)", async () => {
    const { market, http } = await eur();
    http.reply({ body: { data: { success: false } } }, { body: { success: 1 } });
    await expect(market.getOrderbook(730, "Nope")).rejects.toThrow(/Bad orderbook response/);
    await expect(market.getOrderbook(730, "Nope")).rejects.toThrow(/Bad orderbook response/);
  });

  it("refuses a book in another currency than the wallet's", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true, data: { ...DATA, eCurrency: 1 } } });
    const err = await market.getOrderbook(730, "X").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CurrencyMismatchError);
    expect(err).toMatchObject({ expected: 3, actual: 1 });
  });

  it("refuses without a known currency; null explicitly skips the check", async () => {
    const { market, http } = makeMarket();
    await expect(market.getOrderbook(730, "X")).rejects.toBeInstanceOf(WalletCurrencyUnknownError);
    expect(http.requests).toHaveLength(0);
    http.reply({ body: { success: true, data: { ...DATA, eCurrency: 1 } } });
    await expect(market.getOrderbook(730, "X", { expectedCurrency: null })).resolves.toMatchObject({
      eCurrency: 1,
    });
  });

  it("classifies the 403 throttle wall as ThrottledError (not a RateLimitError) and 429 as RateLimitError", async () => {
    const { market, http } = await eur();
    http.reply({ statusCode: 403 }, { statusCode: 429 });
    const err = await market.getOrderbook(730, "X").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ThrottledError);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect((err as ThrottledError).statusCode).toBe(403);
    await expect(market.getOrderbook(730, "X")).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("summarizeOrderbook", () => {
  it("reads the best levels exactly as SCM-autoseller did", () => {
    expect(
      summarizeOrderbook({
        eCurrency: 3,
        amtMinSellOrder: 120,
        amtMaxBuyOrder: 110,
        rgCompactSellOrders: [120, 2, 125, 1],
        rgCompactBuyOrders: [110, 5, 105, 3],
      }),
    ).toEqual({
      currency: 3,
      lowestAsk: 120,
      askVolumeAtLowest: 2,
      secondLowestAsk: 125,
      highestBid: 110,
      bidVolumeAtHighest: 5,
      secondHighestBid: 105,
    });
  });

  it("accepts whole-number strings", () => {
    const s = summarizeOrderbook({
      eCurrency: 1,
      amtMinSellOrder: "50" as unknown as number,
      rgCompactSellOrders: ["50", "1"] as unknown as number[],
    });
    expect(s.lowestAsk).toBe(50);
  });

  it("reports an empty side as null, never as a 0-cent price", () => {
    const s = summarizeOrderbook({
      eCurrency: 1,
      amtMinSellOrder: null,
      amtMaxBuyOrder: null,
      rgCompactSellOrders: [],
      rgCompactBuyOrders: [],
    });
    expect(s.lowestAsk).toBeNull();
    expect(s.highestBid).toBeNull();
    expect(s.askVolumeAtLowest).toBe(0);
    expect(s.secondLowestAsk).toBeNull();
  });

  it("has no second level with a single level", () => {
    const s = summarizeOrderbook({
      eCurrency: 1,
      amtMinSellOrder: 50,
      rgCompactSellOrders: [50, 1],
    });
    expect(s.lowestAsk).toBe(50);
    expect(s.secondLowestAsk).toBeNull();
  });

  it.each([
    ["odd-length depth", { amtMinSellOrder: 50, rgCompactSellOrders: [50] }],
    ["a decimal price", { amtMinSellOrder: 50, rgCompactSellOrders: [50.5, 1] }],
    ["a decimal string", { amtMinSellOrder: "154.81", rgCompactSellOrders: ["154.81", "1"] }],
    ["a thousands separator", { amtMinSellOrder: "1,548", rgCompactSellOrders: ["1,548", "1"] }],
    ["nested levels", { amtMinSellOrder: 50, rgCompactSellOrders: [[50, 1]] }],
    ["a negative bid", { amtMaxBuyOrder: 5, rgCompactBuyOrders: [-5, 1] }],
    ["a zero best ask", { amtMinSellOrder: 0, rgCompactSellOrders: [] }],
    ["a best level off its depth", { amtMinSellOrder: 49, rgCompactSellOrders: [50, 1] }],
    ["depth without a best level", { amtMinSellOrder: null, rgCompactSellOrders: [50, 1] }],
    ["a best level without depth", { amtMinSellOrder: 50, rgCompactSellOrders: [] }],
    ["unsorted asks", { amtMinSellOrder: 50, rgCompactSellOrders: [50, 1, 40, 2] }],
    ["unsorted bids", { amtMaxBuyOrder: 50, rgCompactBuyOrders: [50, 1, 60, 2] }],
    ["a zero quantity", { amtMinSellOrder: 50, rgCompactSellOrders: [50, 0] }],
  ])("refuses %s", (_name, data) => {
    expect(() =>
      summarizeOrderbook({ eCurrency: 1, ...(data as Record<string, unknown>) } as never),
    ).toThrow(SteamError);
  });
});

describe("MarketNamespace.getPriceHistory / getMarketItemDetails", () => {
  it("returns the raw price rows when the currency markers match", async () => {
    const { market, http } = await usd();
    const prices = [["Jan 01 2026 01: +0", 1.25, "4"]];
    http.reply({ body: { success: true, price_prefix: "$", price_suffix: "", prices } });
    expect(await market.getPriceHistory(730, "AK-47 | Redline (Field-Tested)")).toEqual(prices);
    expect(http.requests[0]!.url).toBe(
      "https://steamcommunity.com/market/pricehistory?appid=730&market_hash_name=AK-47%20%7C%20Redline%20(Field-Tested)",
    );

    const e = await eur();
    e.http.reply({ body: { success: true, price_prefix: "", price_suffix: "€", prices } });
    expect(await e.market.getPriceHistory(730, "X")).toEqual(prices);
  });

  it("refuses history in another currency, or without recognizable markers", async () => {
    const { market, http } = await eur();
    http.reply(
      { body: { success: true, price_prefix: "$", price_suffix: "", prices: [] } },
      { body: { success: true, prices: [] } },
    );
    await expect(market.getPriceHistory(730, "X")).rejects.toBeInstanceOf(CurrencyMismatchError);
    await expect(market.getPriceHistory(730, "X")).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it("returns [] when an item without sales history has no prices array", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true, price_suffix: "€", prices: false } });
    expect(await market.getPriceHistory(730, "X")).toEqual([]);
  });

  it("throws when pricehistory reports success=false", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: false } });
    await expect(market.getPriceHistory(730, "X")).rejects.toThrow(/pricehistory/);
  });

  it("returns only an exact hash_name match from the search", async () => {
    const { market, http } = makeMarket();
    const exact = { hash_name: "Fracture Case", sell_listings: 42, asset_description: {} };
    http.reply(
      { body: { results: [{ hash_name: "Fracture Case Key", sell_listings: 1 }, exact] } },
      { body: { results: [{ hash_name: "Fracture Case Key", sell_listings: 1 }] } },
    );
    expect(await market.getMarketItemDetails(730, "Fracture Case")).toEqual(exact);
    expect(await market.getMarketItemDetails(730, "Fracture Case")).toBeNull();
    expect(http.requests[0]!.url).toBe(
      "https://steamcommunity.com/market/search/render/?query=%22Fracture%20Case%22&start=0&count=10&search_descriptions=0&sort_column=quantity&sort_dir=desc&appid=730&norender=1",
    );
  });

  it("never reads a success=false search as 'not on the market'", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: false, results: [] } });
    await expect(market.getMarketItemDetails(730, "X")).rejects.toBeInstanceOf(SteamError);
  });
});

describe("MarketNamespace.getMarketWalletInfo", () => {
  const page = (info: object, steamId: string | false = OWN_STEAMID) =>
    `<html><script>var g_steamID = ${steamId === false ? "false" : `"${steamId}"`};\nvar g_rgWalletInfo = ${JSON.stringify(info)};\nvar other = 1;</script></html>`;

  it("parses g_rgWalletInfo from the market page rendered for this account", async () => {
    const { market, http } = await eur();
    const info = {
      wallet_currency: 3,
      wallet_fee: 1,
      wallet_fee_minimum: 1,
      wallet_fee_percent: "0.05",
      wallet_publisher_fee_percent_default: "0.10",
      wallet_fee_base: 0,
      wallet_max_balance: 200000,
    };
    http.reply({ body: page(info) });
    expect(await market.getMarketWalletInfo()).toEqual(info);
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/");
  });

  it("refuses a logged-out page (its default wallet is USD) or another account's", async () => {
    const a = await eur();
    a.http.reply({ body: page({ wallet_currency: 1 }, false) });
    await expect(a.market.getMarketWalletInfo()).rejects.toBeInstanceOf(SteamSessionExpiredError);
    const b = await eur();
    b.http.reply({ body: page({ wallet_currency: 3 }, "76561198000000999") });
    await expect(b.market.getMarketWalletInfo()).rejects.toBeInstanceOf(SteamSessionExpiredError);
  });

  it("never learns the currency, and refuses one different from the known currency", async () => {
    const a = makeMarket();
    a.http.reply({ body: page({ wallet_currency: 1 }) });
    await a.market.getMarketWalletInfo();
    expect(a.market.walletCurrency).toBeUndefined();

    const b = await eur();
    b.http.reply({ body: page({ wallet_currency: 1 }) });
    await expect(b.market.getMarketWalletInfo()).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(b.market.walletCurrency).toBe(3);
  });

  it("throws when the page carries no wallet info", async () => {
    const { market, http } = await eur();
    http.reply({ body: `<html>var g_steamID = "${OWN_STEAMID}";</html>` });
    await expect(market.getMarketWalletInfo()).rejects.toThrow(/g_rgWalletInfo/);
  });
});

describe("MarketNamespace.sellItem", () => {
  it("posts the sell form with the market Referer and returns Steam's body", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true, unmodeled: "kept" } });
    const r = await market.sellItem({ appid: 730, assetid: "123", price: 88 });
    expect(r.success).toBe(true);
    const req = http.requests[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://steamcommunity.com/market/sellitem/");
    expect(req.opts.form).toEqual({
      sessionid: "sess",
      appid: 730,
      contextid: "2",
      assetid: "123",
      amount: 1,
      price: 88,
    });
    expect(req.opts.headers).toEqual({ Referer: "https://steamcommunity.com/market/" });
  });

  it("refuses to sell without a known wallet currency, or priced in another currency", async () => {
    const a = makeMarket();
    await expect(a.market.sellItem({ appid: 730, assetid: "1", price: 5 })).rejects.toBeInstanceOf(
      WalletCurrencyUnknownError,
    );
    const b = await eur();
    await expect(
      b.market.sellItem({ appid: 730, assetid: "1", price: 5, currency: 1 }),
    ).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(a.http.requests).toHaveLength(0);
    expect(b.http.requests).toHaveLength(0);
  });

  it("refuses a non-integer or non-positive price or amount before any request", async () => {
    const { market, http } = await eur();
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(market.sellItem({ appid: 730, assetid: "1", price: bad })).rejects.toThrow(
        RangeError,
      );
    }
    await expect(
      market.sellItem({ appid: 730, assetid: "1", price: 5, amount: 0 }),
    ).rejects.toThrow(RangeError);
    expect(http.requests).toHaveLength(0);
  });

  it.each([
    [
      "You have too many listings pending confirmation. Please confirm or cancel some before attempting to list more.",
      MarketConfirmationLimitError,
      "too_many_pending",
    ],
    [
      "You already have a listing for this item pending confirmation. Please confirm or cancel the existing listing.",
      MarketConfirmationLimitError,
      "item_pending",
    ],
    [
      "Listing this item would put you over the maximum wallet balance.",
      WalletBalanceLimitError,
      undefined,
    ],
    [
      "Your account is currently unable to use the Community Market.",
      MarketBlockedError,
      undefined,
    ],
    [
      "The item specified is no longer in your inventory or is not allowed to be traded on the Community Market.",
      MarketItemUnavailableError,
      undefined,
    ],
  ])("classifies %j", async (message, ErrorClass, reason) => {
    const { market, http } = await eur();
    http.reply({ statusCode: 502, body: { success: false, message } });
    const err = await market.sellItem({ appid: 730, assetid: "1", price: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ErrorClass);
    if (reason) expect(err.reason).toBe(reason);
  });

  it("keeps a numeric code as eresult, and never treats a non-1 code as listed", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: 15, message: "Something else" } });
    const err = await market.sellItem({ appid: 730, assetid: "1", price: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(SteamError);
    expect(err.eresult).toBe(15);
    expect(err.message).toBe("Something else");
  });

  it("classifies 401 as an expired session even when Steam sends a message", async () => {
    const { market, http } = await eur();
    http.reply({ statusCode: 401, body: { success: false, message: "Not logged in" } });
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      SteamSessionExpiredError,
    );
  });

  it("classifies 429 and a bodiless failure by HTTP status", async () => {
    const { market, http } = await eur();
    http.reply({ statusCode: 429 }, { statusCode: 500 });
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      RateLimitError,
    );
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      HttpStatusError,
    );
  });

  it("passes the per-call timeout", async () => {
    const { market, http } = await eur();
    http.reply({ body: { success: true } });
    await market.sellItem({ appid: 730, assetid: "1", price: 1, timeoutMs: 15000 });
    expect(http.requests[0]!.opts.timeoutMs).toBe(15000);
  });
});

describe("MarketNamespace.cancelListing", () => {
  it("accepts 200 and a 302 back to the market", async () => {
    const { market, http } = makeMarket();
    http.reply(
      {},
      { statusCode: 302, headers: { location: "https://steamcommunity.com/market/" } },
    );
    await market.cancelListing("777");
    await market.cancelListing("777");
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/removelisting/777");
    expect(http.requests[0]!.opts.form).toEqual({ sessionid: "sess" });
  });

  it("treats a redirect to /login as an expired session, other statuses as HTTP errors", async () => {
    const { market, http } = makeMarket();
    http.reply(
      { statusCode: 302, headers: { location: "https://steamcommunity.com/login/home/" } },
      { statusCode: 500 },
    );
    await expect(market.cancelListing("1")).rejects.toBeInstanceOf(SteamSessionExpiredError);
    await expect(market.cancelListing("1")).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("never treats a redirect elsewhere (eligibility check, no Location) as removed", async () => {
    const { market, http } = makeMarket();
    http.reply(
      {
        statusCode: 302,
        headers: { location: "https://steamcommunity.com/market/eligibilitycheck/?goto=%2F" },
      },
      { statusCode: 302 },
    );
    await expect(market.cancelListing("1")).rejects.toBeInstanceOf(MarketIneligibleError);
    await expect(market.cancelListing("1")).rejects.toBeInstanceOf(HttpStatusError);
  });
});

describe("MarketNamespace.createBuyOrder", () => {
  const ORDER = {
    appid: 730,
    marketHashName: "AK-47 | Redline (Field-Tested)",
    priceTotal: 2000,
    quantity: 2,
  };
  const json = (o: unknown) => JSON.stringify(o);
  const pendingFor = (creator: string) => [
    conf("90", EConfirmationType.BuyOrder, "AK-47 | Redline (Field-Tested)", 1, creator),
  ];

  it("returns the buy_orderid directly when Steam needs no confirmation", async () => {
    const { market, http, confirmations } = await eur();
    http.reply({ body: json({ success: 1, buy_orderid: "1234567890" }) });
    expect(await market.createBuyOrder(ORDER)).toBe("1234567890");
    expect(confirmations.pendingCalls).toBe(0);
    const req = http.requests[0]!;
    expect(req.url).toBe("https://steamcommunity.com/market/createbuyorder/");
    expect(req.opts.form).toEqual({
      sessionid: "sess",
      currency: 3,
      appid: 730,
      market_hash_name: "AK-47 | Redline (Field-Tested)",
      price_total: 2000,
      quantity: 2,
      confirmation: 0,
    });
    expect(req.opts.headers).toEqual({
      Referer:
        "https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline%20(Field-Tested)",
    });
  });

  it("keeps every digit of a 64-bit id sent as a bare JSON number", async () => {
    const { market, http, confirmations } = await eur();
    confirmations.pending = pendingFor("12345678901234567891");
    http.reply(
      {
        statusCode: 406,
        body: '{"success":22,"need_confirmation":true,"confirmation":{"confirmation_id":12345678901234567891}}',
      },
      { body: '{"success":1,"buy_orderid":98765432109876543210}' },
    );
    expect(await market.createBuyOrder(ORDER)).toBe("98765432109876543210");
    expect(http.requests[1]!.opts.form!.confirmation).toBe("12345678901234567891");
  });

  it("runs the 406 → exact mobile confirmation → finalize flow", async () => {
    const { market, http, confirmations } = await eur();
    confirmations.pending = [
      conf("80", EConfirmationType.BuyOrder, "Other", 1, "1111"),
      ...pendingFor("4242"),
    ];
    http.reply(
      {
        statusCode: 406,
        body: json({
          success: 22,
          need_confirmation: true,
          confirmation: { confirmation_id: "4242" },
        }),
      },
      { body: json({ success: 1, buy_orderid: 99 }) },
    );
    expect(await market.createBuyOrder(ORDER)).toBe("99");
    expect(confirmations.accepted.map((b) => b.map((c) => c.id))).toEqual([["90"]]);
    expect(http.requests[1]!.opts.form!.confirmation).toBe("4242");
  });

  it("waits for the confirmation to appear before giving up", async () => {
    vi.useFakeTimers();
    const { market, http, confirmations } = await eur();
    confirmations.pendingSequence = [[], [], pendingFor("7")];
    http.reply(
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) },
      { body: json({ success: 1, buy_orderid: "5" }) },
    );
    const done = market.createBuyOrder(ORDER);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await done).toBe("5");
    expect(confirmations.pendingCalls).toBe(3);
  });

  it("never finalizes without the exact confirmation; the order was not placed", async () => {
    vi.useFakeTimers();
    const { market, http, confirmations } = await eur();
    confirmations.pending = pendingFor("someone-else");
    http.reply({ statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) });
    const done = market.createBuyOrder(ORDER).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await done;
    expect(err).toBeInstanceOf(BuyOrderError);
    expect(err).toMatchObject({ stage: "confirm", mayExist: false, confirmationId: "7" });
    expect(confirmations.accepted).toEqual([]);
    expect(http.requests).toHaveLength(1);
  });

  it("an explicitly refused confirmation means not placed; a failed transport means maybe", async () => {
    const a = await eur();
    a.confirmations.pending = pendingFor("7");
    a.confirmations.acceptError = new ConfirmationError("Could not act on confirmation");
    a.http.reply({ statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) });
    await expect(a.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "confirm",
      mayExist: false,
    });
    expect(a.http.requests).toHaveLength(1);

    const b = await eur();
    b.confirmations.pending = pendingFor("7");
    b.confirmations.acceptError = new ProxyError("socket hang up");
    b.http.reply({ statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) });
    await expect(b.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "confirm",
      mayExist: true,
    });
    expect(b.http.requests).toHaveLength(1);
  });

  it("carries Steam's refusal code on a create-step refusal (not placed)", async () => {
    const { market, http } = await eur();
    http.reply({ body: json({ success: 107, message: "Insufficient funds" }) });
    const err = await market.createBuyOrder(ORDER).catch((e) => e);
    expect(err).toBeInstanceOf(BuyOrderError);
    expect(err).toMatchObject({ stage: "create", code: 107, eresult: 107, mayExist: false });
    expect(err.message).toBe("Insufficient funds");
  });

  it("types code 15 / 'unable to use the Community Market' as MarketBlockedError at any step", async () => {
    const a = await eur();
    a.http.reply({ body: json({ success: 15 }) });
    await expect(a.market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(MarketBlockedError);

    const b = await eur();
    b.confirmations.pending = pendingFor("7");
    b.http.reply(
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) },
      {
        body: json({
          success: 2,
          message: "Your account is currently unable to use the Community Market.",
        }),
      },
    );
    await expect(b.market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(MarketBlockedError);
  });

  it("reports a finalize refusal with a proven not-placed code as not placed", async () => {
    const { market, http, confirmations } = await eur();
    confirmations.pending = pendingFor("1");
    http.reply(
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "1" } }) },
      { body: json({ success: 107, message: "You do not have enough funds" }) },
    );
    const err = await market.createBuyOrder(ORDER).catch((e) => e);
    expect(err).toMatchObject({
      stage: "finalize",
      code: 107,
      mayExist: false,
      confirmationId: "1",
    });
  });

  it("treats Steam's 'trouble hearing back' as may-exist, at either step, whatever the code", async () => {
    const hearing =
      "Sorry! We had trouble hearing back from the Steam servers about your order. Double check whether or not your order has actually been created or filled.";
    const a = await eur();
    a.confirmations.pending = pendingFor("1");
    a.http.reply(
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "1" } }) },
      { body: json({ success: 8, message: hearing }) },
    );
    await expect(a.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "finalize",
      code: 8,
      mayExist: true,
    });
    const b = await eur();
    b.http.reply({ body: json({ success: 107, message: hearing }) });
    await expect(b.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "create",
      mayExist: true,
    });
    const c = await eur();
    c.http.reply({ body: json({ success: 16, message: "Timeout" }) });
    await expect(c.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "create",
      code: 16,
      mayExist: true,
    });
  });

  it("flags a duplicate (29) as an order that exists, even with a stray wallet_info success", async () => {
    const a = await eur();
    a.http.reply({
      body: json({ success: 29, message: "You already have an active buy order for this item." }),
    });
    await expect(a.market.createBuyOrder(ORDER)).rejects.toMatchObject({
      code: 29,
      orderExists: true,
      mayExist: true,
    });
    const b = await eur();
    b.http.reply({ body: json({ success: 29, wallet_info: { success: 1 }, buy_orderid: "777" }) });
    await expect(b.market.createBuyOrder(ORDER)).rejects.toMatchObject({ orderExists: true });
  });

  it("only clears mayExist for the proven not-placed codes (15 blocked, 25 limit, 107 funds)", async () => {
    for (const [code, mayExist] of [
      [25, false],
      [107, false],
      [2, true],
      [8, true],
      [42, true],
    ] as const) {
      const { market, http } = await eur();
      http.reply({ body: json({ success: code, message: "x" }) });
      await expect(market.createBuyOrder(ORDER)).rejects.toMatchObject({ code, mayExist });
    }
  });

  it("treats every finalize failure without a verdict as 'may exist' (the confirmation was accepted)", async () => {
    const { market, http, confirmations } = await eur();
    confirmations.pending = pendingFor("7");
    http.reply(
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) },
      { statusCode: 429 },
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) },
      { statusCode: 502 },
      { statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) },
      { throws: new ProxyError("timeout") },
    );
    for (let i = 0; i < 3; i++) {
      const err = await market.createBuyOrder(ORDER).catch((e) => e);
      expect(err).toBeInstanceOf(BuyOrderError);
      expect(err).toMatchObject({ stage: "finalize", mayExist: true, confirmationId: "7" });
    }
    expect(confirmations.accepted).toHaveLength(3);
  });

  it("a step-1 429 / login redirect / eligibility redirect proves nothing was placed", async () => {
    const { market, http } = await eur();
    http.reply(
      { statusCode: 429 },
      { statusCode: 302, headers: { location: "https://steamcommunity.com/login/home/" } },
      {
        statusCode: 302,
        headers: { location: "https://steamcommunity.com/market/eligibilitycheck/" },
      },
    );
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(RateLimitError);
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(SteamSessionExpiredError);
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(MarketIneligibleError);
  });

  it("a step-1 transport failure or verdict-less reply may still have placed the order", async () => {
    const { market, http } = await eur();
    http.reply(
      { throws: new ProxyError("socket hang up") },
      { statusCode: 502 },
      { body: "<html>oops</html>" },
      { body: json({ success: 1 }) },
    );
    for (let i = 0; i < 4; i++) {
      const err = await market.createBuyOrder(ORDER).catch((e) => e);
      expect(err).toBeInstanceOf(BuyOrderError);
      expect(err).toMatchObject({ stage: "create", mayExist: true });
    }
  });

  it("never accepts a confirmation of another type for the buy order's id", async () => {
    vi.useFakeTimers();
    const { market, http, confirmations } = await eur();
    confirmations.pending = [conf("70", EConfirmationType.Trade, "trade", 1, "7")];
    http.reply({ statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) });
    const done = market.createBuyOrder(ORDER).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await done).toMatchObject({ stage: "confirm", mayExist: false });
    expect(confirmations.accepted).toEqual([]);
  });

  it("an unreadable confirmation answer means the order may exist", async () => {
    const { market, http, confirmations } = await eur();
    confirmations.pending = pendingFor("7");
    confirmations.acceptError = new ConfirmationOutcomeUnknownError();
    http.reply({ statusCode: 406, body: json({ confirmation: { confirmation_id: "7" } }) });
    await expect(market.createBuyOrder(ORDER)).rejects.toMatchObject({
      stage: "confirm",
      mayExist: true,
    });
    expect(http.requests).toHaveLength(1);
  });

  it("refuses an unknown or foreign currency and a malformed total, before any request", async () => {
    const a = makeMarket();
    await expect(a.market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(WalletCurrencyUnknownError);
    const b = await eur();
    await expect(b.market.createBuyOrder({ ...ORDER, currency: 1 })).rejects.toBeInstanceOf(
      CurrencyMismatchError,
    );
    await expect(b.market.createBuyOrder({ ...ORDER, priceTotal: 2001 })).rejects.toThrow(
      RangeError,
    );
    await expect(b.market.createBuyOrder({ ...ORDER, quantity: 0 })).rejects.toThrow(RangeError);
    expect(a.http.requests).toHaveLength(0);
    expect(b.http.requests).toHaveLength(0);
  });
});

describe("MarketNamespace.cancelBuyOrder / getWalletDetails", () => {
  it("posts the buy_orderid and returns Steam's body on success", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: 1 } });
    expect(await market.cancelBuyOrder("555")).toEqual({ success: 1 });
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/cancelbuyorder/");
    expect(http.requests[0]!.opts.form).toEqual({ sessionid: "sess", buy_orderid: "555" });
  });

  it("throws on any other verdict, carrying Steam's code", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: 29 } }, { body: undefined }, { statusCode: 500 });
    await expect(market.cancelBuyOrder("555")).rejects.toMatchObject({ eresult: 29 });
    await expect(market.cancelBuyOrder("555")).rejects.toBeInstanceOf(SteamError);
    await expect(market.cancelBuyOrder("555")).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("reads the wallet via IUserAccountService/GetClientWalletDetails", async () => {
    const response = { has_wallet: true, balance: "12345", currency_code: 3 };
    const { market, apiCalls } = makeMarket({ apiBody: { response } });
    expect(await market.getWalletDetails({ timeoutMs: 15000 })).toEqual(response);
    expect(apiCalls[0]).toEqual({
      httpMethod: "POST",
      iface: "IUserAccountService",
      method: "GetClientWalletDetails",
      input: { include_balance_in_usd: 1, include_formatted_balance: 1 },
      timeoutMs: 15000,
    });
  });

  it("throws on a wallet response without a body", async () => {
    const { market } = makeMarket({ apiBody: {} });
    await expect(market.getWalletDetails()).rejects.toThrow(/wallet/);
  });
});

describe("MarketNamespace confirmations", () => {
  it("confirmListingIds accepts exactly the listing confirmations created by those ids", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [
      conf("1", EConfirmationType.MarketListing, "AK-47 | Redline", 100, "L1"),
      conf("2", EConfirmationType.MarketListing, "AK-47 | Redline", 200, "L2"),
      conf("3", EConfirmationType.Trade, "x", 300, "L3"),
      conf("4", EConfirmationType.BuyOrder, "x", 400, "L4"),
    ];
    const r = await market.confirmListingIds(["L2", "L3", "L4", "L9"]);
    expect(r.confirmed.map((c) => c.id)).toEqual(["2"]);
    expect(r.missing).toEqual(["L3", "L4", "L9"]);
    expect(confirmations.accepted).toEqual([r.confirmed]);
  });

  it("confirmListingIds with no ids touches nothing", async () => {
    const { market, confirmations } = makeMarket();
    expect(await market.confirmListingIds([])).toEqual({ confirmed: [], missing: [] });
    expect(confirmations.pendingCalls).toBe(0);
  });

  it("confirmListings: exact match, then substring; others skipped; one batch, oldest first", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [
      conf("3", EConfirmationType.MarketListing, "StatTrak™ SCAR-20 | Caged", 300),
      conf("1", EConfirmationType.MarketListing, "Fracture Case", 100),
      conf("2", EConfirmationType.MarketListing, "Fracture Case", 200),
      conf("4", EConfirmationType.MarketListing, "Unexpected Item", 400),
      conf("5", EConfirmationType.Trade, "Fracture Case", 50),
    ];

    const r = await market.confirmListings({
      "Fracture Case": 1,
      "StatTrak™ SCAR-20 | Caged (Field-Tested)": 1,
    });

    expect(r.confirmed.map((c) => c.id)).toEqual(["1", "3"]);
    expect(r.skipped.map((c) => c.id)).toEqual(["2", "4"]);
    expect(confirmations.accepted).toEqual([r.confirmed]);
  });

  it("confirmListings never substring-matches an empty confirmation summary", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [
      conf("1", EConfirmationType.MarketListing, "", 100),
      conf("2", EConfirmationType.MarketListing, "AK-47 | Redline", 200),
    ];
    const r = await market.confirmListings({ "AK-47 | Redline (Field-Tested)": 1 });
    expect(r.confirmed.map((c) => c.id)).toEqual(["2"]);
    expect(r.skipped.map((c) => c.id)).toEqual(["1"]);
  });

  it("confirmListings is a no-op when nothing is expected", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [conf("1", EConfirmationType.MarketListing, "X", 1)];
    expect(await market.confirmListings({ X: 0 })).toEqual({ confirmed: [], skipped: [] });
    expect(confirmations.accepted).toEqual([]);
  });

  it("rejectListings rejects only the requested types, keeping in-flight creators", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [
      conf("1", EConfirmationType.MarketListing, "A", 1, "L1"),
      conf("6", EConfirmationType.MarketListing, "A", 1, "L6"),
      conf("2", EConfirmationType.BuyOrder, "B", 2),
      conf("3", EConfirmationType.Trade, "C", 3),
    ];
    expect(
      (await market.rejectListings(undefined, { keepCreators: ["L6"] })).map((c) => c.id),
    ).toEqual(["1"]);
    expect((await market.rejectListings([EConfirmationType.BuyOrder])).map((c) => c.id)).toEqual([
      "2",
    ]);
    expect(confirmations.rejected.map((batch) => batch.map((c) => c.id))).toEqual([["1"], ["2"]]);
  });
});

describe("MarketNamespace wallet currency", () => {
  const book = (eCurrency: number) => ({
    body: { success: true, data: { eCurrency, rgCompactSellOrders: [], rgCompactBuyOrders: [] } },
  });

  it("learns the currency from the wallet and keeps EUR and USD accounts apart", async () => {
    const e = makeMarket({ apiBody: { response: { has_wallet: true, currency_code: 3 } } });
    const u = makeMarket({ apiBody: { response: { has_wallet: true, currency_code: 1 } } });
    await e.market.getWalletDetails();
    await u.market.getWalletDetails();
    expect(e.market.walletCurrency).toBe(3);
    expect(u.market.walletCurrency).toBe(1);

    e.http.reply(book(3), book(1));
    u.http.reply(book(1), book(3));
    await expect(e.market.getOrderbook(730, "X")).resolves.toMatchObject({ eCurrency: 3 });
    await expect(e.market.getOrderbook(730, "X")).rejects.toBeInstanceOf(CurrencyMismatchError);
    await expect(u.market.getOrderbook(730, "X")).resolves.toMatchObject({ eCurrency: 1 });
    await expect(u.market.getOrderbook(730, "X")).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it("never lets the wallet replace a seeded currency", async () => {
    const { market } = makeMarket({
      currency: 3,
      apiBody: { response: { has_wallet: true, currency_code: 1 } },
    });
    await expect(market.getWalletDetails()).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(market.walletCurrency).toBe(3);
  });

  it("writes wait for a live read to verify a seeded currency", async () => {
    const { market, http } = makeMarket({ currency: 3 });
    expect(market.walletCurrencyVerified).toBe(false);
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 5 })).rejects.toBeInstanceOf(
      WalletCurrencyUnknownError,
    );
    http.reply(book(3), { body: { success: true } });
    await market.getOrderbook(730, "X");
    expect(market.walletCurrencyVerified).toBe(true);
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 5 })).resolves.toBeTruthy();
  });

  it("refuses an invalid or conflicting seed", () => {
    const { market } = makeMarket({ currency: 3 });
    expect(() => market.seedWalletCurrency(1)).toThrow(CurrencyMismatchError);
    expect(() => makeMarket().market.seedWalletCurrency(0)).toThrow(RangeError);
    expect(() => makeMarket().market.seedWalletCurrency(1.5)).toThrow(RangeError);
  });

  it("does not learn or verify from a wallet that does not exist", async () => {
    const { market } = makeMarket({
      apiBody: { response: { has_wallet: false, currency_code: 1 } },
    });
    await market.getWalletDetails();
    expect(market.walletCurrency).toBeUndefined();
    expect(market.walletCurrencyVerified).toBe(false);
  });

  it("does not learn a currency from a wallet without one", async () => {
    const { market } = makeMarket({
      apiBody: { response: { has_wallet: false, currency_code: 0 } },
    });
    await market.getWalletDetails();
    expect(market.walletCurrency).toBeUndefined();
  });

  it("sends the known currency with mylistings and createbuyorder", async () => {
    const { market, http } = await usd();
    http.reply(
      { body: { success: true, num_active_listings: 0, listings: [] } },
      { body: JSON.stringify({ success: 1, buy_orderid: "1" }) },
    );
    await market.getMyListings();
    await market.createBuyOrder({ appid: 730, marketHashName: "X", priceTotal: 5, quantity: 1 });
    expect(http.requests[0]!.opts.searchParams!.currency).toBe(1);
    expect(http.requests[1]!.opts.form!.currency).toBe(1);
  });
});
