import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buyerPaysForSellerReceives,
  DEFAULT_MARKET_FEE_INFO as FEES,
  feeInfoFromWalletInfo,
  feesForBuyerPays,
  landingBuyerPays,
  sellerReceivesForBuyerPays,
} from "../src/market/fees.js";

// SHA-256 of the seller-receives value for every buyer-pays price 1..250000, joined by "," — taken
// from SCM-autoseller's price_conversion_map.json, the table it priced every live listing with.
const SCM_MAP_SHA256 = "4207396056db23c2943abbbc80c1a95693d139e4dc01142003a7a2ed87147950";

describe("Steam market fees", () => {
  it("matches SCM-autoseller's buyer-pays → seller-receives table for every price 1..250000", () => {
    const values: number[] = [];
    for (let price = 1; price <= 250000; price++) {
      values.push(sellerReceivesForBuyerPays(price, FEES));
    }
    expect(createHash("sha256").update(values.join(",")).digest("hex")).toBe(SCM_MAP_SHA256);
  });

  it("lands an unreachable price on the largest reachable one below it", () => {
    // 44 and 45 both pay out 39, which lists at 43; 999 pays out 869, which lists at 998.
    expect(sellerReceivesForBuyerPays(44, FEES)).toBe(39);
    expect(sellerReceivesForBuyerPays(45, FEES)).toBe(39);
    expect(landingBuyerPays(44, FEES)).toBe(43);
    expect(landingBuyerPays(45, FEES)).toBe(43);
    expect(sellerReceivesForBuyerPays(999, FEES)).toBe(869);
    expect(landingBuyerPays(999, FEES)).toBe(998);
    expect(landingBuyerPays(43, FEES)).toBe(43);
  });

  it("round-trips every seller-receives value through its buyer-pays price", () => {
    for (let receives = 1; receives <= 20000; receives++) {
      const paid = buyerPaysForSellerReceives(receives, FEES).amount;
      expect(sellerReceivesForBuyerPays(paid, FEES)).toBe(receives);
      expect(landingBuyerPays(paid, FEES)).toBe(paid);
    }
  });

  it("splits fees like Steam: 5% (min 1c) + 10% (min 1c), floored", () => {
    expect(buyerPaysForSellerReceives(100, FEES)).toEqual({
      amount: 115,
      steamFee: 5,
      publisherFee: 10,
      fees: 15,
    });
    expect(buyerPaysForSellerReceives(1, FEES)).toEqual({
      amount: 3,
      steamFee: 1,
      publisherFee: 1,
      fees: 2,
    });
    expect(feesForBuyerPays(3, FEES).fees).toBe(2);
  });

  it("leaves nothing for 1c and 2c and never goes negative", () => {
    expect(sellerReceivesForBuyerPays(1, FEES)).toBe(0);
    expect(sellerReceivesForBuyerPays(2, FEES)).toBe(0);
    expect(sellerReceivesForBuyerPays(3, FEES)).toBe(1);
    expect(sellerReceivesForBuyerPays(0, FEES)).toBe(0);
  });

  it("charges nothing when the wallet has no fee", () => {
    const free = { ...FEES, walletFee: false };
    expect(sellerReceivesForBuyerPays(1234, free)).toBe(1234);
    expect(buyerPaysForSellerReceives(1234, free).amount).toBe(1234);
  });

  it("rejects non-integer or negative cents instead of guessing", () => {
    expect(() => sellerReceivesForBuyerPays(1.5, FEES)).toThrow(RangeError);
    expect(() => sellerReceivesForBuyerPays(-1, FEES)).toThrow(RangeError);
    expect(() => sellerReceivesForBuyerPays(Number.NaN, FEES)).toThrow(RangeError);
    expect(() => buyerPaysForSellerReceives(2.25, FEES)).toThrow(RangeError);
  });

  it("lands nothing at 1c and 2c (no listing can pay out there)", () => {
    expect(landingBuyerPays(1, FEES)).toBe(0);
    expect(landingBuyerPays(2, FEES)).toBe(0);
    expect(landingBuyerPays(3, FEES)).toBe(3);
  });

  it("refuses fee info in the wrong unit or shape", () => {
    expect(() => sellerReceivesForBuyerPays(100, { ...FEES, walletFeePercent: 5 })).toThrow(
      RangeError,
    );
    expect(() =>
      sellerReceivesForBuyerPays(100, { ...FEES, publisherFeePercent: Number.NaN }),
    ).toThrow(RangeError);
    expect(() => sellerReceivesForBuyerPays(100, { ...FEES, walletFeeMinimum: 0.5 })).toThrow(
      RangeError,
    );
  });

  it("reads g_rgWalletInfo fee fields (numbers or numeric strings), refusing bad ones", () => {
    const raw = {
      wallet_fee: 1,
      wallet_fee_percent: "0.05",
      wallet_fee_minimum: 1,
      wallet_fee_base: "0",
      wallet_publisher_fee_percent_default: "0.10",
    };
    expect(feeInfoFromWalletInfo(raw)).toEqual(FEES);
    expect(feeInfoFromWalletInfo(raw, 0.15)?.publisherFeePercent).toBe(0.15);
    expect(feeInfoFromWalletInfo({ ...raw, wallet_fee_percent: "5" })).toBeNull();
    expect(feeInfoFromWalletInfo({ ...raw, wallet_fee_percent: "" })).toBeNull();
    expect(feeInfoFromWalletInfo({ ...raw, wallet_fee: 2 })).toBeNull();
    expect(feeInfoFromWalletInfo({})).toBeNull();
  });

  it("handles prices far above the old 250000 table without exiting", () => {
    expect(sellerReceivesForBuyerPays(5_000_000, FEES)).toBe(4_347_827);
    expect(landingBuyerPays(5_000_000, FEES)).toBeLessThanOrEqual(5_000_000);
  });
});
