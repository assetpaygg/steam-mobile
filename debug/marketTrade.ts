import { mkdirSync, writeFileSync } from "node:fs";
import {
  type Confirmation,
  DEFAULT_MARKET_FEE_INFO,
  EConfirmationType,
  type EconItem,
  feeInfoFromWalletInfo,
  landingBuyerPays,
  type OrderbookSummary,
  type RawMarketListing,
  sellerReceivesForBuyerPays,
  summarizeOrderbook,
} from "../src/index.js";
import { login } from "./login.js";

// Guarded LIVE round trip on the Community Market. It answers the Steam questions the autoseller
// port depends on (autosellers docs/scm-port/DESIGN.md §8.2) and records them in a JSON report.
// Read-only unless LIVE_WRITES=1. With writes on it:
//   - lists PROBE_ASSETID at 5× the lowest ask - only when the item has asks, that price stays under
//     the cap, and it sits above 2× the best bid, so neither a buyer nor a buy order can take it -
//     confirms exactly that listing by id, verifies it, cancels it and watches the item come back;
//   - places a PROBE_BUY_CENTS (default 3c) buy order for PROBE_BUY_ITEM at most a tenth of the best
//     bid (so it cannot fill), verifies it, tries a duplicate, cancels it.
// Everything it creates is cancelled in `finally` - including any buy order for the item that was
// not there before the run - also when a step fails.
//
//   LIVE_WRITES=1 PROBE_ASSETID=<assetid> pnpm market-trade
//   PROBE_APPID (730) · PROBE_CONTEXTID (2) · PROBE_BUY_ITEM ("Fracture Case" / unset to skip)
const APPID = Number(process.env.PROBE_APPID ?? 730);
const CONTEXTID = process.env.PROBE_CONTEXTID ?? "2";
const ASSETID = process.env.PROBE_ASSETID;
const BUY_ITEM = process.env.PROBE_BUY_ITEM ?? (APPID === 730 ? "Fracture Case" : undefined);
const BUY_CENTS = Number(process.env.PROBE_BUY_CENTS ?? 3);
const WRITES = process.env.LIVE_WRITES === "1";
const CALL = { timeoutMs: 20_000 };
const RETURN_WAIT_MS = 120_000;
const LIST_PRICE_CAP = 150_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), appid: APPID };
const answers: Record<string, unknown> = {};
const errors: Record<string, unknown>[] = [];
report.answers = answers;
report.errors = errors;

function describeError(e: unknown): Record<string, unknown> {
  const err = e as Error & Record<string, unknown>;
  return {
    name: err?.name,
    message: err?.message,
    eresult: err?.eresult,
    statusCode: err?.statusCode,
    reason: err?.reason,
    stage: err?.stage,
    code: err?.code,
    mayExist: err?.mayExist,
    orderExists: err?.orderExists,
    expected: err?.expected,
    actual: err?.actual,
    body: summarizeBody(err?.body),
  };
}

function summarizeBody(body: unknown): unknown {
  if (body === undefined || body === null) return body;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const value = await fn();
    console.log(`✅ ${name}`);
    return value;
  } catch (e) {
    console.log(`❌ ${name}: ${(e as Error)?.name}: ${(e as Error)?.message}`);
    errors.push({ step: name, ...describeError(e) });
    return undefined;
  } finally {
    await sleep(1500);
  }
}

// What a refusal looks like, recorded instead of thrown.
async function refusal(name: string, fn: () => Promise<unknown>): Promise<unknown> {
  return step(name, async () => {
    try {
      const r = await fn();
      return { unexpected: "accepted", result: r };
    } catch (e) {
      return describeError(e);
    }
  });
}

function hasAsset(list: RawMarketListing[], assetid: string): RawMarketListing | undefined {
  return list.find((l) => l.asset?.id === assetid);
}

async function main(): Promise<void> {
  console.log(`\n=== market trade probe (${WRITES ? "LIVE WRITES" : "read-only"}) ===\n`);
  const { bot } = await login();
  if (!bot.identitySecret) throw new Error("identitySecret required (confirmations)");
  report.bot = `…${bot.steamID.getSteamID64().slice(-4)}`;

  const created = { listingIds: new Set<string>(), buyOrderIds: new Set<string>() };
  const ourConfirmations: Confirmation[] = [];
  let buyOrdersBefore: Set<string> | null = null;

  try {
    // --- wallet + fees (the wallet read also verifies the currency for writes) ----------------
    const wallet = await step("getWalletDetails", () => bot.market.getWalletDetails(CALL));
    answers.wallet = wallet && {
      has_wallet: wallet.has_wallet,
      currency_code: wallet.currency_code,
      balance: wallet.balance,
      delayed_balance: wallet.delayed_balance,
      wallet_country_code: wallet.wallet_country_code,
      verified: bot.market.walletCurrencyVerified,
    };
    const walletInfo = await step("getMarketWalletInfo", () =>
      bot.market.getMarketWalletInfo(CALL),
    );
    answers.g_rgWalletInfo = walletInfo;
    const fees = walletInfo ? feeInfoFromWalletInfo(walletInfo) : null;
    answers.feeInfo = fees;
    answers.feeInfoEqualsDefault = JSON.stringify(fees) === JSON.stringify(DEFAULT_MARKET_FEE_INFO);

    // --- reads --------------------------------------------------------------------------------
    const listingsBefore = await step("getMyListings (before)", () =>
      bot.market.getMyListings(CALL),
    );
    answers.listingsBefore = listingsBefore && {
      num_active_listings: listingsBefore.num_active_listings,
      complete: listingsBefore.complete,
      listing0: listingsBefore.listings[0],
      buy_order0: listingsBefore.buy_orders[0],
      listings_to_confirm: listingsBefore.listings_to_confirm.length,
      listings_on_hold: listingsBefore.listings_on_hold.length,
      listing_to_confirm0: listingsBefore.listings_to_confirm[0],
    };
    const history = await step("getMyHistory(count 100)", () =>
      bot.market.getMyHistory({ count: 100, ...CALL }),
    );
    answers.history = history && {
      totalCount: history.totalCount,
      events: history.events.length,
      sales: history.sales.length,
      purchases: history.purchases.length,
      malformed: history.malformed,
      sale0: history.sales[0],
      purchase0: history.purchases[0],
      saleRowsWithAsset: history.sales.filter((s) => s.assetID && s.marketName).length,
      purchaseRowsWithAsset: history.purchases.filter((p) => p.assetID && p.marketName).length,
    };

    // --- the item to list ---------------------------------------------------------------------
    let item: EconItem | undefined;
    const assetIdsBefore = new Set<string>();
    if (ASSETID) {
      const inv = await step("getInventory (before)", () =>
        bot.community.getInventory(APPID, CONTEXTID),
      );
      for (const i of inv ?? []) assetIdsBefore.add(i.assetid);
      item = inv?.find((i) => i.assetid === ASSETID);
      answers.itemBefore = item && {
        name: item.market_hash_name,
        marketable: item.marketable,
        tradable: item.tradable,
        classid: item.classid,
        instanceid: item.instanceid,
      };
      if (!item) throw new Error(`PROBE_ASSETID ${ASSETID} not in ${APPID}/${CONTEXTID} inventory`);
    }

    let bookBefore: OrderbookSummary | undefined;
    let sellsBefore: number[] = [];
    if (item) {
      const raw = await step("getOrderbook (item)", () =>
        bot.market.getOrderbook(APPID, item.market_hash_name, CALL),
      );
      if (raw) {
        sellsBefore = raw.rgCompactSellOrders ?? [];
        bookBefore = await step("summarizeOrderbook (item)", async () => summarizeOrderbook(raw));
        answers.orderbookBefore = { summary: bookBefore, sellLevels: sellsBefore.length / 2 };
      }
      answers.priceHistory = await step("getPriceHistory (currency markers)", async () => {
        const rows = await bot.market.getPriceHistory(APPID, item.market_hash_name, CALL);
        return { rows: rows.length, last: rows.at(-1), markersAccepted: true };
      });
      const rawHistory = await step("pricehistory raw markers", () =>
        bot.get<Record<string, unknown>>(
          `https://steamcommunity.com/market/pricehistory?appid=${APPID}&market_hash_name=${encodeURIComponent(item.market_hash_name)}`,
          { responseType: "json", ...CALL },
        ),
      );
      answers.priceHistoryMarkers = rawHistory && {
        price_prefix: rawHistory.body?.price_prefix,
        price_suffix: rawHistory.body?.price_suffix,
      };
    }

    if (!WRITES) {
      console.log("\nwrites skipped (set LIVE_WRITES=1)\n");
      return;
    }
    if (!fees) throw new Error("no valid fee info for this wallet - refusing to write");
    if (!bot.market.walletCurrencyVerified) throw new Error("wallet currency not verified");

    // --- sell round trip ----------------------------------------------------------------------
    const sellPlan = (() => {
      if (!item || !bookBefore || !listingsBefore) return { skip: "no item / book / listings" };
      if (!listingsBefore.complete) return { skip: "listings census incomplete" };
      const all = [
        ...listingsBefore.listings,
        ...listingsBefore.listings_to_confirm,
        ...listingsBefore.listings_on_hold,
      ];
      if (hasAsset(all, item.assetid)) return { skip: "asset already has a listing" };
      if (bookBefore.lowestAsk === null) return { skip: "no asks: no safe price" };
      const target = bookBefore.lowestAsk * 5;
      if (target > LIST_PRICE_CAP) return { skip: `5× ask ${target} over cap ${LIST_PRICE_CAP}` };
      const landing = landingBuyerPays(target, fees);
      const bar = Math.max(bookBefore.lowestAsk, 2 * (bookBefore.highestBid ?? 0));
      if (!(landing > bar)) return { skip: `landing ${landing} not above ${bar}` };
      return { target, landing, receives: sellerReceivesForBuyerPays(target, fees) };
    })();
    answers.sellPlan = {
      ...sellPlan,
      lowestAsk: bookBefore?.lowestAsk,
      highestBid: bookBefore?.highestBid,
    };

    if (item && "receives" in sellPlan) {
      const { landing, receives } = sellPlan;
      answers.sellItemBody = await step("sellItem", () =>
        bot.market.sellItem({
          appid: APPID,
          contextid: CONTEXTID,
          assetid: item.assetid,
          price: receives,
          ...CALL,
        }),
      );

      const afterSell = await step("getMyListings (after sellitem)", () =>
        bot.market.getMyListings(CALL),
      );
      const pending = afterSell && hasAsset(afterSell.listings_to_confirm, item.assetid);
      const activeAlready = afterSell && hasAsset(afterSell.listings, item.assetid);
      const ours = pending ?? activeAlready;
      if (ours) created.listingIds.add(ours.listingid);
      answers.afterSell = afterSell
        ? {
            inListingsToConfirm: Boolean(pending),
            alreadyActive: Boolean(activeAlready),
            listing: ours,
            priceMatchesReceives: ours ? ours.price === receives : null,
            priceFeeMatchesLanding: ours ? ours.price + ours.fee === landing : null,
          }
        : null;

      const invPending = await step("getInventory (listing awaiting confirmation)", () =>
        bot.community.getInventory(APPID, CONTEXTID),
      );
      answers.itemInInventoryWhileAwaitingConfirmation = invPending
        ? invPending.some((i) => i.assetid === item.assetid)
        : null;

      answers.secondSellOfPendingItem = await refusal("sellItem again (pending item)", () =>
        bot.market.sellItem({
          appid: APPID,
          contextid: CONTEXTID,
          assetid: item.assetid,
          price: receives,
          ...CALL,
        }),
      );

      const confs = await step("confirmations.getPending", () =>
        bot.confirmations.getPending(CALL),
      );
      const listingConfs = (confs ?? []).filter((c) => c.type === EConfirmationType.MarketListing);
      ourConfirmations.push(...listingConfs.filter((c) => c.creator === ours?.listingid));
      answers.listingConfirmation = {
        listingId: ours?.listingid,
        pendingMarketListingConfs: listingConfs.map((c) => ({
          creator: c.creator,
          sending: c.sending,
        })),
        creatorEqualsListingId: listingConfs.some((c) => c.creator === ours?.listingid),
      };

      // Confirm only the listing this run created, at exactly the payout it sent.
      if (pending && pending.price === receives) {
        answers.confirmListingIds = await step("confirmListingIds", async () => {
          const r = await bot.market.confirmListingIds([pending.listingid], CALL);
          return { confirmed: r.confirmed.length, missing: r.missing };
        });

        const active = await step("getMyListings (after confirm)", () =>
          bot.market.getMyListings(CALL),
        );
        const live = active?.listings.find((l) => l.listingid === pending.listingid);
        answers.activeListing = live
          ? {
              listing: live,
              priceMatchesReceives: live.price === receives,
              priceFeeMatchesLanding: live.price + live.fee === landing,
            }
          : { found: false };

        const invListed = await step("getInventory (listing active)", () =>
          bot.community.getInventory(APPID, CONTEXTID),
        );
        answers.itemInInventoryWhileListed = invListed
          ? invListed.some((i) => i.assetid === item.assetid)
          : null;

        const bookListed = await step("getOrderbook (while listed)", () =>
          bot.market.getOrderbook(APPID, item.market_hash_name, CALL),
        );
        if (bookListed) {
          const levels = bookListed.rgCompactSellOrders ?? [];
          const qtyAt = (orders: number[], price: number) => {
            for (let i = 0; i + 1 < orders.length; i += 2) {
              if (orders[i] === price) return orders[i + 1];
            }
            return 0;
          };
          // Our level is far above the ask: it only answers the question when the depth reaches it.
          const deepest = levels.length >= 2 ? (levels[levels.length - 2] as number) : null;
          answers.orderbookIncludesOwnListing = {
            landing,
            qtyAtLandingBefore: qtyAt(sellsBefore, landing),
            qtyAtLandingNow: qtyAt(levels, landing),
            deepestListedLevel: deepest,
            conclusive: deepest !== null && deepest >= landing,
          };
        }

        answers.sellItemOnListedAsset = await refusal("sellItem (asset already listed)", () =>
          bot.market.sellItem({
            appid: APPID,
            contextid: CONTEXTID,
            assetid: item.assetid,
            price: receives,
            ...CALL,
          }),
        );
      } else if (ours) {
        answers.confirmSkipped = "pending listing missing or not at the payout we sent";
      }

      if (ours) {
        const cancelledAt = Date.now();
        await step("cancelListing", () => bot.market.cancelListing(ours.listingid, CALL));
        const check = await step("getMyListings (after cancel)", () =>
          bot.market.getMyListings(CALL),
        );
        const stillThere =
          check &&
          [...check.listings, ...check.listings_to_confirm, ...check.listings_on_hold].some(
            (l) => l.listingid === ours.listingid,
          );
        if (check && !stillThere) created.listingIds.delete(ours.listingid);
        answers.listingGoneAfterCancel = check ? !stillThere : null;

        let returned: EconItem | undefined;
        while (Date.now() - cancelledAt < RETURN_WAIT_MS) {
          const inv = await bot.community.getInventory(APPID, CONTEXTID).catch(() => undefined);
          // Same asset id, or a NEW asset id (absent before listing) of the same class/instance.
          returned =
            inv?.find((i) => i.assetid === item.assetid) ??
            inv?.find(
              (i) =>
                !assetIdsBefore.has(i.assetid) &&
                i.market_hash_name === item.market_hash_name &&
                i.classid === item.classid &&
                i.instanceid === item.instanceid,
            );
          if (returned) break;
          await sleep(5000);
        }
        answers.returnAfterCancel = returned
          ? {
              secondsToReturn: Math.round((Date.now() - cancelledAt) / 1000),
              sameAssetId: returned.assetid === item.assetid,
              assetid: returned.assetid,
              marketable: returned.marketable,
              tradable: returned.tradable,
            }
          : { returned: false, waitedSeconds: RETURN_WAIT_MS / 1000 };
      }

      answers.sellNonexistentAsset = await refusal("sellItem (nonexistent asset)", () =>
        bot.market.sellItem({ appid: APPID, assetid: "1", price: receives, ...CALL }),
      );
    }

    // --- buy order round trip -----------------------------------------------------------------
    if (BUY_ITEM && listingsBefore?.complete) {
      buyOrdersBefore = new Set(
        listingsBefore.buy_orders.filter((o) => o.hash_name === BUY_ITEM).map((o) => o.buy_orderid),
      );
      const raw = await step("getOrderbook (buy item)", () =>
        bot.market.getOrderbook(APPID, BUY_ITEM, CALL),
      );
      const book =
        raw && (await step("summarizeOrderbook (buy item)", async () => summarizeOrderbook(raw)));
      answers.buyBook = book;
      if (buyOrdersBefore.size > 0) {
        answers.buyOrder = "skipped: an order for this item already exists";
      } else if (!book?.highestBid || BUY_CENTS * 10 > book.highestBid) {
        answers.buyOrder = `skipped: ${BUY_CENTS}c is not under a tenth of the best bid ${book?.highestBid}`;
      } else {
        const accepted: string[] = [];
        const original = bot.confirmations.acceptConfirmations.bind(bot.confirmations);
        bot.confirmations.acceptConfirmations = async (confsToAccept, control) => {
          accepted.push(...confsToAccept.map((c) => c.id));
          return original(confsToAccept, control);
        };
        let orderId: string | undefined;
        try {
          orderId = await step("createBuyOrder", () =>
            bot.market.createBuyOrder({
              appid: APPID,
              marketHashName: BUY_ITEM,
              priceTotal: BUY_CENTS,
              quantity: 1,
              ...CALL,
            }),
          );
        } finally {
          bot.confirmations.acceptConfirmations = original;
        }
        if (orderId) created.buyOrderIds.add(orderId);
        answers.buyOrderPath = { orderId, confirmationsAccepted: accepted.length };

        const after = await step("getMyListings (buy order)", () => bot.market.getMyListings(CALL));
        const order = after?.buy_orders.find((o) => o.buy_orderid === orderId);
        answers.buyOrderListed = after
          ? (order ?? { found: false, ids: after.buy_orders.map((o) => o.buy_orderid) })
          : null;

        answers.duplicateBuyOrder = await refusal("createBuyOrder (duplicate)", () =>
          bot.market.createBuyOrder({
            appid: APPID,
            marketHashName: BUY_ITEM,
            priceTotal: BUY_CENTS,
            quantity: 1,
            ...CALL,
          }),
        );

        if (orderId) {
          answers.cancelBuyOrder = await step("cancelBuyOrder", () =>
            bot.market.cancelBuyOrder(orderId, CALL),
          );
          answers.cancelBuyOrderAgain = await refusal("cancelBuyOrder (again)", () =>
            bot.market.cancelBuyOrder(orderId, CALL),
          );
          const gone = await step("getMyListings (after cancel)", () =>
            bot.market.getMyListings(CALL),
          );
          const stillThere = gone?.buy_orders.some((o) => o.buy_orderid === orderId);
          if (gone && !stillThere) created.buyOrderIds.delete(orderId);
          answers.buyOrderGoneAfterCancel = gone ? !stillThere : null;
        }
      }
    }
  } finally {
    // Cleanup: whatever this run created must not outlive it - including buy orders for the probe
    // item that were not there before the run but never made it into `created`.
    const final = await step("cleanup: getMyListings", () => bot.market.getMyListings(CALL));
    if (final && BUY_ITEM && buyOrdersBefore) {
      for (const o of final.buy_orders) {
        if (o.hash_name === BUY_ITEM && !buyOrdersBefore.has(o.buy_orderid)) {
          created.buyOrderIds.add(o.buy_orderid);
        }
      }
    }
    for (const id of created.listingIds) {
      await step(`cleanup: cancelListing ${id}`, () => bot.market.cancelListing(id, CALL));
    }
    for (const id of created.buyOrderIds) {
      await step(`cleanup: cancelBuyOrder ${id}`, () => bot.market.cancelBuyOrder(id, CALL));
    }
    report.cleanupRejectedConfirmations = await step(
      "cleanup: our pending confirmations",
      async () => {
        const pending = await bot.confirmations.getPending(CALL);
        const ours = pending.filter((c) => ourConfirmations.some((o) => o.id === c.id));
        await bot.confirmations.rejectConfirmations(ours, CALL);
        return ours.length;
      },
    );
    report.leftAfterCleanup = await step("cleanup: verify", async () => {
      const v = await bot.market.getMyListings(CALL);
      const listed = [...v.listings, ...v.listings_to_confirm, ...v.listings_on_hold];
      return {
        listings: [...created.listingIds].filter((id) => listed.some((l) => l.listingid === id)),
        buyOrders: [...created.buyOrderIds].filter((id) =>
          v.buy_orders.some((o) => o.buy_orderid === id),
        ),
      };
    });
    report.finishedAt = new Date().toISOString();
    mkdirSync("debug/out", { recursive: true });
    const file = `debug/out/market-trade-${Date.now()}.json`;
    writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`\nreport → ${file}\n`);
    console.dir({ answers, leftAfterCleanup: report.leftAfterCleanup }, { depth: 6 });
    await bot.shutdown();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("\n❌ market trade probe FAIL:", (e as Error)?.message ?? e);
    process.exit(1);
  },
);
