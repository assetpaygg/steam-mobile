import type { Confirmation, ConfirmationManager } from "../community/confirmations.js";
import { DEFAULT_CONTEXTID, URLS } from "../core/constants.js";
import { EConfirmationType, EResult } from "../core/enums.js";
import {
  BuyOrderError,
  ConfirmationError,
  ConfirmationOutcomeUnknownError,
  CurrencyMismatchError,
  MarketBlockedError,
  MarketConfirmationLimitError,
  MarketIneligibleError,
  MarketItemUnavailableError,
  RateLimitError,
  SteamError,
  SteamSessionExpiredError,
  ThrottledError,
  WalletBalanceLimitError,
  WalletCurrencyUnknownError,
} from "../core/errors.js";
import type {
  RawCancelBuyOrderResponse,
  RawCreateBuyOrderResponse,
  RawMarketBuyOrder,
  RawMarketHistoryResponse,
  RawMarketListing,
  RawMarketSearchResponse,
  RawMarketSearchResult,
  RawMarketWalletInfo,
  RawMyListingsResponse,
  RawOrderbookData,
  RawPriceHistoryPoint,
  RawPriceHistoryResponse,
  RawSellItemResponse,
  RawWalletDetails,
} from "../core/types.js";
import { httpError } from "../http/checkers.js";
import {
  type HttpClient,
  type HttpResponse,
  type RequestControl,
  requestControl,
} from "../http/HttpClient.js";
import type { WebApiClient } from "../http/webApi.js";
import type { SessionManager } from "../session/SessionManager.js";
import { type MarketHistory, parseMarketHistory, priceTextCurrency } from "./history.js";

const LISTINGS_PAGE_SIZE = 100;
const MARKET_REFERER = `${URLS.community}/market/`;
// A listing's currencyid is 2000 + the seller's wallet currency (2001 = USD, 2003 = EUR).
const LISTING_CURRENCY_BASE = 2000;
// Steam can take a moment to list a buy order's mobile confirmation after the 406.
const BUY_ORDER_CONFIRMATION_LOOKUPS = [0, 1000, 2500];
// Steam codes proven to mean "the buy order was NOT placed": 15 access denied (market blocked),
// 25 order limit (wallet × 10), 107 insufficient funds. Every other verdict leaves it possible.
const BUY_ORDER_NOT_PLACED_CODES: ReadonlySet<number> = new Set([15, 25, 107]);
// Steam's own words for an unknown outcome ("…trouble hearing back from the Steam servers about your
// order. Double check whether or not your order has actually been created…").
const UNKNOWN_OUTCOME_RE = /hearing back|double check/i;
const DUPLICATE_ORDER_CODE = 29;

// Per-call controls for every market method: abort, and a timeout tighter than the 50s default.
export type MarketCallOptions = RequestControl;

export interface MyListings {
  listings: RawMarketListing[];
  listings_to_confirm: RawMarketListing[];
  listings_on_hold: RawMarketListing[];
  buy_orders: RawMarketBuyOrder[];
  num_active_listings: number;
  // False when the result can't be trusted as a full census: the pages did not add up to
  // num_active_listings, the total moved between pages (rows shifted), or the first page carried no
  // buy_orders array. Never read "absent from an incomplete census" as sold, cancelled or filled.
  complete: boolean;
}

export interface SellItemOptions extends MarketCallOptions {
  appid: number;
  contextid?: string;
  assetid: string;
  amount?: number;
  // What the seller receives, in cents of the wallet currency; the buyer pays this plus Steam's fees.
  price: number;
  // The currency `price` was computed in. Must equal the wallet currency; defaults to it.
  currency?: number;
}

export interface CreateBuyOrderOptions extends MarketCallOptions {
  appid: number;
  marketHashName: string;
  // Price per unit × quantity, in cents (buyer pays).
  priceTotal: number;
  quantity: number;
  // Wallet currency id (1 = USD, 3 = EUR, …). Must equal the wallet currency; defaults to it.
  currency?: number;
}

export interface ConfirmListingsResult {
  confirmed: Confirmation[];
  skipped: Confirmation[];
}

export interface ConfirmListingIdsResult {
  confirmed: Confirmation[];
  // Listing ids with no pending market-listing confirmation (already confirmed, or not yet listed).
  missing: string[];
}

// The /market/orderbook best levels, null-safe: an empty side is null, never 0 or NaN.
export interface OrderbookSummary {
  currency: number;
  lowestAsk: number | null;
  askVolumeAtLowest: number;
  secondLowestAsk: number | null;
  highestBid: number | null;
  bidVolumeAtHighest: number;
  secondHighestBid: number | null;
}

interface OrderbookEnvelope {
  success?: boolean | number;
  data?: unknown;
  [key: string]: unknown;
}

// Steam Community Market (ported from SCM-autoseller's SteamApi). Retries and proxy rotation stay
// with the caller; failures surface as typed errors. Every price is integer cents in the wallet
// currency, and every currency-dependent call fails closed when that currency is unknown or differs.
export class MarketNamespace {
  // Wallet currency id (1 = USD, 3 = EUR, …): seeded through SteamMobileOptions.walletCurrency /
  // seedWalletCurrency(), or learned by getWalletDetails(). Once known it can only be confirmed,
  // never replaced. Writes also need it VERIFIED by a live read in this session (the wallet, an order
  // book, our buy orders or listings answering in it), so a wrong seed can't price a write.
  private currency: number | undefined;
  private currencyVerified = false;

  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionManager,
    private readonly confirmations: ConfirmationManager,
    private readonly api: WebApiClient,
  ) {}

  get walletCurrency(): number | undefined {
    return this.currency;
  }

  get walletCurrencyVerified(): boolean {
    return this.currencyVerified;
  }

  // A currency known from storage. It is checked against every read from the first one, and a live
  // read must still confirm it before any write.
  seedWalletCurrency(currency: number): void {
    if (!Number.isInteger(currency) || currency <= 0) {
      throw new RangeError(`walletCurrency must be a positive integer, got ${currency}`);
    }
    if (this.currency !== undefined && this.currency !== currency) {
      throw new CurrencyMismatchError(this.currency, currency, "seedWalletCurrency");
    }
    this.currency = currency;
  }

  // Wallet balance + currency (currency_code) — the WebAPI form of the client's
  // UserAccount.GetClientWalletDetails call (POST-only: GET answers 405). The authoritative source:
  // learns and verifies the currency of a wallet that exists; a currency different from the known
  // one throws CurrencyMismatchError instead of silently switching.
  async getWalletDetails(options: MarketCallOptions = {}): Promise<RawWalletDetails> {
    const body = await this.api.call<{ response?: RawWalletDetails }>({
      httpMethod: "POST",
      iface: "IUserAccountService",
      method: "GetClientWalletDetails",
      input: { include_balance_in_usd: 1, include_formatted_balance: 1 },
      ...requestControl(options),
    });
    if (!body.response) throw new SteamError("Malformed wallet details response", { body });
    const currency = body.response.currency_code;
    if (body.response.has_wallet === true && typeof currency === "number" && currency > 0) {
      this.learnCurrency(currency, "wallet details");
    }
    return body.response;
  }

  // g_rgWalletInfo from the market page: the fee parameters (wallet_fee_percent,
  // wallet_publisher_fee_percent_default, wallet_fee_minimum, wallet_fee_base) and the balance caps
  // (wallet_max_balance, wallet_trade_max_balance), all in the wallet currency. Only from a page
  // rendered for THIS account (a logged-out page carries a default USD wallet), and it never teaches
  // the currency - a known one must match it.
  async getMarketWalletInfo(options: MarketCallOptions = {}): Promise<RawMarketWalletInfo> {
    await this.session.getAccessToken();
    const res = await this.http.get(`${URLS.community}/market/`, requestControl(options));
    if (res.statusCode !== 200) throw httpError(res);
    const pageSteamId = res.body.match(/g_steamID\s*=\s*"(\d+)"/)?.[1];
    if (pageSteamId !== this.session.steamID.getSteamID64()) {
      throw new SteamSessionExpiredError("market page was not rendered for this account");
    }
    const match = res.body.match(/g_rgWalletInfo\s*=\s*(\{[^;]*?\});/);
    if (!match?.[1]) throw new SteamError("g_rgWalletInfo not found on the market page");
    let info: RawMarketWalletInfo;
    try {
      info = JSON.parse(match[1]) as RawMarketWalletInfo;
    } catch {
      throw new SteamError("g_rgWalletInfo on the market page is not valid JSON");
    }
    const currency = Number(info.wallet_currency);
    if (this.currency !== undefined && currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, currency, "g_rgWalletInfo");
    }
    return info;
  }

  // All active listings, paginated. Buy orders and listings awaiting confirmation ride whole on
  // every page, so they're taken from the first. currency defaults to walletCurrency (null = do not
  // send one and skip the currency checks). Listings are deduplicated by listingid.
  async getMyListings(
    options: { currency?: number | null } & MarketCallOptions = {},
  ): Promise<MyListings> {
    const currency = this.readCurrency(options.currency, "mylistings");
    await this.session.getAccessToken();
    const result: MyListings = {
      listings: [],
      listings_to_confirm: [],
      listings_on_hold: [],
      buy_orders: [],
      num_active_listings: 0,
      complete: false,
    };
    const seen = new Set<string>();
    let firstTotal: number | undefined;
    let totalMoved = false;
    let buyOrdersMissing = false;
    let start = 0;
    for (;;) {
      const res = await this.http.get<RawMyListingsResponse>(
        `${URLS.community}/market/mylistings/`,
        {
          ...requestControl(options),
          responseType: "json",
          searchParams: {
            norender: 1,
            currency: currency ?? undefined,
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
        if (firstTotal === undefined) firstTotal = body.num_active_listings;
        else if (body.num_active_listings !== firstTotal) totalMoved = true;
      }
      if (start === 0) {
        if (Array.isArray(body.buy_orders)) result.buy_orders = body.buy_orders;
        else buyOrdersMissing = true;
        if (Array.isArray(body.listings_to_confirm)) {
          result.listings_to_confirm = body.listings_to_confirm;
        }
        if (Array.isArray(body.listings_on_hold)) result.listings_on_hold = body.listings_on_hold;
      }
      const page = body.listings ?? body.results?.listings ?? [];
      for (const listing of page) {
        if (seen.has(listing.listingid)) continue;
        seen.add(listing.listingid);
        result.listings.push(listing);
      }
      start += page.length;
      // Stop at the reported total, or on an empty page (an over-reported total).
      if (start >= result.num_active_listings || page.length === 0) break;
    }
    result.complete =
      !totalMoved && !buyOrdersMissing && result.listings.length === result.num_active_listings;
    if (currency !== null) {
      for (const order of result.buy_orders) {
        const actual = Number(order.wallet_currency);
        if (actual !== currency) throw new CurrencyMismatchError(currency, actual, "buy orders");
      }
      const all = [...result.listings, ...result.listings_to_confirm, ...result.listings_on_hold];
      for (const listing of all) assertListingCurrency(listing, currency);
      if (result.buy_orders.length > 0 || all.length > 0) this.confirmCurrency(currency);
    }
    return result;
  }

  // Sales, purchases and listing events from the rendered history (`count` rows from `start`). A row
  // priced in anything but `currency` (default walletCurrency; null skips the check; checked for USD
  // and EUR, the formats priceTextCurrency pins) is moved to `malformed` as other_currency: it is never
  // returned as money, and the rest of the page still is. An account that changed currency keeps its
  // old rows in the old one, and refusing the whole page left such an account unreadable for good.
  async getMyHistory(
    options: { count?: number; start?: number; currency?: number | null } & MarketCallOptions = {},
  ): Promise<MarketHistory> {
    const currency = this.readCurrency(options.currency, "myhistory");
    await this.session.getAccessToken();
    const res = await this.http.get<RawMarketHistoryResponse>(
      `${URLS.community}/market/myhistory`,
      {
        ...requestControl(options),
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
    const history = parseMarketHistory(res.body);
    if (currency !== null && PINNED_PRICE_FORMATS.has(currency)) {
      const other = new Set(
        history.events
          .filter((e) => e.displayPrice && priceTextCurrency(e.displayPrice) !== currency)
          .map((e) => e.historyId),
      );
      if (other.size > 0) {
        for (const e of history.events) {
          if (!other.has(e.historyId)) continue;
          history.malformed.push({
            historyId: e.historyId,
            displayPrice: e.displayPrice,
            gainOrLoss: e.type === "sale" ? "-" : e.type === "purchase" ? "+" : "",
            reason: "other_currency",
          });
        }
        const keep = <T extends { historyId: string }>(rows: T[]) =>
          rows.filter((r) => !other.has(r.historyId));
        history.events = keep(history.events);
        history.sales = keep(history.sales);
        history.purchases = keep(history.purchases);
        history.listingEvents = keep(history.listingEvents);
      }
    }
    return history;
  }

  // Live order book by appid + market_hash_name (no item_nameid needed). The endpoint answers in the
  // wallet currency; a book in any currency other than expectedCurrency (default: walletCurrency;
  // null skips the check) throws CurrencyMismatchError rather than have prices compared across them.
  async getOrderbook(
    appid: number,
    marketHashName: string,
    options: { expectedCurrency?: number | null } & MarketCallOptions = {},
  ): Promise<RawOrderbookData> {
    const expected = this.readCurrency(options.expectedCurrency, "orderbook");
    await this.session.getAccessToken();
    // Names are encoded with encodeURIComponent throughout, byte-identical to SCM-autoseller.
    const qp = encodeURIComponent(JSON.stringify([appid, marketHashName]));
    const res = await this.http.get<OrderbookEnvelope>(
      `${URLS.community}/market/orderbook?q=Load&qp=${qp}`,
      { ...requestControl(options), responseType: "json" },
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
    if (expected !== null) {
      if (data.eCurrency !== expected) {
        throw new CurrencyMismatchError(expected, data.eCurrency, `orderbook of ${marketHashName}`);
      }
      this.confirmCurrency(expected);
    }
    return data;
  }

  // Price history rows (recent ones hourly, older daily) in the wallet currency: [date, price in
  // MAJOR units (float), volume]. The response's currency markers must match expectedCurrency
  // (default walletCurrency; null skips) for USD and EUR.
  async getPriceHistory(
    appid: number,
    marketHashName: string,
    options: { expectedCurrency?: number | null } & MarketCallOptions = {},
  ): Promise<RawPriceHistoryPoint[]> {
    const expected = this.readCurrency(options.expectedCurrency, "pricehistory");
    await this.session.getAccessToken();
    const res = await this.http.get<RawPriceHistoryResponse>(
      `${URLS.community}/market/pricehistory?appid=${appid}&market_hash_name=${encodeURIComponent(marketHashName)}`,
      { ...requestControl(options), responseType: "json" },
    );
    if (res.statusCode !== 200) throw httpError(res);
    if (!res.body?.success) {
      throw new SteamError(`Steam returned success=false for pricehistory of ${marketHashName}`, {
        body: res.body,
      });
    }
    if (expected !== null && PINNED_PRICE_FORMATS.has(expected)) {
      const actual = priceHistoryCurrency(res.body.price_prefix, res.body.price_suffix);
      if (actual !== expected) {
        throw new CurrencyMismatchError(expected, actual, `pricehistory of ${marketHashName}`);
      }
    }
    // Items without sales history may carry a non-array `prices`.
    return Array.isArray(res.body.prices) ? res.body.prices : [];
  }

  // The market-search row whose hash_name matches exactly (sell_listings = listing count,
  // asset_description.commodity), or null when the market has no such item. A success=false answer
  // throws, so a soft-throttled reply is never read as "not on the market".
  async getMarketItemDetails(
    appid: number,
    marketHashName: string,
    options: MarketCallOptions = {},
  ): Promise<RawMarketSearchResult | null> {
    await this.session.getAccessToken();
    const query = encodeURIComponent(`"${marketHashName}"`);
    const res = await this.http.get<RawMarketSearchResponse>(
      `${URLS.community}/market/search/render/?query=${query}&start=0&count=10&search_descriptions=0&sort_column=quantity&sort_dir=desc&appid=${appid}&norender=1`,
      { ...requestControl(options), responseType: "json" },
    );
    if (res.statusCode !== 200) throw httpError(res);
    const body = res.body;
    if (!body || typeof body !== "object" || body.success === false) {
      throw new SteamError("Malformed or unsuccessful market search response", { body });
    }
    const results = Array.isArray(body.results) ? body.results : [];
    return results.find((r) => r.hash_name === marketHashName) ?? null;
  }

  // List an item for sale; resolves with Steam's response. The listing still needs its mobile
  // confirmation (confirmListingIds). Refusals: MarketConfirmationLimitError (with its reason),
  // WalletBalanceLimitError, MarketBlockedError, MarketItemUnavailableError, else SteamError with
  // Steam's message. A transport failure (timeout, proxy, abort) leaves the outcome unknown: read
  // getMyListings() before listing the asset again.
  async sellItem(options: SellItemOptions): Promise<RawSellItemResponse> {
    this.writeCurrency(options.currency, "sellitem");
    assertPositiveCents("price", options.price);
    const amount = options.amount ?? 1;
    assertPositiveCents("amount", amount);
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<RawSellItemResponse>(`${URLS.community}/market/sellitem/`, {
      ...requestControl(options),
      noEligibilityReplay: true,
      responseType: "json",
      form: {
        sessionid,
        appid: options.appid,
        contextid: options.contextid ?? DEFAULT_CONTEXTID,
        assetid: options.assetid,
        amount,
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

  async cancelListing(listingId: string, options: MarketCallOptions = {}): Promise<void> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post(`${URLS.community}/market/removelisting/${listingId}`, {
      ...requestControl(options),
      noEligibilityReplay: true,
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
  // step 1. No step is ever retried: re-run the whole flow, and only after reading getMyListings()
  // when an error says mayExist. Resolves with the buy_orderid.
  //
  // Errors: RateLimitError / SteamSessionExpiredError / MarketIneligibleError from step 1 = nothing
  // was placed. MarketBlockedError (Steam code 15, any step) = refused, account-level. Everything
  // else is a BuyOrderError carrying its stage, Steam's code and whether the order may exist.
  async createBuyOrder(options: CreateBuyOrderOptions): Promise<string> {
    const currency = this.writeCurrency(options.currency, "createbuyorder");
    assertPositiveCents("quantity", options.quantity);
    assertPositiveCents("priceTotal", options.priceTotal);
    if (options.priceTotal % options.quantity !== 0) {
      throw new RangeError("priceTotal must be the per-unit price times quantity");
    }
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const referer = `${URLS.community}/market/listings/${options.appid}/${encodeURIComponent(options.marketHashName)}`;
    const form: Record<string, string | number> = {
      sessionid,
      currency,
      appid: options.appid,
      market_hash_name: options.marketHashName,
      price_total: options.priceTotal,
      quantity: options.quantity,
      confirmation: 0,
    };

    let first: BuyOrderReply;
    try {
      first = await this.postBuyOrder(form, referer, options);
    } catch (err) {
      if (isNotPlacedError(err)) throw err;
      throw new BuyOrderError("createbuyorder request failed", {
        stage: "create",
        mayExist: true,
        cause: err,
      });
    }
    if (first.buyOrderId) return first.buyOrderId;
    const confirmationId = first.confirmationId;
    if (!confirmationId) throw buyOrderRefusal(first, "create");

    await this.acceptBuyOrderConfirmation(confirmationId, options);

    let final: BuyOrderReply;
    try {
      final = await this.postBuyOrder({ ...form, confirmation: confirmationId }, referer, options);
    } catch (err) {
      throw new BuyOrderError("createbuyorder finalize request failed", {
        stage: "finalize",
        mayExist: true,
        confirmationId,
        cause: err,
      });
    }
    if (final.buyOrderId) return final.buyOrderId;
    throw buyOrderRefusal(final, "finalize", confirmationId);
  }

  // Cancel a buy order. Resolves with Steam's body when it reports success; any other verdict throws
  // a SteamError carrying Steam's code — read getMyListings() to see whether the order is still up.
  async cancelBuyOrder(
    buyOrderId: string,
    options: MarketCallOptions = {},
  ): Promise<RawCancelBuyOrderResponse> {
    await this.session.getAccessToken();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<RawCancelBuyOrderResponse>(
      `${URLS.community}/market/cancelbuyorder/`,
      {
        ...requestControl(options),
        noEligibilityReplay: true,
        responseType: "json",
        form: { sessionid, buy_orderid: buyOrderId },
        headers: { Referer: MARKET_REFERER },
      },
    );
    if (res.statusCode !== 200) throw httpError(res);
    const body = res.body ?? {};
    if (body.success === EResult.OK || body.success === true) return body;
    throw new SteamError(`cancelbuyorder refused for ${buyOrderId}`, { ...eresultOf(body), body });
  }

  // Accept exactly the pending market-listing confirmations created by these listing ids (a listing
  // confirmation's creator is its listing id), in one request. Nothing else is ever confirmed.
  async confirmListingIds(
    listingIds: string[],
    options: MarketCallOptions = {},
  ): Promise<ConfirmListingIdsResult> {
    const wanted = new Set(listingIds.map(String));
    if (wanted.size === 0) return { confirmed: [], missing: [] };
    await this.session.getAccessToken();
    const pending = await this.confirmations.getPending(options);
    const confirmed = pending.filter(
      (c) => c.type === EConfirmationType.MarketListing && wanted.has(c.creator),
    );
    await this.confirmations.acceptConfirmations(confirmed, options);
    const found = new Set(confirmed.map((c) => c.creator));
    return { confirmed, missing: [...wanted].filter((id) => !found.has(id)) };
  }

  // Name-based fallback (SCM-autoseller's matching): accept pending market-listing confirmations
  // that match what we listed, in one request. expected = { market_hash_name: listings created }.
  // Oldest first: exact name, then a substring fallback (the confirmation text can omit the wear —
  // "StatTrak™ SCAR-20 | Caged" for "… (Field-Tested)"). It cannot tell two listings of one name
  // apart and never checks the price: prefer confirmListingIds.
  async confirmListings(
    expected: Record<string, number>,
    options: MarketCallOptions = {},
  ): Promise<ConfirmListingsResult> {
    const total = Object.values(expected).reduce((sum, n) => sum + n, 0);
    if (total === 0) return { confirmed: [], skipped: [] };

    await this.session.getAccessToken();
    const pending = await this.confirmations.getPending(options);
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

    await this.confirmations.acceptConfirmations(confirmed, options);
    return { confirmed, skipped };
  }

  // Reject every pending confirmation of the given type(s) in one request — e.g. stale sell
  // listings (MarketListing) or buy orders (BuyOrder) — except those whose creator is in
  // keepCreators (work still in flight). Other types are never touched.
  async rejectListings(
    types: EConfirmationType[] = [EConfirmationType.MarketListing],
    options: { keepCreators?: string[] } & MarketCallOptions = {},
  ): Promise<Confirmation[]> {
    await this.session.getAccessToken();
    const keep = new Set((options.keepCreators ?? []).map(String));
    const pending = await this.confirmations.getPending(options);
    const matched = pending.filter((c) => types.includes(c.type) && !keep.has(c.creator));
    await this.confirmations.rejectConfirmations(matched, options);
    return matched;
  }

  private async acceptBuyOrderConfirmation(
    confirmationId: string,
    options: MarketCallOptions,
  ): Promise<void> {
    let conf: Confirmation | undefined;
    try {
      for (const delay of BUY_ORDER_CONFIRMATION_LOOKUPS) {
        if (delay > 0) await sleep(delay, options.signal);
        conf = (await this.confirmations.getPending(options)).find(
          (c) => c.creator === confirmationId && c.type === EConfirmationType.BuyOrder,
        );
        if (conf) break;
      }
    } catch (err) {
      throw new BuyOrderError("could not read the buy order's mobile confirmation", {
        stage: "confirm",
        mayExist: false,
        confirmationId,
        cause: err,
      });
    }
    if (!conf) {
      throw new BuyOrderError(`no mobile confirmation found for buy order ${confirmationId}`, {
        stage: "confirm",
        mayExist: false,
        confirmationId,
      });
    }
    try {
      await this.confirmations.acceptConfirmations([conf], options);
    } catch (err) {
      // Steam answering "not accepted" means the order cannot go through; anything else (timeout,
      // proxy, abort, an unreadable answer) may have accepted it, after which Steam could still
      // place the order.
      const refused =
        err instanceof ConfirmationError && !(err instanceof ConfirmationOutcomeUnknownError);
      throw new BuyOrderError("accepting the buy order's mobile confirmation failed", {
        stage: "confirm",
        mayExist: !refused,
        confirmationId,
        cause: err,
      });
    }
  }

  private async postBuyOrder(
    form: Record<string, string | number>,
    referer: string,
    control: MarketCallOptions,
  ): Promise<BuyOrderReply> {
    // Read as text: the ids are 64-bit and must not pass through a JS number. The 406 carries a valid
    // JSON body (the confirmation_id), so statuses are judged after parsing.
    const res = await this.http.post(`${URLS.community}/market/createbuyorder/`, {
      ...requestControl(control),
      noEligibilityReplay: true,
      form,
      headers: { Referer: referer },
    });
    if (res.statusCode === 429 || res.statusCode === 401) throw httpError(res);
    const raw = typeof res.body === "string" ? res.body : "";
    const body = safeJson(raw) as RawCreateBuyOrderResponse | undefined;
    // wallet_info.success speaks only when Steam gave no verdict of its own.
    const ok =
      body?.success === EResult.OK ||
      body?.success === true ||
      (body?.success === undefined && body?.wallet_info?.success === 1);
    const buyOrderId =
      res.statusCode === 200 && ok ? (rawIdField(raw, "buy_orderid") ?? undefined) : undefined;
    const confirmationId = rawIdField(raw, "confirmation_id") ?? undefined;
    return { res, body, buyOrderId, confirmationId };
  }

  // The currency a read must be in: explicit (null = unchecked), else the known wallet currency.
  private readCurrency(explicit: number | null | undefined, context: string): number | null {
    if (explicit === null) return null;
    const known = this.currency;
    if (explicit !== undefined) {
      if (known !== undefined && explicit !== known) {
        throw new CurrencyMismatchError(known, explicit, context);
      }
      return explicit;
    }
    if (known === undefined) throw new WalletCurrencyUnknownError(context);
    return known;
  }

  // A write needs the wallet currency known AND verified live in this session, and any currency the
  // caller priced in to equal it.
  private writeCurrency(explicit: number | undefined, context: string): number {
    const known = this.currency;
    if (known === undefined || !this.currencyVerified) {
      throw new WalletCurrencyUnknownError(context);
    }
    if (explicit !== undefined && explicit !== known) {
      throw new CurrencyMismatchError(known, explicit, context);
    }
    return known;
  }

  private learnCurrency(currency: number, context: string): void {
    if (this.currency !== undefined && this.currency !== currency) {
      throw new CurrencyMismatchError(this.currency, currency, context);
    }
    this.currency = currency;
    this.currencyVerified = true;
  }

  // A live read answered in the known currency.
  private confirmCurrency(currency: number): void {
    if (this.currency === currency) this.currencyVerified = true;
  }
}

interface BuyOrderReply {
  res: HttpResponse<string>;
  body: RawCreateBuyOrderResponse | undefined;
  buyOrderId: string | undefined;
  confirmationId: string | undefined;
}

// The best levels of an order book (integer cents; flat [price, qty, …] depth, sells ascending, buys
// descending), read fail-closed: every value must be a whole number, levels strictly ordered with
// positive prices and quantities, and the best price must agree with the depth. An empty side is
// null, never 0 — chasing a 0-cent "ask" would list for nothing. Anything else throws.
export function summarizeOrderbook(data: RawOrderbookData): OrderbookSummary {
  const sells = depth(data.rgCompactSellOrders, "asc");
  const buys = depth(data.rgCompactBuyOrders, "desc");
  return {
    currency: data.eCurrency,
    lowestAsk: level(data.amtMinSellOrder, sells),
    askVolumeAtLowest: sells[1] ?? 0,
    secondLowestAsk: sells.length >= 4 ? (sells[2] ?? null) : null,
    highestBid: level(data.amtMaxBuyOrder, buys),
    bidVolumeAtHighest: buys[1] ?? 0,
    secondHighestBid: buys.length >= 4 ? (buys[2] ?? null) : null,
  };
}

function wholeCents(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) ? v : null;
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function depth(raw: unknown, order: "asc" | "desc"): number[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length % 2 !== 0) {
    throw new SteamError("Malformed orderbook depth", { body: raw });
  }
  const out: number[] = [];
  for (const v of raw) {
    const n = wholeCents(v);
    if (n === null || n <= 0) throw new SteamError("Malformed orderbook depth", { body: raw });
    out.push(n);
  }
  for (let i = 2; i < out.length; i += 2) {
    const prev = out[i - 2] as number;
    const cur = out[i] as number;
    if (order === "asc" ? cur <= prev : cur >= prev) {
      throw new SteamError("Orderbook depth is not strictly ordered", { body: raw });
    }
  }
  return out;
}

function level(best: unknown, levels: number[]): number | null {
  if (best === null || best === undefined) {
    if (levels.length > 0) throw new SteamError("Orderbook has depth but no best level");
    return null;
  }
  const value = wholeCents(best);
  if (value === null || value <= 0) throw new SteamError(`Malformed orderbook best level ${best}`);
  if (levels.length === 0 || levels[0] !== value) {
    throw new SteamError(`Orderbook best level ${value} disagrees with its depth ${levels[0]}`);
  }
  return value;
}

// Currencies whose rendered price formats are pinned (priceTextCurrency / pricehistory markers).
const PINNED_PRICE_FORMATS = new Set([1, 3]);

// pricehistory's markers: USD "$" + "" → 1, EUR "" + "€" → 3; undefined for anything else.
function priceHistoryCurrency(prefix: unknown, suffix: unknown): number | undefined {
  const p = typeof prefix === "string" ? prefix.trim() : "";
  const s = typeof suffix === "string" ? suffix.trim() : "";
  if (p === "$" && s === "") return 1;
  if (p === "" && s === "€") return 3;
  return undefined;
}

function assertListingCurrency(listing: RawMarketListing, currency: number): void {
  const raw = listing.currencyid;
  const actual =
    raw === undefined || raw === null ? undefined : Number(raw) - LISTING_CURRENCY_BASE;
  if (actual !== currency) {
    throw new CurrencyMismatchError(currency, actual, `listing ${listing.listingid}`);
  }
}

function assertPositiveCents(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

// Step-1 errors that prove nothing was placed: the request was refused before Steam acted on it.
function isNotPlacedError(err: unknown): boolean {
  return (
    err instanceof RateLimitError ||
    err instanceof SteamSessionExpiredError ||
    err instanceof MarketIneligibleError
  );
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
    const reason = lower.includes("already have a listing")
      ? "item_pending"
      : lower.includes("too many")
        ? "too_many_pending"
        : "unknown";
    return new MarketConfirmationLimitError(message, { ...options, reason });
  }
  if (lower.includes("maximum wallet balance"))
    return new WalletBalanceLimitError(message, options);
  if (lower.includes("unable to use the community market")) {
    return new MarketBlockedError(message, options);
  }
  if (lower.includes("no longer in your inventory") || lower.includes("not allowed to be traded")) {
    return new MarketItemUnavailableError(message, options);
  }
  return new SteamError(message, options);
}

// A createbuyorder reply that carries no order id. Code 15 / "unable to use the Community Market" is
// an account-level refusal. Otherwise mayExist stays true unless Steam gave one of the codes proven
// to mean "not placed" and nothing in its words says the outcome is unknown; 29 means an order for
// this item already exists.
function buyOrderRefusal(
  reply: BuyOrderReply,
  stage: "create" | "finalize",
  confirmationId?: string,
): SteamError {
  const { res, body } = reply;
  const code =
    typeof body?.success === "number" && body.success !== EResult.OK ? body.success : undefined;
  const message = typeof body?.message === "string" ? body.message : undefined;
  if (
    code === EResult.AccessDenied ||
    message?.toLowerCase().includes("unable to use the community market")
  ) {
    return new MarketBlockedError(message, {
      ...(code !== undefined ? { eresult: code } : {}),
      body,
    });
  }
  if (code === undefined && message === undefined && stage === "create") {
    if (![200, 406].includes(res.statusCode)) {
      // No Steam verdict on a step-1 reply: classify the transport status. A login or eligibility
      // redirect means nothing was placed; anything else stays unknown.
      const transport = httpError(res);
      if (isNotPlacedError(transport)) return transport;
    }
  }
  const unknownOutcome = message !== undefined && UNKNOWN_OUTCOME_RE.test(message);
  const notPlaced = code !== undefined && BUY_ORDER_NOT_PLACED_CODES.has(code) && !unknownOutcome;
  const orderExists =
    code === DUPLICATE_ORDER_CODE ||
    (message !== undefined && /already have an active buy order/i.test(message));
  return new BuyOrderError(message ?? `createbuyorder ${stage} failed (HTTP ${res.statusCode})`, {
    stage,
    mayExist: !notPlaced,
    orderExists,
    ...(code !== undefined ? { code } : {}),
    ...(confirmationId !== undefined ? { confirmationId } : {}),
    body: body ?? res.body,
  });
}

function safeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// A numeric id field read from the raw JSON text, so a 64-bit id keeps every digit whether Steam
// sends it as a string or as a bare number.
function rawIdField(raw: string, field: string): string | null {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"?(\\d+)"?`));
  return match?.[1] ?? null;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
