import type { RawDescription } from "../models/EconItem.js";

export type OfferTarget =
  | { tradeUrl: string; steamId?: never; token?: never }
  | { steamId: string; token?: string; tradeUrl?: never };

export interface TradeItem {
  appid: number;
  contextid: string;
  assetid: string;
  amount?: number;
}

export interface RawAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  missing?: boolean;
  est_usd?: string;
  [key: string]: unknown;
}

export interface RawCEconTradeOffer {
  tradeofferid: string;
  accountid_other: number;
  message?: string;
  expiration_time: number;
  trade_offer_state: number;
  items_to_give?: RawAsset[];
  items_to_receive?: RawAsset[];
  is_our_offer: boolean;
  time_created: number;
  time_updated: number;
  tradeid?: string;
  from_real_time_trade: boolean;
  escrow_end_date: number;
  confirmation_method: number;
  eresult?: number;
  // Trade-protection (2025) hold; settlement_date (== time_settlement) is 0 until Accepted.
  delay_settlement?: boolean;
  settlement_date?: number;
  [key: string]: unknown;
}

export interface RawGetTradeOffersResponse {
  trade_offers_sent?: RawCEconTradeOffer[];
  trade_offers_received?: RawCEconTradeOffer[];
  descriptions?: RawDescription[];
  next_cursor?: number;
}

// IEconService/GetTradeStatus assets carry where each item LANDED post-trade (new_assetid/contextid).
export interface RawExchangeAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  new_assetid?: string;
  new_contextid?: string;
  rollback_new_assetid?: string;
  rollback_new_contextid?: string;
  currencyid?: string;
  [key: string]: unknown;
}

export interface RawTradeStatus {
  tradeid: string;
  steamid_other?: string;
  time_init: number;
  time_settlement?: number;
  status: number;
  assets_received?: RawExchangeAsset[];
  assets_given?: RawExchangeAsset[];
  time_mod?: number;
  [key: string]: unknown;
}

export interface RawGetTradeStatusResponse {
  trades?: RawTradeStatus[];
  descriptions?: RawDescription[];
}

// Verdict from /market/eligibilitycheck/, decoded from the `webTradeEligibility` cookie it sets.
// allowed: 1 = can trade now, 0 = blocked. reason is a bitmask; the *_days/*_at_time fields detail
// the active Steam Guard / new-device holds. All times are unix seconds.
export interface WebTradeEligibility {
  allowed: number;
  reason: number;
  allowed_at_time: number;
  steamguard_required_days: number;
  new_device_cooldown_days: number;
  expiration: number;
  time_checked: number;
  [key: string]: unknown;
}

// /market/mylistings (norender=1) listing. price = what the seller receives, fee = Steam + publisher
// cut (the buyer pays price + fee); integer cents in the wallet currency. listings_to_confirm entries
// (awaiting mobile confirmation) carry the same listingid/asset fields.
export interface RawMarketListing {
  listingid: string;
  price: number;
  fee: number;
  asset?: RawMarketListingAsset;
  [key: string]: unknown;
}

export interface RawMarketListingAsset {
  appid: number;
  id: string;
  amount: string;
  market_hash_name: string;
  [key: string]: unknown;
}

// price is per unit, in cents.
export interface RawMarketBuyOrder {
  buy_orderid: string;
  appid: number;
  hash_name: string;
  price: number | string;
  quantity: number | string;
  quantity_remaining: number | string;
  description?: RawDescription;
  [key: string]: unknown;
}

export interface RawMyListingsResponse {
  success?: boolean | number;
  num_active_listings?: number;
  listings?: RawMarketListing[];
  results?: { listings?: RawMarketListing[]; [key: string]: unknown };
  listings_to_confirm?: RawMarketListing[];
  buy_orders?: RawMarketBuyOrder[];
  [key: string]: unknown;
}

export interface RawMarketHistoryAsset {
  classid?: string;
  instanceid?: string;
  unowned_contextid?: string;
  unowned_id?: string;
  market_hash_name?: string;
  [key: string]: unknown;
}

// Rendered /market/myhistory: rows as HTML; asset identity rides in the `hovers` JS string plus the
// appid → contextid → assetid `assets` map.
export interface RawMarketHistoryResponse {
  success?: boolean | number;
  total_count?: number;
  results_html?: string;
  hovers?: string;
  assets?: Record<string, Record<string, Record<string, RawMarketHistoryAsset>>>;
  [key: string]: unknown;
}

// /market/orderbook payload. Depth is flat [price, qty, price, qty, …] in integer cents / counts:
// sells ascending (best ask first), buys descending (best bid first). amtMinSellOrder / amtMaxBuyOrder
// are the best ask / bid, null when that side is empty. Prices are in the wallet currency
// (eCurrency) — the endpoint ignores any requested currency.
export interface RawOrderbookData {
  eCurrency: number;
  amtMinSellOrder?: number | null;
  amtMaxBuyOrder?: number | null;
  rgCompactSellOrders?: number[];
  rgCompactBuyOrders?: number[];
  [key: string]: unknown;
}

// /market/pricehistory row: [date, price in major units (float), volume].
export type RawPriceHistoryPoint = [date: string, price: number, volume: string];

export interface RawPriceHistoryResponse {
  success?: boolean | number;
  prices?: RawPriceHistoryPoint[];
  [key: string]: unknown;
}

// /market/search/render (norender=1) result row.
export interface RawMarketSearchResult {
  hash_name: string;
  sell_listings: number;
  asset_description: RawDescription;
  [key: string]: unknown;
}

export interface RawMarketSearchResponse {
  results?: RawMarketSearchResult[];
  [key: string]: unknown;
}

export interface RawSellItemResponse {
  success?: boolean | number;
  message?: string;
  [key: string]: unknown;
}

// createbuyorder answers HTTP 406 + confirmation.confirmation_id when a mobile confirmation is
// required, else success + buy_orderid.
export interface RawCreateBuyOrderResponse {
  success?: boolean | number;
  buy_orderid?: string | number;
  message?: string;
  need_confirmation?: boolean;
  confirmation?: { confirmation_id?: string | number; [key: string]: unknown };
  wallet_info?: { success?: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface RawCancelBuyOrderResponse {
  success?: boolean | number;
  [key: string]: unknown;
}

// IUserAccountService/GetClientWalletDetails (CUserAccount_GetWalletDetails_Response). Balances are
// int64 cents in the wallet currency (currency_code), which the WebAPI serializes as strings.
export interface RawWalletDetails {
  has_wallet?: boolean;
  user_country_code?: string;
  wallet_country_code?: string;
  wallet_state?: string;
  balance?: string;
  delayed_balance?: string;
  currency_code?: number;
  time_most_recent_txn?: number;
  most_recent_txnid?: string;
  balance_in_usd?: string;
  delayed_balance_in_usd?: string;
  has_wallet_in_other_regions?: boolean;
  other_regions?: number[];
  formatted_balance?: string;
  [key: string]: unknown;
}
