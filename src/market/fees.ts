// Steam's market fee math, ported operation for operation from its own client (economy_common.js:
// CalculateAmountToSendForDesiredReceivedAmount / CalculateFeeAmount) so every value is the one Steam
// shows and charges, float steps included. All amounts are integer cents in the wallet currency.
//
// buyer pays (the listed price) = seller receives + Steam fee + publisher fee. sellitem takes what the
// seller receives; the price a listing then shows is buyerPaysForSellerReceives(that).amount, which can
// sit a cent or two under the buyer-pays price it was derived from (not every price is reachable).

export interface MarketFeeInfo {
  walletFee: boolean; // g_rgWalletInfo.wallet_fee: false = no fees at all
  walletFeePercent: number; // wallet_fee_percent (0.05)
  walletFeeMinimum: number; // wallet_fee_minimum, cents (1)
  walletFeeBase: number; // wallet_fee_base, cents (0)
  // The item's market fee, else wallet_publisher_fee_percent_default (0.10 for CS2 and Rust).
  publisherFeePercent: number;
}

export interface MarketFeeBreakdown {
  amount: number; // what the buyer pays
  steamFee: number;
  publisherFee: number;
  fees: number;
}

// The fees in force for CS2 and Rust as of 2026-10 (5% Steam, min 1c; 10% publisher). Prefer the
// account's live g_rgWalletInfo (MarketNamespace.getMarketWalletInfo) over this constant.
export const DEFAULT_MARKET_FEE_INFO: MarketFeeInfo = Object.freeze({
  walletFee: true,
  walletFeePercent: 0.05,
  walletFeeMinimum: 1,
  walletFeeBase: 0,
  publisherFeePercent: 0.1,
});

function assertCents(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents, got ${value}`);
  }
}

// Fractions, not percents (0.05, never 5): a fee read in the wrong unit would price everything at a
// sliver of its value, so anything outside a sane range is refused.
const MAX_FEE_FRACTION = 0.5;

function assertFeeInfo(info: MarketFeeInfo): void {
  const fraction = (v: number) => Number.isFinite(v) && v >= 0 && v < MAX_FEE_FRACTION;
  const cents = (v: number) => Number.isSafeInteger(v) && v >= 0;
  if (
    typeof info?.walletFee !== "boolean" ||
    !fraction(info.walletFeePercent) ||
    !fraction(info.publisherFeePercent) ||
    !cents(info.walletFeeMinimum) ||
    !cents(info.walletFeeBase)
  ) {
    throw new RangeError(`invalid market fee info: ${JSON.stringify(info)}`);
  }
}

// The fee parameters from a market page's g_rgWalletInfo (fields arrive as numbers or numeric
// strings), or null when any is missing or out of range. publisherFeePercent: the item's own market
// fee when it has one, else the wallet's default.
export function feeInfoFromWalletInfo(
  raw: {
    wallet_fee?: unknown;
    wallet_fee_percent?: unknown;
    wallet_fee_minimum?: unknown;
    wallet_fee_base?: unknown;
    wallet_publisher_fee_percent_default?: unknown;
  },
  publisherFeePercent?: number,
): MarketFeeInfo | null {
  const num = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  const info: MarketFeeInfo = {
    walletFee: num(raw.wallet_fee) === 1,
    walletFeePercent: num(raw.wallet_fee_percent),
    walletFeeMinimum: num(raw.wallet_fee_minimum),
    walletFeeBase: num(raw.wallet_fee_base),
    publisherFeePercent: publisherFeePercent ?? num(raw.wallet_publisher_fee_percent_default),
  };
  if (num(raw.wallet_fee) !== 0 && num(raw.wallet_fee) !== 1) return null;
  try {
    assertFeeInfo(info);
  } catch {
    return null;
  }
  return info;
}

// What the buyer pays for the seller to receive `receivedAmount` (CalculateAmountToSendForDesiredReceivedAmount).
export function buyerPaysForSellerReceives(
  receivedAmount: number,
  info: MarketFeeInfo,
): MarketFeeBreakdown {
  assertCents("receivedAmount", receivedAmount);
  assertFeeInfo(info);
  return amountToSend(receivedAmount, info);
}

// The fee split of a buyer-pays price (CalculateFeeAmount). For a price that no seller-receives value
// reaches exactly, Steam keeps the difference as extra Steam fee - the same as its own listing dialog.
export function feesForBuyerPays(amount: number, info: MarketFeeInfo): MarketFeeBreakdown {
  assertCents("amount", amount);
  assertFeeInfo(info);
  if (!info.walletFee) return { amount, steamFee: 0, publisherFee: 0, fees: 0 };

  let iterations = 0;
  let estimate = Math.trunc(
    (amount - Math.trunc(info.walletFeeBase)) /
      (info.walletFeePercent + info.publisherFeePercent + 1),
  );
  let everUndershot = false;
  let fees = amountToSend(estimate, info);
  while (fees.amount !== amount && iterations < 10) {
    if (fees.amount > amount) {
      if (everUndershot) {
        fees = amountToSend(estimate - 1, info);
        fees.steamFee += amount - fees.amount;
        fees.fees += amount - fees.amount;
        fees.amount = amount;
        break;
      }
      estimate--;
    } else {
      everUndershot = true;
      estimate++;
    }
    fees = amountToSend(estimate, info);
    iterations++;
  }
  return fees;
}

// What the seller receives when a buyer pays `amount`. Never negative: 1c and 2c leave nothing.
export function sellerReceivesForBuyerPays(amount: number, info: MarketFeeInfo): number {
  return Math.max(0, amount - feesForBuyerPays(amount, info).fees);
}

// The price a listing actually shows when listed to receive sellerReceivesForBuyerPays(targetBuyerPays):
// the target itself when reachable, else the largest reachable price below it. 0 when the target
// pays out nothing (1c and 2c), i.e. no listing can sit at or below it.
export function landingBuyerPays(targetBuyerPays: number, info: MarketFeeInfo): number {
  const receives = sellerReceivesForBuyerPays(targetBuyerPays, info);
  return receives === 0 ? 0 : buyerPaysForSellerReceives(receives, info).amount;
}

function amountToSend(receivedAmount: number, info: MarketFeeInfo): MarketFeeBreakdown {
  if (!info.walletFee) {
    return { amount: receivedAmount, steamFee: 0, publisherFee: 0, fees: 0 };
  }
  const steamFee = Math.trunc(
    Math.floor(
      Math.max(receivedAmount * info.walletFeePercent, info.walletFeeMinimum) +
        Math.trunc(info.walletFeeBase),
    ),
  );
  const publisherFee = Math.trunc(
    Math.floor(
      info.publisherFeePercent > 0 ? Math.max(receivedAmount * info.publisherFeePercent, 1) : 0,
    ),
  );
  const amount = Math.trunc(receivedAmount + steamFee + publisherFee);
  return { amount, steamFee, publisherFee, fees: steamFee + publisherFee };
}
