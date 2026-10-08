import type { Confirmation, ConfirmationManager } from "../community/confirmations.js";
import { DEFAULT_CONTEXTID, URLS } from "../core/constants.js";
import { EConfirmationType, EResult } from "../core/enums.js";
import {
  MarketBlockedError,
  MarketConfirmationLimitError,
  SteamError,
  ThrottledError,
  WalletBalanceLimitError,
} from "../core/errors.js";
import type {
  RawCancelBuyOrderResponse,
  RawCreateBuyOrderResponse,
  RawMarketBuyOrder,
  RawMarketHistoryResponse,
  RawMarketListing,
  RawMarketSearchResponse,
  RawMarketSearchResult,
  RawMyListingsResponse,
  RawOrderbookData,
  RawPriceHistoryPoint,
  RawPriceHistoryResponse,
  RawSellItemResponse,
  RawWalletDetails,
} from "../core/types.js";
import { httpError } from "../http/checkers.js";
import type { HttpClient, HttpResponse } from "../http/HttpClient.js";
import type { WebApiClient } from "../http/webApi.js";
import type { SessionManager } from "../session/SessionManager.js";
import { type MarketHistory, parseMarketHistory } from "./history.js";

const LISTINGS_PAGE_SIZE = 100;
const MARKET_REFERER = `${URLS.community}/market/`;

export interface MyListings {
  listings: RawMarketListing[];
  listings_to_confirm: RawMarketListing[];
  buy_orders: RawMarketBuyOrder[];
  num_active_listings: number;
}

export interface SellItemOptions {
  appid: number;
  contextid?: string;
  assetid: string;
  amount?: number;
  // What the seller receives, in cents (wallet currency); the buyer pays this plus Steam's fees.
  price: number;
}

export interface CreateBuyOrderOptions {
  appid: number;
  marketHashName: string;
  // Price per unit × quantity, in cents.
  priceTotal: number;
  quantity: number;
  // Wallet currency id (1 = USD, 3 = EUR, …).
  currency: number;
}

export interface ConfirmListingsResult {
  confirmed: Confirmation[];
  skipped: Confirmation[];
}

interface OrderbookEnvelope {
  success?: boolean | number;
  data?: unknown;
  [key: string]: unknown;
}

// Steam Community Market (ported from SCM-autoseller's SteamApi). Retries and proxy rotation stay
// with the caller; failures surface as typed errors.
export class MarketNamespace {
  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionManager,
    private readonly confirmations: ConfirmationManager,
    private readonly api: WebApiClient,
  ) {}

  // Wallet balance + currency (currency_code) — the WebAPI form of the client's
  // UserAccount.GetClientWalletDetails call.
  async getWalletDetails(): Promise<RawWalletDetails> {
    const body = await this.api.call<{ response?: RawWalletDetails }>({
      httpMethod: "GET",
      iface: "IUserAccountService",
      method: "GetClientWalletDetails",
      input: { include_balance_in_usd: 1, include_formatted_balance: 1 },
    });
    if (!body.response) throw new SteamError("Malformed wallet details response", { body });
    return body.response;
  }

  // All active listings, paginated. Buy orders and listings awaiting confirmation ride whole on
  // every page, so they're taken from the first. Pass the wallet currency (as SCM-autoseller does).
  async getMyListings(options: { currency?: number } = {}): Promise<MyListings> {
    await this.session.getAccessToken();
    const result: MyListings = {
      listings: [],
      listings_to_confirm: [],
      buy_orders: [],
      num_active_listings: 0,
    };
    let start = 0;
    for (;;) {
      const res = await this.http.get<RawMyListingsResponse>(
        `${URLS.community}/market/mylistings/`,
        {
          responseType: "json",
          searchParams: {
            norender: 1,
            currency: options.currency,
            start,
            count: LISTINGS_PAGE_SIZE,
          },
        },
      );
      if (res.statusCode !== 200) throw httpError(res);
      const body = res.body;
      if (!body?.success) {
        throw new SteamError("Steam returned success=false for /market/mylistings", { body });
      }

      if (body.num_active_listings !== undefined) {
        result.num_active_listings = body.num_active_listings;
      }
      if (start === 0) {
        if (Array.isArray(body.buy_orders)) result.buy_orders = body.buy_orders;
        if (Array.isArray(body.listings_to_confirm)) {
          result.listings_to_confirm = body.listings_to_confirm;
        }
      }
      const page = body.listings ?? body.results?.listings ?? [];
      result.listings.push(...page);
      start += page.length;
      // Stop at the reported total, or on an empty page (an over-reported total).
      if (start >= result.num_active_listings || page.length === 0) return result;
    }
  }

  // Sales, purchases and listing events from the rendered history (`count` rows from `start`).
  async getMyHistory(options: { count?: number; start?: number } = {}): Promise<MarketHistory> {
    await this.session.getAccessToken();
    const res = await this.http.get<RawMarketHistoryResponse>(
      `${URLS.community}/market/myhistory`,
      {
        responseType: "json",
        searchParams: { count: options.count ?? 500, start: options.start },
      },
    );
    if (res.statusCode !== 200) throw httpError(res);
    if (!res.body?.success) {
      throw new SteamError("Steam returned success=false for /market/myhistory", {
        body: res.body,
      });
    }
    return parseMarketHistory(res.body);
  }

  // Live order book by appid + market_hash_name (no item_nameid needed). The endpoint always answers
  // in the wallet currency; pass expectedCurrency to refuse a book in any other one rather than
  // compare prices across currencies.
  async getOrderbook(
    appid: number,
    marketHashName: string,
    options: { expectedCurrency?: number } = {},
  ): Promise<RawOrderbookData> {
    await this.session.getAccessToken();
    // Names are encoded with encodeURIComponent throughout, byte-identical to SCM-autoseller.
    const qp = encodeURIComponent(JSON.stringify([appid, marketHashName]));
    const res = await this.http.get<OrderbookEnvelope>(
      `${URLS.community}/market/orderbook?q=Load&qp=${qp}`,
      { responseType: "json" },
    );
    if (res.statusCode === 403) throw new ThrottledError(undefined, { body: res.body });
    if (res.statusCode !== 200) throw httpError(res);

    const body = res.body;
    // Aug 2026: the payload moved inside an extra {"data": …} envelope; the flat shape still parses.
    const payload =
      body && body.success === undefined && body.data ? (body.data as OrderbookEnvelope) : body;
    if (!payload?.success || !payload.data) {
      throw new SteamError(`Bad orderbook response for ${marketHashName}`, { body });
    }
    const data = payload.data as RawOrderbookData;
    if (options.expectedCurrency && data.eCurrency !== options.expectedCurrency) {
      throw new SteamError(
        `Orderbook currency ${data.eCurrency} != expected ${options.expectedCurrency} for ${marketHashName}`,
        { body },
      );
    }
    return data;
  }

  // Price history rows (recent ones hourly, older daily), in the wallet currency.
  async getPriceHistory(appid: number, marketHashName: string): Promise<RawPriceHistoryPoint[]> {
    await this.session.getAccessToken();
    const res = await this.http.get<RawPriceHistoryResponse>(
      `${URLS.community}/market/pricehistory?appid=${appid}&market_hash_name=${encodeURIComponent(marketHashName)}`,
      { responseType: "json" },
    );
    if (res.statusCode !== 200) throw httpError(res);
    if (!res.body?.success) {
      throw new SteamError(`Steam returned success=false for pricehistory of ${marketHashName}`, {
        body: res.body,
      });
    }
    // Items without sales history may carry a non-array `prices`.
    return Array.isArray(res.body.prices) ? res.body.prices : [];
  }

  // The market-search row whose hash_name matches exactly (sell_listings = listing count,
  // asset_description.commodity), or null when the market has no such item.
  async getMarketItemDetails(
    appid: number,
    marketHashName: string,
  ): Promise<RawMarketSearchResult | null> {
    await this.session.getAccessToken();
    const query = encodeURIComponent(`"${marketHashName}"`);
    const res = await this.http.get<RawMarketSearchResponse>(
      `${URLS.community}/market/search/render/?query=${query}&start=0&count=10&search_descriptions=0&sort_column=quantity&sort_dir=desc&appid=${appid}&norender=1`,
      { responseType: "json" },
    );
    if (res.statusCode !== 200) throw httpError(res);
    const body = res.body;
    if (!body || typeof body !== "object") {
      throw new SteamError("Malformed market search response", { body });
    }
    const results = Array.isArray(body.results) ? body.results : [];
    return results.find((r) => r.hash_name === marketHashName) ?? null;
  }

  // List an item for sale; resolves with Steam's response. The listing still needs its mobile
  // confirmation (confirmListings). Refusals: MarketConfirmationLimitError, WalletBalanceLimitError,
  // MarketBlockedError, else SteamError with Steam's message.
  async sellItem(options: SellItemOptions): Promise<RawSellItemResponse> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<RawSellItemResponse>(`${URLS.community}/market/sellitem/`, {
      responseType: "json",
      form: {
        sessionid,
        appid: options.appid,
        contextid: options.contextid ?? DEFAULT_CONTEXTID,
        assetid: options.assetid,
        amount: options.amount ?? 1,
        price: options.price,
      },
      headers: { Referer: MARKET_REFERER },
    });
    const body = res.body;
    if (res.statusCode === 200 && (body?.success === true || body?.success === EResult.OK)) {
      return body;
    }
    if (res.statusCode === 429 || res.statusCode === 401) throw httpError(res);
    // Steam often answers a refusal with a non-200; classify its message first.
    if (body?.message) throw sellItemError(body.message, body);
    if (res.statusCode !== 200) throw httpError(res);
    throw new SteamError("Unknown error listing item", { ...eresultOf(body), body });
  }

  async cancelListing(listingId: string): Promise<void> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post(`${URLS.community}/market/removelisting/${listingId}`, {
      form: { sessionid },
      headers: { Referer: MARKET_REFERER },
    });
    // 200, or a 302 back to /market/, is success. Any other redirect (login, eligibility check)
    // means nothing was removed.
    if (res.statusCode === 200 || (res.statusCode === 302 && redirectsToMarket(res))) return;
    throw httpError(res);
  }

  // Steam's 3-step flow: createbuyorder(confirmation=0) → HTTP 406 + confirmation_id → accept that
  // mobile confirmation → createbuyorder again with confirmation=<id>. Trusted sessions succeed in
  // step 1. No retries by design: confirmation_id carries between steps, so retrying one step risks
  // orphaned confirmations or duplicate orders — re-run the whole flow. A failure after the
  // confirmation was accepted (step 3) may still have placed the order: check getMyListings first.
  // Resolves with the buy_orderid; a refusal is a SteamError carrying Steam's code (body.success).
  async createBuyOrder(options: CreateBuyOrderOptions): Promise<string> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const referer = `${URLS.community}/market/listings/${options.appid}/${encodeURIComponent(options.marketHashName)}`;
    const form: Record<string, string | number> = {
      sessionid,
      currency: options.currency,
      appid: options.appid,
      market_hash_name: options.marketHashName,
      price_total: options.priceTotal,
      quantity: options.quantity,
      confirmation: 0,
    };

    const first = await this.postBuyOrder(form, referer);
    const direct = buyOrderId(first);
    if (direct) return direct;

    const confirmationId = first.body?.confirmation?.confirmation_id;
    if (!confirmationId) {
      throw buyOrderError(first, `No confirmation_id (HTTP ${first.statusCode})`);
    }
    await this.confirmations.acceptConfirmationForObject(String(confirmationId));

    const final = await this.postBuyOrder(
      { ...form, confirmation: String(confirmationId) },
      referer,
    );
    const orderId = buyOrderId(final);
    if (orderId) return orderId;
    throw buyOrderError(final, `Finalization failed (HTTP ${final.statusCode})`);
  }

  // Resolves with Steam's response as-is; body.success is Steam's verdict on the order.
  async cancelBuyOrder(buyOrderId: string): Promise<RawCancelBuyOrderResponse> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<RawCancelBuyOrderResponse>(
      `${URLS.community}/market/cancelbuyorder/`,
      {
        responseType: "json",
        form: { sessionid, buy_orderid: buyOrderId },
        headers: { Referer: MARKET_REFERER },
      },
    );
    if (res.statusCode !== 200) throw httpError(res);
    return res.body ?? {};
  }

  // Accept the pending market-listing (sell) confirmations that match what we listed, in one
  // request. expected = { market_hash_name: listings created }. Oldest first: exact name, then a
  // substring fallback (the confirmation text can omit the wear — "StatTrak™ SCAR-20 | Caged" for
  // "… (Field-Tested)"). Unmatched ones stay pending and come back in `skipped`.
  async confirmListings(expected: Record<string, number>): Promise<ConfirmListingsResult> {
    const total = Object.values(expected).reduce((sum, n) => sum + n, 0);
    if (total === 0) return { confirmed: [], skipped: [] };

    await this.session.getAccessToken();
    const pending = await this.confirmations.getPending();
    const listings = pending
      .filter((c) => c.type === EConfirmationType.MarketListing)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const remaining = { ...expected };
    const confirmed: Confirmation[] = [];
    const skipped: Confirmation[] = [];
    for (const conf of listings) {
      const name =
        (remaining[conf.sending] ?? 0) > 0
          ? conf.sending
          : Object.keys(remaining).find(
              (n) => (remaining[n] ?? 0) > 0 && conf.sending !== "" && n.includes(conf.sending),
            );
      if (name === undefined) {
        skipped.push(conf);
        continue;
      }
      confirmed.push(conf);
      remaining[name] = (remaining[name] ?? 0) - 1;
    }

    await this.confirmations.acceptConfirmations(confirmed);
    return { confirmed, skipped };
  }

  // Reject every pending confirmation of the given type(s) in one request — e.g. stale sell
  // listings (MarketListing) or buy orders (BuyOrder). Other types are never touched.
  async rejectListings(
    types: EConfirmationType[] = [EConfirmationType.MarketListing],
  ): Promise<Confirmation[]> {
    await this.session.getAccessToken();
    const pending = await this.confirmations.getPending();
    const matched = pending.filter((c) => types.includes(c.type));
    await this.confirmations.rejectConfirmations(matched);
    return matched;
  }

  private async postBuyOrder(
    form: Record<string, string | number>,
    referer: string,
  ): Promise<HttpResponse<RawCreateBuyOrderResponse | undefined>> {
    // The 406 carries a valid JSON body (the confirmation_id), so statuses are judged after parsing.
    const res = await this.http.post<RawCreateBuyOrderResponse | undefined>(
      `${URLS.community}/market/createbuyorder/`,
      { responseType: "json", form, headers: { Referer: referer } },
    );
    if (res.statusCode === 429 || res.statusCode === 401) throw httpError(res);
    return res;
  }
}

function redirectsToMarket(res: HttpResponse<unknown>): boolean {
  const location = res.headers.location;
  if (typeof location !== "string" || !URL.canParse(location, URLS.community)) return false;
  const { pathname } = new URL(location, URLS.community);
  return pathname === "/market/" || pathname === "/market";
}

function eresultOf(body: { success?: boolean | number } | undefined): { eresult?: number } {
  const success = body?.success;
  return typeof success === "number" && success !== EResult.OK ? { eresult: success } : {};
}

function sellItemError(message: string, body: RawSellItemResponse): SteamError {
  const options = { ...eresultOf(body), body };
  const lower = message.toLowerCase();
  if (lower.includes("pending confirmation")) {
    return new MarketConfirmationLimitError(message, options);
  }
  if (lower.includes("maximum wallet balance"))
    return new WalletBalanceLimitError(message, options);
  if (lower.includes("unable to use the community market")) {
    return new MarketBlockedError(message, options);
  }
  return new SteamError(message, options);
}

function buyOrderId(res: HttpResponse<RawCreateBuyOrderResponse | undefined>): string | undefined {
  const body = res.body;
  const ok =
    body?.success === EResult.OK || body?.success === true || body?.wallet_info?.success === 1;
  return res.statusCode === 200 && ok && body?.buy_orderid ? String(body.buy_orderid) : undefined;
}

function buyOrderError(
  res: HttpResponse<RawCreateBuyOrderResponse | undefined>,
  fallback: string,
): SteamError {
  const body = res.body;
  const eresult = eresultOf(body);
  // No Steam verdict in the body: classify the transport status (expired session, etc.).
  if (!body?.message && eresult.eresult === undefined && ![200, 406].includes(res.statusCode)) {
    return httpError(res);
  }
  return new SteamError(body?.message || fallback, { ...eresult, body });
}
