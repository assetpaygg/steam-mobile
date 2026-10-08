import { login } from "./login.js";

// Read-only live probe of the market + account-status surface, for verifying response shapes on a
// non-limited account. Nothing here writes (no sell / buy / cancel / confirm). Gentle: one call each,
// spaced out. Item: PROBE_APPID / PROBE_ITEM (default CS2 "Fracture Case").
const APPID = Number(process.env.PROBE_APPID ?? 730);
const ITEM = process.env.PROBE_ITEM ?? "Fracture Case";
const REDACT = new Set(["token_gid", "device_identifier", "machine_id", "public_ip_address"]);

// Field → type (and short value) so the raw typings can be checked against the wire.
function shape(o: unknown): Record<string, string> {
  if (!o || typeof o !== "object") return { value: typeof o };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (REDACT.has(k)) out[k] = `${typeof v} (redacted)`;
    else if (Array.isArray(v)) out[k] = `array(${v.length})`;
    else if (v && typeof v === "object") out[k] = `object{${Object.keys(v).join(",")}}`;
    else out[k] = `${v === null ? "null" : typeof v} ${JSON.stringify(v)?.slice(0, 40)}`;
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log("\n=== market probe: read-only ===\n");
  const { bot, steamID } = await login();
  console.log(`bot: ${steamID}\n`);

  const checks: [string, () => Promise<unknown>][] = [
    ["market.getWalletDetails", () => bot.market.getWalletDetails()],
    ["community.getProfile", () => bot.community.getProfile()],
    ["community.getWebTradeEligibility", () => bot.community.getWebTradeEligibility()],
    ["community.getSteamGuardDetails", () => bot.community.getSteamGuardDetails()],
    ["community.getTwoFactorStatus", () => bot.community.getTwoFactorStatus()],
    [
      "GetPlayerBans via access token (no key)",
      () =>
        bot.api.call({
          httpMethod: "GET",
          iface: "ISteamUser",
          method: "GetPlayerBans",
          input: { steamids: steamID },
        }),
    ],
    [
      "market.getMyListings",
      async () => {
        const r = await bot.market.getMyListings();
        return {
          num_active_listings: r.num_active_listings,
          listings: r.listings.length,
          listing0: shape(r.listings[0]),
          listing0_asset: shape(r.listings[0]?.asset),
          listings_to_confirm: r.listings_to_confirm.length,
          buy_orders: r.buy_orders.length,
          buy_order0: shape(r.buy_orders[0]),
        };
      },
    ],
    [
      "market.getMyHistory({count: 10})",
      async () => {
        const h = await bot.market.getMyHistory({ count: 10 });
        return {
          totalCount: h.totalCount,
          events: h.events.length,
          sales: h.sales.length,
          purchases: h.purchases.length,
          listingEvents: h.listingEvents.length,
          event0: h.events[0],
        };
      },
    ],
    [
      `market.getOrderbook(${APPID}, ${ITEM})`,
      async () => {
        const b = await bot.market.getOrderbook(APPID, ITEM);
        return {
          walletCurrency: bot.market.walletCurrency,
          ...shape(b),
          sell_head: b.rgCompactSellOrders?.slice(0, 4),
          buy_head: b.rgCompactBuyOrders?.slice(0, 4),
        };
      },
    ],
    [
      `market.getPriceHistory(${APPID}, ${ITEM})`,
      async () => {
        const p = await bot.market.getPriceHistory(APPID, ITEM);
        return { rows: p.length, last: p.at(-1), types: p.at(-1)?.map((v) => typeof v) };
      },
    ],
    [
      `market.getMarketItemDetails(${APPID}, ${ITEM})`,
      async () => shape(await bot.market.getMarketItemDetails(APPID, ITEM)),
    ],
  ];

  for (const [name, fn] of checks) {
    try {
      const r = await fn();
      console.log(`✅ ${name}:`);
      console.dir(name.startsWith("market.get") ? r : shape(r), { depth: 4 });
    } catch (e) {
      const err = e as Error & { eresult?: number; statusCode?: number };
      const extra = [
        err.eresult && `eresult=${err.eresult}`,
        err.statusCode && `http=${err.statusCode}`,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`❌ ${name}: ${err.name}: ${err.message}${extra ? ` (${extra})` : ""}`);
    }
    await sleep(1500);
  }

  await bot.shutdown();
  console.log("\n✅ probe done\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ probe FAIL:", (e as Error)?.message ?? e);
  process.exit(1);
});
