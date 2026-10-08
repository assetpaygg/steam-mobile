import { describe, expect, it } from "vitest";
import type { Confirmation, ConfirmationManager } from "../src/community/confirmations.js";
import { EConfirmationType } from "../src/core/enums.js";
import {
  HttpStatusError,
  MarketBlockedError,
  MarketConfirmationLimitError,
  RateLimitError,
  SteamError,
  SteamSessionExpiredError,
  ThrottledError,
  WalletBalanceLimitError,
} from "../src/core/errors.js";
import type { HttpClient, RequestOptions } from "../src/http/HttpClient.js";
import type { ApiCallParams, WebApiClient } from "../src/http/webApi.js";
import { parseMarketHistory } from "../src/market/history.js";
import { MarketNamespace } from "../src/market/MarketNamespace.js";
import { getPriceValueAsInt } from "../src/market/prices.js";
import type { SessionManager } from "../src/session/SessionManager.js";

interface Reply {
  statusCode?: number;
  body?: unknown;
  headers?: Record<string, string>;
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
    return { statusCode: r.statusCode ?? 200, headers: r.headers ?? {}, body: r.body };
  }
}

class FakeConfirmations {
  pending: Confirmation[] = [];
  accepted: Pick<Confirmation, "id" | "key">[][] = [];
  rejected: Pick<Confirmation, "id" | "key">[][] = [];
  acceptedObjects: string[] = [];
  objectError: Error | undefined;

  async getPending() {
    return this.pending;
  }
  async acceptConfirmations(confs: Pick<Confirmation, "id" | "key">[]) {
    this.accepted.push(confs);
  }
  async rejectConfirmations(confs: Pick<Confirmation, "id" | "key">[]) {
    this.rejected.push(confs);
  }
  async acceptConfirmationForObject(id: string) {
    if (this.objectError) throw this.objectError;
    this.acceptedObjects.push(id);
  }
}

function makeMarket(apiBody: unknown = {}) {
  const http = new FakeHttp();
  const confirmations = new FakeConfirmations();
  const apiCalls: ApiCallParams[] = [];
  const api = {
    call: async (params: ApiCallParams) => {
      apiCalls.push(params);
      return apiBody;
    },
  };
  const session = { async getAccessToken() {} } as unknown as SessionManager;
  const market = new MarketNamespace(
    http as unknown as HttpClient,
    session,
    confirmations as unknown as ConfirmationManager,
    api as unknown as WebApiClient,
  );
  return { market, http, confirmations, apiCalls };
}

function conf(id: string, type: number, sending: string, createdAt: number): Confirmation {
  return {
    id,
    type,
    creator: `c${id}`,
    key: `k${id}`,
    title: "",
    receiving: "",
    sending,
    time: new Date(createdAt * 1000).toISOString(),
    timestamp: new Date(createdAt * 1000),
    icon: "",
  };
}

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

  it("fails loud when a real price string parses to 0 cents", () => {
    const bad = { ...HISTORY_BODY, results_html: SALE_ROW.replace("2,25€", "?,??€") };
    expect(() => parseMarketHistory(bad)).toThrow(/parsed to 0 cents/);
  });

  it("returns nothing for an empty page", () => {
    const h = parseMarketHistory({ success: true, results_html: "" });
    expect(h.sales).toEqual([]);
    expect(h.purchases).toEqual([]);
    expect(h.listingEvents).toEqual([]);
  });
});

describe("MarketNamespace.getMyListings", () => {
  const listing = (id: string, price: number) => ({
    listingid: id,
    price,
    fee: 15,
    asset: { id: `a${id}`, appid: 730, market_hash_name: `Item ${id}`, amount: "1" },
  });

  it("paginates by page length; buy orders + to-confirm come from the first page only", async () => {
    const { market, http } = makeMarket();
    http.reply(
      {
        body: {
          success: true,
          num_active_listings: 3,
          listings: [listing("1", 100), listing("2", 200)],
          listings_to_confirm: [listing("9", 50)],
          buy_orders: [{ buy_orderid: "555", appid: 730, hash_name: "X", price: "10" }],
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

    const r = await market.getMyListings({ currency: 3 });

    expect(r.listings.map((l) => l.listingid)).toEqual(["1", "2", "3"]);
    expect(r.listings_to_confirm.map((l) => l.listingid)).toEqual(["9"]);
    expect(r.buy_orders.map((o) => o.buy_orderid)).toEqual(["555"]);
    expect(r.num_active_listings).toBe(3);
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/mylistings/");
    expect(http.requests[0]!.opts.searchParams).toEqual({
      norender: 1,
      currency: 3,
      start: 0,
      count: 100,
    });
    expect(http.requests[1]!.opts.searchParams!.start).toBe(2);
  });

  it("stops on an empty page even if the total says more", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: true, num_active_listings: 5, listings: [] } });
    const r = await market.getMyListings();
    expect(r.listings).toEqual([]);
    expect(http.requests).toHaveLength(1);
  });

  it("throws on success=false and classifies a 429", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: false } }, { statusCode: 429 });
    await expect(market.getMyListings()).rejects.toThrow(/mylistings/);
    await expect(market.getMyListings()).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("MarketNamespace.getMyHistory", () => {
  it("defaults to count=500 and passes start for pagination", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: HISTORY_BODY }, { body: HISTORY_BODY });

    const h = await market.getMyHistory();
    await market.getMyHistory({ count: 100, start: 500 });

    expect(h.sales).toHaveLength(1);
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/myhistory");
    expect(http.requests[0]!.opts.searchParams).toEqual({ count: 500, start: undefined });
    expect(http.requests[1]!.opts.searchParams).toEqual({ count: 100, start: 500 });
  });

  it("throws on success=false", async () => {
    const { market, http } = makeMarket();
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
    const { market, http } = makeMarket();
    http.reply({ body: { success: true, data: DATA } });
    const book = await market.getOrderbook(730, "AK-47 | Redline (Field-Tested)");
    expect(book).toEqual(DATA);
    expect(http.requests[0]!.url).toBe(
      `https://steamcommunity.com/market/orderbook?q=Load&qp=${encodeURIComponent('[730,"AK-47 | Redline (Field-Tested)"]')}`,
    );
  });

  it("unwraps the {data: {success, data}} envelope", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { data: { success: true, data: DATA } } });
    expect(await market.getOrderbook(252490, "Some Rust Item")).toEqual(DATA);
  });

  it("throws on a failed payload (old or new shape)", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { data: { success: false } } }, { body: { success: 1 } });
    await expect(market.getOrderbook(730, "Nope")).rejects.toThrow(/Bad orderbook response/);
    await expect(market.getOrderbook(730, "Nope")).rejects.toThrow(/Bad orderbook response/);
  });

  it("refuses a book in another currency when expectedCurrency is set", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: true, data: { ...DATA, eCurrency: 1 } } });
    await expect(market.getOrderbook(730, "X", { expectedCurrency: 3 })).rejects.toThrow(
      /currency 1 != expected 3/,
    );
  });

  it("classifies the 403 throttle wall as ThrottledError (not a RateLimitError) and 429 as RateLimitError", async () => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 403 }, { statusCode: 429 });
    const err = await market.getOrderbook(730, "X").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ThrottledError);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect((err as ThrottledError).statusCode).toBe(403);
    await expect(market.getOrderbook(730, "X")).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("MarketNamespace.getPriceHistory / getMarketItemDetails", () => {
  it("returns the raw price rows", async () => {
    const { market, http } = makeMarket();
    const prices = [["Jan 01 2026 01: +0", 1.25, "4"]];
    http.reply({ body: { success: true, prices } });
    expect(await market.getPriceHistory(730, "AK-47 | Redline (Field-Tested)")).toEqual(prices);
    expect(http.requests[0]!.url).toBe(
      "https://steamcommunity.com/market/pricehistory?appid=730&market_hash_name=AK-47%20%7C%20Redline%20(Field-Tested)",
    );
  });

  it("returns [] when an item without sales history has no prices array", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: true, prices: false } });
    expect(await market.getPriceHistory(730, "X")).toEqual([]);
  });

  it("throws when pricehistory reports success=false", async () => {
    const { market, http } = makeMarket();
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
});

describe("MarketNamespace.sellItem", () => {
  it("posts the sell form with the market Referer and returns Steam's body", async () => {
    const { market, http } = makeMarket();
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

  it.each([
    ["You have too many listings pending confirmation.", MarketConfirmationLimitError],
    [
      "You already have a listing for this item pending confirmation.",
      MarketConfirmationLimitError,
    ],
    ["Listing this item would put you over the maximum wallet balance.", WalletBalanceLimitError],
    ["Your account is currently unable to use the Community Market.", MarketBlockedError],
  ])("classifies %j", async (message, ErrorClass) => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 502, body: { success: false, message } });
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      ErrorClass,
    );
  });

  it("keeps a numeric code as eresult, and never treats a non-1 code as listed", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: 15, message: "Something else" } });
    const err = await market.sellItem({ appid: 730, assetid: "1", price: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(SteamError);
    expect(err.eresult).toBe(15);
    expect(err.message).toBe("Something else");
  });

  it("classifies 401 as an expired session even when Steam sends a message", async () => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 401, body: { success: false, message: "Not logged in" } });
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      SteamSessionExpiredError,
    );
  });

  it("classifies 429 and a bodiless failure by HTTP status", async () => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 429 }, { statusCode: 500 });
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      RateLimitError,
    );
    await expect(market.sellItem({ appid: 730, assetid: "1", price: 1 })).rejects.toBeInstanceOf(
      HttpStatusError,
    );
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
    await expect(market.cancelListing("1")).rejects.toThrow(/eligibility/);
    await expect(market.cancelListing("1")).rejects.toBeInstanceOf(HttpStatusError);
  });
});

describe("MarketNamespace.createBuyOrder", () => {
  const ORDER = {
    appid: 730,
    marketHashName: "AK-47 | Redline (Field-Tested)",
    priceTotal: 2000,
    quantity: 2,
    currency: 3,
  };

  it("returns the buy_orderid directly when Steam needs no confirmation", async () => {
    const { market, http, confirmations } = makeMarket();
    http.reply({ body: { success: 1, buy_orderid: "1234567890" } });
    expect(await market.createBuyOrder(ORDER)).toBe("1234567890");
    expect(confirmations.acceptedObjects).toEqual([]);
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

  it("runs the 406 → mobile confirmation → finalize flow", async () => {
    const { market, http, confirmations } = makeMarket();
    http.reply(
      {
        statusCode: 406,
        body: { success: 22, need_confirmation: true, confirmation: { confirmation_id: "4242" } },
      },
      { body: { success: 1, buy_orderid: 99 } },
    );
    expect(await market.createBuyOrder(ORDER)).toBe("99");
    expect(confirmations.acceptedObjects).toEqual(["4242"]);
    expect(http.requests[1]!.opts.form!.confirmation).toBe("4242");
  });

  it("carries Steam's code as eresult when the order is refused", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: 107, message: "Insufficient funds" } });
    const err = await market.createBuyOrder(ORDER).catch((e) => e);
    expect(err).toBeInstanceOf(SteamError);
    expect(err.eresult).toBe(107);
    expect(err.message).toBe("Insufficient funds");
  });

  it("reports a failed finalize step", async () => {
    const { market, http } = makeMarket();
    http.reply(
      { statusCode: 406, body: { confirmation: { confirmation_id: "1" } } },
      { body: { success: 8, message: "trouble hearing back" } },
    );
    const err = await market.createBuyOrder(ORDER).catch((e) => e);
    expect(err.eresult).toBe(8);
    expect(err.message).toBe("trouble hearing back");
  });

  it("classifies 429 and bodiless transport failures", async () => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 429 }, { statusCode: 502 });
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(RateLimitError);
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("surfaces a 429 on the finalize step (after the confirmation was accepted)", async () => {
    const { market, http, confirmations } = makeMarket();
    http.reply(
      { statusCode: 406, body: { confirmation: { confirmation_id: "7" } } },
      { statusCode: 429 },
    );
    await expect(market.createBuyOrder(ORDER)).rejects.toBeInstanceOf(RateLimitError);
    expect(confirmations.acceptedObjects).toEqual(["7"]);
  });

  it("does not finalize when the mobile confirmation fails", async () => {
    const { market, http, confirmations } = makeMarket();
    confirmations.objectError = new Error("Could not find confirmation for object 7");
    http.reply({ statusCode: 406, body: { confirmation: { confirmation_id: "7" } } });
    await expect(market.createBuyOrder(ORDER)).rejects.toThrow(/Could not find confirmation/);
    expect(http.requests).toHaveLength(1);
  });
});

describe("MarketNamespace.cancelBuyOrder / getWalletDetails", () => {
  it("posts the buy_orderid and returns Steam's body", async () => {
    const { market, http } = makeMarket();
    http.reply({ body: { success: 1 } });
    expect(await market.cancelBuyOrder("555")).toEqual({ success: 1 });
    expect(http.requests[0]!.url).toBe("https://steamcommunity.com/market/cancelbuyorder/");
    expect(http.requests[0]!.opts.form).toEqual({ sessionid: "sess", buy_orderid: "555" });
  });

  it("throws on a non-200 cancel", async () => {
    const { market, http } = makeMarket();
    http.reply({ statusCode: 500 });
    await expect(market.cancelBuyOrder("555")).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("reads the wallet via IUserAccountService/GetClientWalletDetails", async () => {
    const response = { has_wallet: true, balance: "12345", currency_code: 3 };
    const { market, apiCalls } = makeMarket({ response });
    expect(await market.getWalletDetails()).toEqual(response);
    expect(apiCalls[0]).toEqual({
      httpMethod: "POST",
      iface: "IUserAccountService",
      method: "GetClientWalletDetails",
      input: { include_balance_in_usd: 1, include_formatted_balance: 1 },
    });
  });

  it("throws on a wallet response without a body", async () => {
    const { market } = makeMarket({});
    await expect(market.getWalletDetails()).rejects.toThrow(/wallet/);
  });
});

describe("MarketNamespace confirmations", () => {
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

  it("rejectListings rejects only the requested types (sell listings by default)", async () => {
    const { market, confirmations } = makeMarket();
    confirmations.pending = [
      conf("1", EConfirmationType.MarketListing, "A", 1),
      conf("2", EConfirmationType.BuyOrder, "B", 2),
      conf("3", EConfirmationType.Trade, "C", 3),
    ];
    expect((await market.rejectListings()).map((c) => c.id)).toEqual(["1"]);
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
    const eur = makeMarket({ response: { has_wallet: true, currency_code: 3 } });
    const usd = makeMarket({ response: { has_wallet: true, currency_code: 1 } });
    await eur.market.getWalletDetails();
    await usd.market.getWalletDetails();
    expect(eur.market.walletCurrency).toBe(3);
    expect(usd.market.walletCurrency).toBe(1);

    eur.http.reply(book(3), book(1));
    usd.http.reply(book(1), book(3));
    await expect(eur.market.getOrderbook(730, "X")).resolves.toMatchObject({ eCurrency: 3 });
    await expect(eur.market.getOrderbook(730, "X")).rejects.toThrow(/currency 1 != expected 3/);
    await expect(usd.market.getOrderbook(730, "X")).resolves.toMatchObject({ eCurrency: 1 });
    await expect(usd.market.getOrderbook(730, "X")).rejects.toThrow(/currency 3 != expected 1/);
  });

  it("does not learn a currency from a wallet without one", async () => {
    const { market } = makeMarket({ response: { has_wallet: false, currency_code: 0 } });
    await market.getWalletDetails();
    expect(market.walletCurrency).toBeUndefined();
  });

  it("sends the known currency with mylistings and createbuyorder; explicit values win", async () => {
    const { market, http } = makeMarket();
    market.walletCurrency = 1;
    http.reply(
      { body: { success: true, num_active_listings: 0, listings: [] } },
      { body: { success: 1, buy_orderid: "1" } },
      { body: { success: true, data: { eCurrency: 3 } } },
    );
    await market.getMyListings();
    await market.createBuyOrder({ appid: 730, marketHashName: "X", priceTotal: 5, quantity: 1 });
    await market.getOrderbook(730, "X", { expectedCurrency: 3 });
    expect(http.requests[0]!.opts.searchParams!.currency).toBe(1);
    expect(http.requests[1]!.opts.form!.currency).toBe(1);
  });

  it("refuses a buy order when the currency is unknown, before any request", async () => {
    const { market, http } = makeMarket();
    await expect(
      market.createBuyOrder({ appid: 730, marketHashName: "X", priceTotal: 5, quantity: 1 }),
    ).rejects.toThrow(/currency unknown/);
    expect(http.requests).toHaveLength(0);
  });
});
