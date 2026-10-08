# Steam Mobile

A headless, fully-typed **ESM TypeScript** client for the **Steam mobile app**, built for trading. It
unifies the *web* logic of [`steamcommunity`](https://github.com/DoctorMcKay/node-steamcommunity) and
[`steam-tradeoffer-manager`](https://github.com/DoctorMcKay/node-steam-tradeoffer-manager) into one
cohesive, Promise-native package — with **no `steam-user` and no Steam CM binary protocol**.

## Built by AssetPay

This library is built and maintained by [AssetPay](https://assetpay.gg), B2B skin payment
infrastructure for merchants accepting CS2 and Rust skins. AssetPay provides a documented REST API
for inventory valuation, trade creation, automated settlement, and webhooks, backed by live pricing
and fraud controls.

In production, `@assetpay/steam-mobile` powers AssetPay's Steam-facing layer: it maintains bot
sessions, loads inventories, sends and monitors trade offers, handles mobile confirmations, and
decodes item inspection data. AssetPay's merchant API, orchestration, and ledger are built on top of
this lower-level client. See the [AssetPay API documentation](https://assetpay.gg/docs) to learn how
the complete payment platform fits together.

Everything the mobile app needs is in-package: credential login, TOTP, mobile confirmations
(`mobileconf`), and the `IAuthenticationService` protobufs. The only runtime dependencies are
[`got`](https://github.com/sindresorhus/got), [`proxy-agent`](https://github.com/TooTallNate/proxy-agents),
[`tough-cookie`](https://github.com/salesforce/tough-cookie), [`steamid`](https://github.com/DoctorMcKay/node-steamid),
and [`@bufbuild/protobuf`](https://github.com/bufbuild/protobuf-es).

The client impersonates the Steam mobile app on the wire (a MobileApp-platform access token, per-host
user agents, mobile cookies, and `mobileconf` confirmations). MobileApp is the only platform whose
access token can self-renew over plain HTTP, which is what lets this library run headless without a
persistent CM connection.

## Table of contents

- [Built by AssetPay](#built-by-assetpay)
- [Installation](#installation)
- [The basics](#the-basics)
- [Logging in](#logging-in)
- [SteamMobile](#steammobile) — the root client
- [bot.trade](#bottrade) — sending, reading, and polling trade offers
- [TradeOffer](#tradeoffer) — a single offer
- [bot.community](#botcommunity) — inventories, profiles, trade URLs, API keys
- [bot.market](#botmarket) — Community Market: listings, buy orders, history, order book
- [bot.session](#botsession) — token lifecycle and sessions
- [bot.confirmations](#botconfirmations) — low-level mobile confirmations
- [decodePreviewToken](#decodepreviewtoken) — decode CS2 item inspect/certificate data
- [encodePreviewToken](#encodepreviewtoken) — encode CS2 item data back into a token
- [Data types](#data-types)
- [Enums](#enums)
- [Errors](#errors)
- [Mobile-app impersonation](#mobile-app-impersonation)
- [Notes & limitations](#notes--limitations)
- [Development](#development)

---

## Installation

```bash
pnpm add @assetpay/steam-mobile   # Node 22+, ESM only
```

This package is ESM-only and targets Node 22+. Import it with `import { SteamMobile } from "@assetpay/steam-mobile"`.

## The basics

```ts
import { SteamMobile } from "@assetpay/steam-mobile";

const bot = await new SteamMobile({
  refreshToken: process.env.STEAM_REFRESH_TOKEN!,
  identitySecret: process.env.STEAM_IDENTITY_SECRET, // only needed to confirm trades
}).login();

console.log("Logged in as", bot.steamID.getSteamID64());

const { sent, received } = await bot.trade.getTradeOffers();
console.log(`${sent.length} sent, ${received.length} received`);
```

Construction is **synchronous** and does no network I/O — your `steamID` is known immediately because
it is encoded in the refresh-token JWT. The single network step is `await bot.login()`, which mints the
access token and applies the login cookie. Every method awaits the token lazily, so you *can* call
methods before `login()`, but calling `login()` up front gives you fail-fast behavior and lets you
auto-start polling.

---

## Logging in

There are two ways to get a session. In production you almost always want the **refresh-token** path:
log in once with credentials, store the long-lived refresh token, and reuse it.

### From a refresh token (the normal path)

```ts
const bot = await new SteamMobile({ refreshToken }).login();
```

A MobileApp refresh token lives ~211 days. The library renews the ~24-hour access token lazily and
rotates the refresh token automatically as it nears end-of-life — emitting a [`refreshToken`](#event-refreshtoken)
event each time so you can persist the new one.

### From credentials

When you don't yet have a refresh token, use `loginWithCredentials`. This drives the full
`IAuthenticationService` credential flow (RSA password encryption → begin session → answer Steam Guard
→ poll) entirely in-package — no `steam-session` needed.

#### loginWithCredentials(options)

- `options`
  - `username` — Your Steam account name (login name, not persona).
  - `password` — Your account password.
  - `sharedSecret` — Optional. Your TOTP `shared_secret`. If present, device (TOTP) Steam Guard codes are answered automatically. If the account has **no mobile authenticator** (email Steam Guard only), this rejects up-front with a `NoMobileAuthenticatorError` rather than silently falling through.
  - `steamGuardCode` — Optional. A Steam Guard code you supply yourself (email or device).
  - `proxy` — Optional. A proxy URL; routes the entire login flow.
  - `mobileProfile` — Optional. `"ios"` (default), `"android"`, or an object overriding individual [profile fields](#mobile-app-impersonation).
  - `signal` — Optional. An `AbortSignal`; aborting stops polling and rejects with a `LoginError`.
  - `onSteamGuardRequired` — Optional. `async ({ type, message }) => code`. Called when a code is required and none was supplied (e.g. an email code). Resolve it with the code to continue.

Returns a `Promise` that resolves to a **`LoginResult`**:

- `refreshToken` — The MobileApp refresh token. **Store this** and feed it to `new SteamMobile({ refreshToken })`.
- `accessToken` — The freshly-minted access token, or `undefined` if Steam didn't return one.
- `steamId` — The account's SteamID64, as a string.
- `username` — The account name Steam echoed back.

```ts
import { loginWithCredentials, SteamMobile } from "@assetpay/steam-mobile";

const { refreshToken } = await loginWithCredentials({
  username: "myaccount",
  password: "…",
  sharedSecret: "…",            // answers the device-code 2FA automatically
  // onSteamGuardRequired: async ({ message }) => await promptUser(message),
});

const bot = await new SteamMobile({ refreshToken }).login();
```

Credential login is rate-limited by Steam, so do it once per device and reuse the refresh token. For
finer-grained control over the state machine (events for each step, manual code submission), use the
[`CredentialSession`](#credentialsession-low-level) class directly.

#### CredentialSession (low-level)

`loginWithCredentials` is a thin one-shot wrapper around this `EventEmitter`. Use it directly when you
need to react to each step.

- `new CredentialSession(http, profile[, pollTimeoutMs])` — `http` is an `HttpClient`, `profile` a resolved [`MobileProfile`](#mobile-app-impersonation), `pollTimeoutMs` defaults to 180000.
- `start(options)` — Begins the flow. `options` is the credentials (`username`, `password`, `sharedSecret?`, `steamGuardCode?`). Throws `NoMobileAuthenticatorError` synchronously inside `start()` if `sharedSecret` was supplied but the account isn't TOTP-protected. Returns `Promise<void>`.
- `submitSteamGuardCode(code)` — Supplies a code in response to a `steamGuardRequired` event. Returns `Promise<void>`.
- `stop()` — Aborts the flow and clears the poll timer.
- Properties (populated as the flow progresses): `steamID?`, `username`, `accessToken?`, `refreshToken?`.
- Events:
  - `authenticated` — A refresh token is available; read it off the instance.
  - `steamGuardRequired` — `{ type, message }`. No code could be supplied automatically; call `submitSteamGuardCode()`.
  - `remoteInteraction` — Steam is waiting for the user to approve on their phone (device/email confirmation).
  - `timeout` — The confirmation window elapsed.
  - `error` — `error`. The flow failed.
  - `debug` — `message`. Verbose step logging.

---

## SteamMobile

The root client. It owns the HTTP layer, the session, and the namespaces, and it re-emits every
[trade event](#trade-events) so you can listen on `bot` directly instead of `bot.trade`.

### Constructor: new SteamMobile(options)

- `options`
  - `refreshToken` — **Required.** A MobileApp refresh token (from `loginWithCredentials` or a prior session).
  - `identitySecret` — Optional. Your `identity_secret`, required to **confirm** trades and other mobile confirmations. Read-only operations and sending don't need it.
  - `proxy` — Optional. A proxy URL (`http://user:pass@host:port`, `socks5://…`, etc.). All traffic — API, community, and confirmations — routes through it.
  - `mobileProfile` — Optional. `"ios"` (default), `"android"`, or a `Partial<MobileProfile>` to override individual fields. See [Mobile-app impersonation](#mobile-app-impersonation).
  - `polling` — Optional. `true` to start polling with default cadence after `login()`, or a [`PollOptions`](#polloptions) object to tune it / resume from saved `pollData`.

Throws `SteamSessionExpiredError` synchronously if the refresh token is malformed (no SteamID in its
payload). Does **not** make any network request.

### Properties

- `steamID` — A [`SteamID`](https://github.com/DoctorMcKay/node-steamid) object for the logged-in account. Available immediately after construction.
- `accessToken` — The current access token (`string`), or `undefined` before the first mint.
- `refreshToken` — The current refresh token (`string`). This changes when Steam rotates it; listen for the [`refreshToken`](#event-refreshtoken) event to persist updates.
- `identitySecret` — The `identity_secret` you passed, or `undefined`.
- `trade` — The [TradeNamespace](#bottrade).
- `community` — The [CommunityNamespace](#botcommunity).
- `session` — The [SessionManager](#botsession).
- `confirmations` — The [ConfirmationManager](#botconfirmations).
- `http`, `api` — The low-level `HttpClient` and `WebApiClient`. You normally won't need these.

### login()

Mints the access token (failing fast if the refresh token is dead), applies the `steamLoginSecure`
login cookie, and — if you passed `polling` — starts the poll loop. Returns a `Promise` that resolves
to the `SteamMobile` instance itself, so you can write `const bot = await new SteamMobile(opts).login()`.

### reauthenticate(credentials)

- `credentials` — A `ReauthenticateOptions`: the same fields as [`loginWithCredentials`](#loginwithcredentialsoptions) **except** `proxy` / `mobileProfile`, which are reused from this instance.

Recovers a **dead or revoked** refresh token — one the library can no longer renew (past its ~211-day
life, after a password change, or a Steam revocation). Runs a fresh credential login, swaps the new
refresh token in place, re-mints the access token, and re-emits [`refreshToken`](#event-refreshtoken) so
you can persist it. **Rejects if the credentials are for a different account** than this instance.
Returns `Promise<void>`. Pair it with the [`sessionExpired`](#event-sessionexpired) event.

### ensureApiKey(\[domain])

- `domain` — Optional. The domain to register the key under (default `"assetpay.gg"`). Steam's API-key `domain` is a hostname label, not a URL.

Returns the account's existing Web API key, or registers a new one (auto-accepting the mobile
confirmation prompt if `identitySecret` is set), as a `Promise<string | null>`. Resolves to `null` when
the account is **ineligible** for a key (unverified email, no mobile authenticator, or a
[limited account](#notes--limitations)). This is a convenience passthrough to
[`bot.community.ensureApiKey`](#communityensureapikeydomain).

### request(method, url\[, opts]) · get(url\[, opts]) · post(url\[, opts])

Escape hatch for endpoints the typed namespaces don't cover (like `node-steamcommunity`'s
`httpRequest`). Each ensures the session is live — minting/renewing the access token and applying the
`steamLoginSecure` cookie — *before* sending, so the request carries your logged-in session, then
delegates to [`bot.http`](#properties). Throws `SteamSessionExpiredError` if the session can't be
renewed.

- `method` — `"GET"` or `"POST"`.
- `url` — Absolute URL.
- `opts` — A `RequestOptions`: `searchParams`, `headers`, `referer`, `responseType` (`"text"` default, `"json"`, or `"buffer"`), `signal` (an `AbortSignal` to cancel), `timeoutMs` (per-request timeout override; default 50000), and **exactly one** request body of `form`, `multipart`, `json`, or `body` (raw `string`/`Buffer`).

Returns `Promise<HttpResponse<T>>` (`{ statusCode, headers, body }`). Pass a type parameter and
`responseType: "json"` to get a parsed body.

```ts
const { body } = await bot.get<{ success: boolean }>(
  "https://steamcommunity.com/market/priceoverview/",
  { searchParams: { appid: 730, market_hash_name: "Mag-7 | Heat (Field-Tested)", currency: 1 }, responseType: "json" },
);

await bot.post("https://steamcommunity.com/some/endpoint", {
  json: { sessionid: await bot.http.getSessionId(), foo: "bar" },
});
```

For requests where you *don't* want the session ensured first, use `bot.http` directly.

### shutdown()

Stops the poll loop and removes all event listeners (on both `bot` and `bot.trade`). Call this when
you're done with the client so it doesn't keep timers alive. Returns a `Promise<void>`.

### Events

`SteamMobile` re-emits all [trade events](#trade-events) (`newOffer`, `sentOfferChanged`,
`receivedOfferChanged`, `unknownOfferSent`, `pollData`, `pollSuccess`, `pollFailure`, `debug`) plus two
of its own:

#### Event: refreshToken

- `token` — The new refresh token (`string`).

Emitted when Steam rotates your refresh token (which happens automatically near end-of-life). **Persist
the new value** — the old one stops working.

#### Event: sessionExpired

- `error` — A `SteamSessionExpiredError`.

Emitted when the refresh token is rejected or expired and the session can no longer be renewed. It fires
only on a **confirmed-terminal** auth failure (not a transient blip), so it's safe to trigger re-auth
on: call [`bot.reauthenticate(credentials)`](#reauthenticatecredentials).

---

## bot.trade

The trade namespace. It's an `EventEmitter` (see [Trade events](#trade-events)) and holds every method for
reading, sending, and watching trade offers.

### createOffer(target)

- `target` — An [`OfferTarget`](#offertarget): either `{ tradeUrl }` or `{ steamId, token? }`.

Creates a new, empty [TradeOffer](#tradeoffer) addressed to the partner. **Local only** — nothing is
sent to Steam until you call [`offer.send()`](#send). Chain `.give()` / `.receive()` / `.setMessage()`
to build it.

### getTradeOffer(id)

- `id` — The trade offer's numeric id, as a string.

Fetches a single offer and returns it as a [TradeOffer](#tradeoffer). Item descriptions are inlined
(`get_descriptions=1`), so the offer's items are full [`EconItem`](#econitem)s. Rejects with a
`SteamError` if the offer doesn't exist.

### getTradeOffers(\[filter]\[, historicalCutoff])

- `filter` — Optional. A value from [`EOfferFilter`](#eofferfilter) (default `ActiveOnly`).
- `historicalCutoff` — Optional. A `Date`. When `filter` includes historical offers, only offers updated at or after this time are returned. Defaults to one year in the future (i.e. "active only").

Returns `Promise<{ sent: TradeOffer[]; received: TradeOffer[] }>`. This cursor-paginates **all** pages
internally and inlines descriptions into every offer's items. If Steam returns the wholly-malformed
"data temporarily unavailable" glitch (all offers missing partner/items), this rejects with a
`SteamError` rather than handing back garbage.

### getTradeStatus({tradeId})

- `tradeId` — The **trade id** (not the offer id). This is set on a [TradeOffer](#tradeoffer) once it's accepted (`offer.tradeID`).

Returns settlement details for a completed or escrowed trade as a `Promise<`[`ExchangeDetails`](#exchangedetails)`>`,
including where each item *landed* after the trade (`new_assetid` / `new_contextid`, when Steam provides
them). See [`offer.getTradeStatus()`](#gettradestatus) for the offer-level shortcut.

### getUserDetails(target)

- `target` — An [`OfferTarget`](#offertarget) (typically `{ tradeUrl }`).

Persona, contexts, escrow days, avatars, and partner probation for both sides — same scrape as
[`offer.getUserDetails()`](#getuserdetails) but addressed by target, so you don't need an offer in
hand. Returns `Promise<`[`UserDetails`](#userdetails)`>`. **Steam applies
`max(me.escrowDays, them.escrowDays)`** as the actual hold — compute that yourself if you need a
single number.

### getEscrow(target)

- `target` — An [`OfferTarget`](#offertarget) (typically `{ tradeUrl }`).

Escrow hold (in **seconds**) via `IEconService/GetTradeHoldDurations`. Returns
`Promise<`[`EscrowHold`](#escrowhold)`>` shaped `{ me, them, both }` (top-level renamed from Steam's
`my_escrow` / `their_escrow` / `both_escrow`; inner shape preserved 1:1). Lightweight — just the
WebAPI, no scrape, no other user data. For everything together (escrow + persona + avatars +
contexts), use [`getUserDetails`](#getuserdetailstarget) above (or [`offer.getUserDetails()`](#getuserdetails))
instead.

### getTradeHistory(\[options])

- `options` — Optional [`TradeHistoryOptions`](#tradehistoryoptions):
  - `maxTrades` — Max trades to return (default 100).
  - `startAfterTime` / `startAfterTradeId` — Cursor: the time and id of the last trade from the previous page. Pass both to fetch the next page.
  - `navigatingBack` — Page backwards (toward newer trades) instead of forward.
  - `includeFailed` — Include failed/rolled-back trades.
  - `includeTotal` — Ask Steam for the total trade count (populates `totalTrades`).

Returns past trades, newest first, as a `Promise<`[`TradeHistory`](#tradehistory)`>`. Each entry is a
fully-parsed [`ExchangeDetails`](#exchangedetails) plus its `tradeId` and `partnerSteamId`. To page,
take the last entry's `tradeInitTime`/`tradeId` and pass them as `startAfterTime`/`startAfterTradeId`
while `more` is `true`.

### getTradeOffersSummary()

Returns counts of pending/new/historical sent & received offers (and escrow counts) as a
`Promise<`[`TradeOffersSummary`](#tradeofferssummary)`>`. Cheap; useful as a "do I have anything to
look at?" check before a full `getOffers`.

### reconcile(ids)

- `ids` — An array of trade offer id strings.

Re-reads each id in parallel and returns a `Promise<Map<string, TradeOffer>>` keyed by id. **Missing or
errored ids are skipped**, so one bad id can't fail the whole batch. This is the authoritative,
poll-free way to track offers you've sent: persist the id from `send()`, then reconcile it on demand.

### getOffersContainingItems(items\[]\[, includeInactive])

- `items` — An array of `{ appid, contextid, assetid }` item references.
- `includeInactive` — Optional. If `true`, searches all offers; otherwise active only (default `false`).

Returns the offers that contain **all** of the given items, as a `Promise<TradeOffer[]>`.

### getInventory(target, appid\[, contextid]\[, options])

- `target` — An [`OfferTarget`](#offertarget) identifying whose inventory to load (typically a partner via `{ tradeUrl }`).
- `appid` — The app id (e.g. `730` for CS2, `252490` for Rust).
- `contextid` — Optional. The context id (default `"2"`).
- `options`
  - `tradableOnly` — Optional. If `true`, only tradable items are returned (default `false`).

Loads a **partner's** inventory through the trade-offer page (`/tradeoffer/new/partnerinventory/`),
which is the reliable way to see a partner's items — including trade-protected ones that the public
`/inventory/` endpoint hides. Returns `Promise<`[`EconItem`](#econitem)`[]>`, paginated automatically.
For your *own* inventory, prefer [`bot.community.getInventory`](#getinventoryappid-contextid-options).

On failure, the partner's trade page is lazily scraped for Steam's `<div id="error_msg">` and the
message is classified into the right typed [error](#errors) (`PrivateInventoryError`,
`TradeBanError`, `TargetCannotTradeError`, `ItemServerUnavailableError`, …).

### startPolling(\[options])

- `options` — Optional [`PollOptions`](#polloptions):
  - `pollInterval` — Active-poll cadence in ms (default `10000`).
  - `pollFullUpdateInterval` — Full-sweep cadence in ms (default `300000`).
  - `pollData` — A saved [`PollData`](#polldata) snapshot to resume from (so a restart doesn't re-emit known offers).
  - `store` — A [`PollDataStore`](#polldatastore) loaded on start and saved after each changed tick (e.g. Redis-backed). Default: in-memory only.
  - `maxAgeMs` — Retention window in ms (default `2592000000`, 30d). Terminal offers older than this are pruned from the snapshot, and the full sweep is bounded to this window.
  - `cancelTime` — If set, auto-cancels a sent offer still `Active` this many ms after its last update, emitting [`sentOfferCanceled`](#event-sentoffercanceled). Off by default.

Starts the poll loop. The library does an **active poll** (recently-changed offers only) on the short
interval and a periodic **full sweep** (offers updated within the retention window, to catch backdated
state changes) on the long interval. State changes are diffed against the last snapshot and surfaced as
[events](#trade-events). The loop never dies on a rate limit — it backs off and resumes. Calling this
again replaces the running loop.

### stopPolling()

Stops the poll loop.

### pollOnce(\[options])

- `options` — Optional. A [`PollOptions`](#polloptions) (used to configure the lazily-created poller on first call) plus `forceFull?` to force a full sweep this cycle.

Runs a **single, timer-less** poll cycle, for driving cadence from an external scheduler (e.g. a BullMQ
cron) instead of the built-in timer. Returns `Promise<{ changes:`[`PollChange`](#pollchange)`[]; pollData: PollData }>`.
With a [`store`](#polldatastore) it loads the snapshot, diffs, emits the usual [events](#trade-events),
saves, and returns the diff. `lastFullUpdate` is persisted inside `pollData`, so a fresh instance per
job still keeps the full-sweep cadence (it won't degrade to a full sweep every call). The poller is
created lazily and reused, so pass config once. Unlike the timer loop, this **throws** on a fetch
failure so your scheduler can handle it.

### pollData (getter)

A getter returning the current [`PollData`](#polldata) snapshot, or `undefined` if polling isn't
running. Usually you persist this via the [`pollData` event](#event-polldata) rather than reading it
directly.

### Trade events

`bot.trade` (and `bot`, which re-emits them) emits:

#### Event: newOffer

- `offer` — A [TradeOffer](#tradeoffer) for the newly-received offer.

Emitted when someone sends you a new trade offer.

#### Event: receivedOfferChanged

- `offer` — The [TradeOffer](#tradeoffer) in its new state.
- `oldState` — The previous [`ETradeOfferState`](#etradeofferstate).

Emitted when an offer you received changes state (e.g. you accepted it elsewhere, or it expired).

#### Event: sentOfferChanged

- `offer` — The [TradeOffer](#tradeoffer) in its new state.
- `oldState` — The previous [`ETradeOfferState`](#etradeofferstate).

Emitted when an offer you sent changes state (e.g. the partner accepted or declined it).

#### Event: unknownOfferSent

- `offer` — The [TradeOffer](#tradeoffer).

Emitted when polling sees a sent offer it has no record of — either sent out-of-band (not via this
client) or seen on the first cold poll.

#### Event: sentOfferCanceled

- `offer` — The [TradeOffer](#tradeoffer) that was canceled.
- `reason` — Why it was canceled; currently always `"cancelTime"`.

Emitted when the poll loop auto-cancels a sent offer because it stayed `Active` past
[`cancelTime`](#startpollingoptions). The resulting `Active → Canceled` transition also surfaces as a
normal [`sentOfferChanged`](#event-sentofferchanged) on a later poll.

#### Event: offerUpdate

- `update` — A [`TradeOfferUpdate`](#tradeofferupdate) `{ offer, previousState? }`.

Fires once for **every** offer change, alongside the specific named event above. `previousState` is
`undefined` the first time an offer is observed; `offer.isOurOffer` distinguishes sent vs received. Use
this when you want a single handler for all changes (e.g. forwarding to a queue); use the named events
when you want to react to one kind.

#### Event: pollData

- `data` — The new [`PollData`](#polldata) snapshot.

Emitted whenever the poll snapshot changes. **Persist this** and pass it back as `pollData` on the next
`startPolling` to resume without re-emitting offers you've already handled.

#### Event: pollSuccess

Emitted after each successful poll cycle.

#### Event: pollFailure

- `error` — The `Error` that caused the failed poll.

Emitted when a poll cycle fails. The loop keeps running; this is informational.

#### Event: debug

- `message` — A human-readable debug string.

Verbose internal logging (cursor pages, mint/renewal, backoff). Listen on this while developing.

---

## TradeOffer

Represents a single trade offer — either one you're building to send, or one fetched from Steam. Build
offers with [`bot.trade.createOffer`](#createoffertarget); fetch them with
[`bot.trade.getTradeOffer`](#gettradeofferid) / `getOffers` / `getTradeOffers`.

### Offer properties

- `id` — The offer id (`string`), or `undefined` before it's been sent.
- `partner` — A [`SteamID`](https://github.com/DoctorMcKay/node-steamid) for the other party.
- `token` — The partner's trade-URL token (`string`), if known.
- `message` — The offer message (≤128 chars).
- `state` — The current [`ETradeOfferState`](#etradeofferstate).
- `itemsToGive` — Array of [`TradeItem`](#tradeitem) (full [`EconItem`](#econitem)s on fetched offers) you'd give up.
- `itemsToReceive` — Array of items you'd receive.
- `isOurOffer` — `true` if we sent it, `false` if we received it.
- `tradeID` — The trade id once accepted (`string`), or `undefined`. Needed for [`getTradeStatus()`](#gettradestatus).
- `confirmationMethod` — An [`EConfirmationMethod`](#econfirmationmethod) (`MobileApp`, `Email`, or `None`).
- `escrowEnds` — A `Date` when the Steam Guard escrow hold ends, or `undefined`.
- `settlementDate` — A `Date` when the 2025 trade-protection hold ends and items become final, or `undefined`. Equals the trade's `time_settlement` (~7–8 days after accept); set only once `Accepted`. Separate from `escrowEnds`.
- `delaySettlement` — `true` when the trade's items are subject to the trade-protection settlement delay.
- `created` / `updated` / `expires` — `Date`s, or `undefined`.
- `fromRealTimeTrade` — `true` if this came from a real-time trade session.
- `glitched` — `true` when the offer is missing item names (descriptions not ready) or has no items. Polling won't advance its cutoff past a glitched offer, so it gets re-polled until complete.

### give(items)

- `items` — An array of [`TradeItem`](#tradeitem) (`{ appid, contextid, assetid, amount? }`).

Adds items **you** will give. Chainable (returns the offer). Array-only.

### receive(items)

- `items` — An array of [`TradeItem`](#tradeitem).

Adds items you'll receive from the partner. Chainable.

### setMessage(message)

- `message` — The offer message (truncated to 128 characters).

Sets the message. Chainable. Throws if the offer has already been sent.

### send()

Sends the offer. Before sending it best-effort acknowledges the 2025 trade-protection notice (which
Steam otherwise blocks new offers on). Returns a `Promise` resolving to a **`SendResult`**:

- `"sent"` — The offer is live; `offer.id` and `offer.state` (`Active`) are now set.
- `"needs_confirmation"` — The offer was created but needs a mobile/email confirmation. Call [`confirm()`](#confirm).

Throws a typed [error](#errors) on failure (e.g. `OfferLimitError`, `TradeBanError`,
`SteamSessionExpiredError`). Throws if the offer is empty or already sent.

### accept()

Accepts an offer **you received**. Returns a `Promise` resolving to an **`AcceptResult`**:

- `"accepted"` — Done; items have transferred.
- `"escrow"` — Accepted but held in escrow (`offer.escrowEnds` tells you until when).
- `"needs_confirmation"` — Needs a mobile/email confirmation; call [`confirm()`](#confirm).

Because the accept response doesn't itself flag escrow, this re-reads the offer afterward to tell a
held trade from a settled one (best-effort; falls back to `"accepted"`). Throws if the offer isn't
active, is our own, or on a Steam error.

### cancel()

Cancels an offer you sent (or, for a received offer, declines it) via the community endpoint — the Web
API rejects the mobile token for this. Returns `Promise<void>`. Throws if the offer isn't active /
pending-confirmation.

### decline()

Alias for [`cancel()`](#cancel); use it for readability on received offers.

### confirm()

Accepts the pending mobile confirmation for this offer (after `send()`/`accept()` returned
`"needs_confirmation"`). Returns `Promise<void>`. Throws a `ConfirmationError` immediately if the
offer is unsent, if `identitySecret` wasn't supplied to the `SteamMobile` constructor (named-fix
message: *"identitySecret is required to confirm trade offers — construct SteamMobile with
{ identitySecret }"*), or if no matching confirmation is found.

### counter()

Returns a **new** unsent [TradeOffer](#tradeoffer) to the same partner, pre-filled with this offer's
items and message (deep-copied, so editing the counter won't mutate the original). Edit it and call
`send()`; sending marks the original as countered. Throws if the original isn't active.

### getTradeStatus()

Shortcut for [`bot.trade.getTradeStatus({ tradeId: this.tradeID })`](#gettradestatustradeid). Returns
`Promise<`[`ExchangeDetails`](#exchangedetails)`>`. Throws if the offer has no `tradeID` (i.e. it hasn't
been accepted).

### getPartnerInventory(appid\[, contextid]\[, tradableOnly])

- `appid` — App id.
- `contextid` — Optional context id (default `"2"`).
- `tradableOnly` — Optional. Tradable items only.

Loads the **partner's** inventory, reusing this offer's partner and token. Returns
`Promise<`[`EconItem`](#econitem)`[]>`.

### getUserDetails()

Persona, contexts, escrow days, avatars, and partner probation for both sides — McKay-parity. Scrapes
the trade page once. Picks the URL based on the offer's state: `/tradeoffer/<id>/` for offers that
have already been sent, otherwise `/tradeoffer/new/?partner=…[&token=…]` for an unsent draft. Returns
`Promise<`[`UserDetails`](#userdetails)`>`. **Steam applies `max(me.escrowDays, them.escrowDays)`** as
the actual hold — compute that yourself if you need a single number.

Use this when you already have a `TradeOffer` in hand. If you only have a tradeUrl/SteamID, prefer
the top-level [`bot.trade.getUserDetails(target)`](#getuserdetailstarget) — same scrape, no offer
construction needed.

Throws when called on an offer where Steam doesn't render trade info:

- An offer **we sent** (`isOurOffer === true` with `this.id` set) — Steam shows our own offers from a
  different view. Use [`bot.trade.getUserDetails(target)`](#getuserdetailstarget) instead.
- An offer **received** but no longer `Active` (already accepted, declined, expired, etc.).

### containsItem(item)

- `item` — `{ appid, contextid, assetid }`.

Returns `true` if either side of the offer contains that exact asset.

---

## bot.community

Account- and profile-level helpers backed by `steamcommunity.com` and a couple of Web API calls.

### getInventory(appid\[, contextid]\[, options])

- `appid` — App id.
- `contextid` — Optional context id (default `"2"`).
- `options`
  - `steamId` — Optional. Whose inventory to load (default: yourself).
  - `tradableOnly` — Optional. If `true`, only tradable items are returned (default `false`). For your
    own inventory this is applied server-side via the legacy endpoint's `trading=1` flag; for other
    users it's applied in the parser.

Loads your own inventory — or any **public** inventory — paginated automatically. Returns
`Promise<`[`EconItem`](#econitem)`[]>`. Throws `PrivateInventoryError` on a private inventory (the
lazy trade-page scrape also classifies trade-ban / target-cannot-trade / item-server-unavailable
errors into their typed counterparts).

Routes by target:

- **Self** → the legacy `/profiles/<id>/inventory/json/<appid>/<contextid>` endpoint (cookie path,
  near-nonexistent rate limits, surfaces trade-protected items). The modern
  `IEconService/GetInventoryItemsWithDescriptions` is avoided here — Steam silently returns
  `{response:{}}` on ≥2 calls/sec, making it unfit for repeated use.
- **Other user** → the public `/inventory/` endpoint (cookie path).

For a trade **partner's** inventory, use
[`bot.trade.getInventory`](#getinventorytarget-appid-contextid-options) instead — `/partnerinventory/`
is the only path that reveals trade-protected items.

### getTradeURL()

Returns your current trade URL and token as `Promise<{ url: string; token: string }>`.

### changeTradeURL()

Regenerates (and thereby **invalidates**) your trade URL/token. Returns the new
`Promise<{ url: string; token: string }>`.

### getProfile(\[steamId])

- `steamId` — Optional. Whose profile to read (default: yourself).

Reads a profile summary from the community XML in a **single request**. Returns a
`Promise<`[`SteamProfile`](#steamprofile)`>` with persona, avatar, account-creation date, trade-ban
state, VAC status, privacy state, and the `isLimited` flag. (Steam level isn't in the XML — use
`getSteamLevel`.)

### getSteamLevel(\[steamId])

- `steamId` — Optional (default: yourself).

Returns the account's Steam level as a `Promise<number>` via `IPlayerService/GetSteamLevel` (which
accepts the access token — no API key required).

### community.ensureApiKey(\[domain])

- `domain` — Optional hostname for the key (default `"assetpay.gg"`).

Returns the existing Web API key, or registers a new one (auto-accepting the mobile confirmation if
`identitySecret` is set), as `Promise<string | null>`. Resolves to `null` when the account is
ineligible (unverified email, no authenticator, or limited). The registration flow handles Steam's
Pending → confirm → retry handshake for you.

### acknowledgeTradeProtection()

Acknowledges the 2025 trade-protection notice. Called automatically by [`send()`](#send); exposed here
for completeness. Returns `Promise<void>`.

---

## bot.market

The Steam Community Market. Needs an account that can use the market (not limited). Responses are
returned as Steam sends them (snake_case, unknown fields preserved); nothing is retried — rate limits
surface as `RateLimitError` (HTTP 429), and the order book's 403 wall as `ThrottledError`.

### getWalletDetails()

Returns the wallet via `IUserAccountService/GetClientWalletDetails` as `Promise<RawWalletDetails>`:
`has_wallet`, `balance` / `delayed_balance` (int64 cents, as strings), `currency_code` (the wallet
currency id — `1` USD, `3` EUR, …), `formatted_balance`, and the rest of Steam's fields.

### getMyListings(\[options])

- `options`
  - `currency` — Optional. Wallet currency id, sent as `currency`.

Loads every page of your listings. Returns `Promise<MyListings>`:
`{ listings, listings_to_confirm, buy_orders, num_active_listings }` with Steam's raw entries. A
listing's `price` is what you receive and `fee` Steam's cut (the buyer pays `price + fee`).
`listings_to_confirm` are listings still awaiting mobile confirmation; their item can't be relisted
until the listing is confirmed or removed with [`cancelListing`](#cancellistinglistingid).

### getMyHistory(\[options])

- `options`
  - `count` — Optional. Rows per page (default `500`).
  - `start` — Optional. Row offset, for paging back.

Parses the rendered market history into `Promise<MarketHistory>`:
`{ events, sales, purchases, listingEvents, totalCount }` — `events` is every row in page order
(newest first), the others split it by `type`. Every event has `historyId`
(`history_row_<listingid>_<eventid>`), `listingid`, `eventid`, `type`, `itemName`, `gameName`, `actedOn` /
`listedOn` (display dates, no year), `displayPrice` and `priceInCents` (also as `receivedAmount` on
sales and `paidAmount` on purchases). Sales and purchases also carry the asset: `appID`,
`contextID`, `assetID`, `classID`, `instanceID`, `marketName`, `unOwnedContextID`, `unOwnedID`.
Throws if a real price string parses to 0 cents. `parseMarketHistory(body)` is exported for raw
responses.

### getOrderbook(appid, marketHashName\[, options])

- `options`
  - `expectedCurrency` — Optional. Throw instead of returning a book in any other currency.

Returns the live order book as `Promise<RawOrderbookData>`: `eCurrency`, `amtMinSellOrder` /
`amtMaxBuyOrder` (best ask / bid in cents, `null` — not `NaN` — when that side is empty), and
`rgCompactSellOrders` / `rgCompactBuyOrders` (flat `[price, qty, price, qty, …]`, best first). The
endpoint always answers in the wallet currency. A 403 here is Steam's order-book throttle wall and
throws `ThrottledError`.

### getPriceHistory(appid, marketHashName)

Returns the price history rows as `Promise<RawPriceHistoryPoint[]>` —
`[date, price (major units), volume]`; `[]` for an item without sales history. Throws when Steam
answers `success: false`.

### getMarketItemDetails(appid, marketHashName)

Searches the market and returns the row whose `hash_name` matches exactly (`sell_listings`,
`asset_description`), or `null`.

### sellItem(options)

- `options`
  - `appid`, `assetid`
  - `price` — What **you** receive, in cents (the buyer pays this plus fees).
  - `contextid` — Optional (default `"2"`).
  - `amount` — Optional (default `1`).

Lists an item and returns Steam's response as `Promise<RawSellItemResponse>`. The listing still needs
its mobile confirmation — see [`confirmListings`](#confirmlistingsexpected). Refusals throw
`MarketConfirmationLimitError`, `WalletBalanceLimitError` or `MarketBlockedError`, otherwise a
`SteamError` with Steam's message.

### cancelListing(listingId)

Removes a listing. Returns `Promise<void>`.

### createBuyOrder(options)

- `options`
  - `appid`, `marketHashName`, `quantity`
  - `priceTotal` — Price per unit × quantity, in cents.
  - `currency` — Wallet currency id.

Places a buy order and returns its `buy_orderid` as `Promise<string>`. When Steam answers with a
mobile confirmation (HTTP 406), it is accepted (needs `identitySecret`) and the order finalized. A
refusal is a `SteamError` whose `eresult` is Steam's code. Not retried: the confirmation id carries
between steps, so re-run the whole call — but a failure after the confirmation was accepted may
still have placed the order, so check [`getMyListings`](#getmylistingsoptions) first.

### cancelBuyOrder(buyOrderId)

Cancels a buy order and returns Steam's response as `Promise<RawCancelBuyOrderResponse>`.

### confirmListings(expected)

- `expected` — `{ [market_hash_name]: number of listings created }`.

Accepts the pending market-listing confirmations that match, in one request: oldest first, exact name
first, then a substring match (the confirmation text can omit the wear; an empty one never matches). Returns
`Promise<{ confirmed, skipped }>` ([`Confirmation`](#confirmation)`[]` each); unmatched ones stay
pending in `skipped`.

### rejectListings(\[types])

- `types` — Optional [`EConfirmationType`](#econfirmationtype)`[]` (default `[MarketListing]`; pass
  `[BuyOrder]` for buy orders).

Rejects every pending confirmation of those types in one request and returns them. Other types are
never touched.

---

## bot.session

The `SessionManager` owns the token lifecycle. You rarely call it directly — the namespaces refresh the
access token for you — but it's where session control lives.

### getAccessToken()

Returns a valid access token, minting or renewing it if needed, as `Promise<string>`. Concurrent calls
share one in-flight mint. Throws `SteamSessionExpiredError` if the session has been revoked or the
refresh token is dead.

### listSessions()

Returns the client ids of in-progress auth sessions (login-approval flows) as `Promise<bigint[]>`.
Note: this is **not** a list of logged-in devices — it reflects pending `IAuthenticationService`
sessions.

### logout(\[action])

- `action` — Optional [`EAuthTokenRevokeAction`](#eauthtokenrevokeaction) (default `Logout`).

Revokes this refresh token server-side. Afterward the session is dead and any further call throws
`SteamSessionExpiredError`. Returns `Promise<void>`.

### setRefreshToken(refreshToken)

- `refreshToken` — A fresh MobileApp refresh token for the **same** account.

Swaps in a new refresh token and re-mints in place — the mechanism behind
[`bot.reauthenticate`](#reauthenticatecredentials). Re-emits [`refreshToken`](#event-refreshtoken).
Throws if the token is malformed or belongs to a different account. Returns `Promise<void>`.

### Properties & events

- `refreshToken` / `accessToken` / `steamID` — Same values surfaced on [`SteamMobile`](#properties).
- Events: `refreshToken`, `sessionExpired`, `debug` — re-emitted on the root client.

---

## bot.confirmations

The `ConfirmationManager` for mobile confirmations. **Prefer [`offer.confirm()`](#confirm)** for trades;
these cover other cases (market listings, API-key requests, manual flows). All require `identitySecret`.

The high-level helpers below derive the TOTP time and HMAC key for you — you normally only need these.
The lower-level `getConfirmations`/`respondToConfirmation` remain for when you want to compute keys yourself.

### getPending()

Returns all outstanding confirmations as `Promise<`[`Confirmation`](#confirmation)`[]>`, deriving the
list HMAC automatically.

### acceptConfirmation(id, nonce) · rejectConfirmation(id, nonce)

Accept or reject (cancel) a single confirmation by its `id` and `nonce` (the `key` field from
[`getPending`](#getpending)). Each returns `Promise<void>` and handles the time-offset + per-request
HMAC timestamp for you.

### acceptConfirmations(confs) · rejectConfirmations(confs)

- `confs` — The confirmations to act on (`id` + `key`, e.g. from [`getPending`](#getpending)).

Accept or reject a selected set in one request. Returns `Promise<void>`; an empty set is a no-op.

### acceptAll()

Accepts every pending confirmation and resolves to the [`Confirmation`](#confirmation)`[]` it acted on.
Fails fast on the first error.

```ts
for (const c of await bot.confirmations.getPending()) console.log(c.title);
await bot.confirmations.acceptAll();
```

### getConfirmations(time, key)

- `time` — A Unix timestamp (use the manager's server-time-corrected clock).
- `key` — A confirmation key, or `{ tag, key }`.

Returns the outstanding confirmations as `Promise<`[`Confirmation`](#confirmation)`[]>`.

### respondToConfirmation(confID, confKey, time, key, accept)

- `confID` — The confirmation id, or an array of ids.
- `confKey` — The confirmation's nonce, or an array of nonces (same order as `confID`).
- `time` — A Unix timestamp.
- `key` — A confirmation key, or `{ tag, key }`.
- `accept` — `true` to allow, `false` to cancel.

Accepts or rejects the confirmation(s) in one request. Returns `Promise<void>`.

### acceptConfirmationForObject(objectID)

- `objectID` — The id of the object the confirmation is for (e.g. a trade offer id, or an API-key request id).

Finds and accepts the confirmation tied to that object, handling the time-offset and per-request HMAC
timestamps for you. Returns `Promise<void>`. Throws a `ConfirmationError` if no matching confirmation
exists.

---

## decodePreviewToken

A standalone helper (not on the bot) that decodes a **CS2 masked preview token** — the inspect-data
blob Steam ships in an item's `asset_properties` under `propertyid: 6` (the "certificate") — into a
plain JSON object. The same masked format is used by `csgo_econ_action_preview` market inspect tokens.
Decoding is fully offline (XOR-unmask → protobuf), so no game-coordinator call is needed.

```ts
import { decodePreviewToken } from "@assetpay/steam-mobile";

const cert = item.asset_properties.find((p) => p.propertyid === 6)?.string_value;
const data = decodePreviewToken(cert);
// {
//   itemid: "51663785755", defindex: 4, paintindex: 230, rarity: 4, quality: 9,
//   paintwear: 0.18685653805732727, paintseed: 34,
//   stickers: [{ slot: 2, stickerId: 6618 }, …],
//   inventory: 3221225475, origin: 8,
//   keychains: [{ slot: 0, stickerId: 54, offsetX: -1.55…, pattern: 34792 }],
// }
```

- `hex` — The raw certificate hex (or any `[xorKey][protobuf][crc32]` masked blob). Pass it as-is; no
  trimming or tag-stripping needed.
- Returns the decoded [`CEconItemPreviewDataBlock`](https://github.com/SteamDatabase/Protobufs/blob/master/csgo/cstrike15_gcmessages.proto#L917)
  as a plain object (`Record<string, unknown>`), or `null` for non-hex / undecodable input.

Output notes: `itemid` (uint64) is a **string**, fields are **camelCase** (`sticker_id` → `stickerId`,
`offset_x` → `offsetX`), only fields actually present on the wire are included, and `paintwear` is
returned as the **float wear** (`0..1`) rather than its raw uint32 bits.

> S/A/D inspect links (the ones with a `D…` parameter) are **not** decodable this way — those carry no
> embedded data and require a live game-coordinator lookup.

---

## encodePreviewToken

The inverse of [`decodePreviewToken`](#decodepreviewtoken) — takes the JSON shape that one returns and
packs it back into a masked token. Useful for minting an inspect link for an item that doesn't exist
(previewing a float/seed combination), or for re-emitting a token after tweaking a field.

```ts
import { decodePreviewToken, encodePreviewToken } from "@assetpay/steam-mobile";

const data = decodePreviewToken(cert);
encodePreviewToken(data, 0x2e) === cert; // true — exact round-trip, key included

// Preview the same skin at a different float and pattern seed:
const hex = encodePreviewToken({ ...data, paintwear: 0.01, paintseed: 661 });
const link = `steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20${hex}`;
```

- `data` — a [`CEconItemPreviewDataBlock`](https://github.com/SteamDatabase/Protobufs/blob/master/csgo/cstrike15_gcmessages.proto#L917)
  as a plain object, in the same camelCase/string-uint64 form `decodePreviewToken` returns.
- `xorKey` — the mask byte (default `0`). `0` leaves the payload readable; any other byte masks it the
  way CS2's own links do. Purely cosmetic — the key travels in plaintext as byte 0.
- Returns uppercase hex, or `null` if `data` isn't a valid preview block or `xorKey` isn't a byte.

`paintwear` is read as the **float wear** (`0..1`) and re-packed into its uint32 bits. It is stored as a
**float32**, so a value typed as a decimal comes back rounded to ~7 significant digits
(`0.1` → `0.10000000149011612`); values already read out of a real token round-trip exactly.

> The trailing checksum is an unkeyed CRC32 over `[xorKey, ...protobuf]` — an integrity code, **not** a
> signature. Masked tokens are self-contained and unauthenticated: CS2 renders them client-side without
> asking Valve whether the item exists. Nothing here forges ownership of anything.

---

## Data types

### OfferTarget

Identifies a trade partner. It's a discriminated union — supply **one** of the two shapes:

```ts
type OfferTarget =
  | { tradeUrl: string }            // a full trade URL (partner + token parsed out)
  | { steamId: string; token?: string };  // a SteamID64, optionally with a trade token
```

### TradeItem

The minimal shape needed to put an item into an offer:

```ts
interface TradeItem {
  appid: number;
  contextid: string;
  assetid: string;
  amount?: number; // default 1
}
```

### EconItem

The fully-typed item, with Steam's fields preserved 1:1 (snake_case, lossless). Returned by every
inventory and offer read. Key fields:

- `appid` (number), `contextid`, `assetid`, `classid`, `instanceid`, `amount`, `currencyid?`
- `name`, `market_name`, `market_hash_name`, `type`, `name_color?`, `background_color?`
- `icon_url`, `icon_url_large?`
- `tradable`, `marketable`, `commodity` (booleans), `market_tradable_restriction`, `market_marketable_restriction` (numbers)
- `descriptions`, `owner_descriptions` ([`SteamDescriptionLine`](#data-types)[]), `actions`, `market_actions` (`SteamAction[]`), `fraudwarnings` (string[]), `tags` (`SteamTag[]`)
- `asset_properties` ([`AssetProperty`](#data-types)[]) — CS2 float/seed/sticker data when present; decode the `propertyid: 6` certificate with [`decodePreviewToken`](#decodepreviewtoken)
- Any other field Steam returns is preserved (`[key: string]: unknown`).

### ExchangeItem

An [`EconItem`](#econitem) plus where it landed after the trade settled:

```ts
interface ExchangeItem extends EconItem {
  new_assetid?: string;        // Rust populates these; CS2 usually omits them
  new_contextid?: string;
  rollback_new_assetid?: string;
  rollback_new_contextid?: string;
}
```

### ExchangeDetails

Returned by [`getTradeStatus`](#gettradestatustradeid):

```ts
interface ExchangeDetails {
  status: ETradeStatus;
  tradeInitTime: Date;
  settlementTime: Date | null;   // when items were actually delivered
  receivedItems: ExchangeItem[];
  sentItems: ExchangeItem[];
  usedInventoryFallback: boolean; // always false — surfacing new_assetid is enough; reconciling by inventory diff is the server's job
}
```

### TradeHistory

Returned by [`getTradeHistory`](#gettradehistoryoptions):

```ts
interface TradeHistory {
  trades: TradeHistoryEntry[];   // newest first
  more: boolean;                 // are there more pages?
  totalTrades: number | undefined; // only when includeTotal was set
}

interface TradeHistoryEntry extends ExchangeDetails {
  tradeId: string;
  partnerSteamId: string | undefined;
}
```

### TradeHistoryOptions

See [`getTradeHistory`](#gettradehistoryoptions) for field meanings: `maxTrades?`, `startAfterTime?`,
`startAfterTradeId?`, `navigatingBack?`, `includeFailed?`, `includeTotal?`.

### TradeOffersSummary

Returned by [`getTradeOffersSummary`](#gettradeofferssummary) — all `number`:

`pending_received_count`, `new_received_count`, `updated_received_count`, `historical_received_count`,
`pending_sent_count`, `newly_accepted_sent_count`, `updated_sent_count`, `historical_sent_count`,
`escrow_received_count`, `escrow_sent_count`.

### SteamProfile

Returned by [`getProfile`](#getprofilesteamid):

```ts
interface SteamProfile {
  steamId: string;
  personaName: string;
  avatar: string;
  accountCreated: Date | null;
  tradeBanState: string;   // e.g. "None"
  isLimited: boolean;
  vacBanned: boolean;
  privacyState: string;    // e.g. "public"
}
```

### UserDetails

Returned by [`bot.trade.getUserDetails(target)`](#getuserdetailstarget) and
[`offer.getUserDetails()`](#getuserdetails) — mirrors steamcommunity's `TradeOffer#getUserDetails`:

```ts
interface UserDetails {
  me: UserSideDetails;
  them: UserPartnerDetails;
}

interface UserSideDetails {
  personaName: string;
  contexts: Record<string, unknown> | null;
  escrowDays: number;             // your side; Steam holds for max(me, them) days
  avatarIcon: string | undefined; // .jpg
  avatarMedium: string | undefined; // _medium.jpg
  avatarFull: string | undefined;   // _full.jpg
}

interface UserPartnerDetails extends UserSideDetails {
  probation: boolean; // partner is on Steam-trade probation (see Steam's warning banner)
}
```

### EscrowHold

Returned by [`bot.trade.getEscrow`](#getescrowtarget) — escrow-only, in **seconds**. Top-level keys
renamed from Steam's `my_escrow`/`their_escrow`/`both_escrow`; inner shape preserved 1:1:

```ts
interface EscrowHold {
  me: EscrowSide;
  them: EscrowSide;
  both: EscrowSide;
}

interface EscrowSide {
  escrow_end_duration_seconds: number;
}
```

### PollData

The poll snapshot — persist it via the [`pollData` event](#event-polldata) and pass it back to
[`startPolling`](#startpollingoptions):

```ts
interface PollData {
  offersSince: number;                          // Unix seconds of the newest processed update
  sent: Record<string, ETradeOfferState>;       // offer id -> last seen state
  received: Record<string, ETradeOfferState>;
  timestamps: Record<string, number>;
  lastFullUpdate?: number;                       // ms epoch of the last full sweep; persisted so the cadence survives stateless workers
}
```

### PollOptions

See [`startPolling`](#startpollingoptions): `pollInterval?` (default 10000 ms), `pollFullUpdateInterval?`
(default 300000 ms), `pollData?`, `store?` (a [`PollDataStore`](#polldatastore)), `maxAgeMs?` (default
30d), `cancelTime?` (off by default).

### PollDataStore

Pluggable persistence for the poll snapshot — implement it to keep `pollData` in Redis (or anywhere) so
any worker can resume a bot's poll. You own one-tick-at-a-time mutual exclusion; the library owns the
diff. Use it with [`startPolling`](#startpollingoptions) (timer) or [`pollOnce`](#pollonceoptions) (cron).

```ts
interface PollDataStore {
  load(): Promise<PollData | undefined>;
  save(pollData: PollData): Promise<void>;
}
```

### PollChange

One offer transition returned by [`pollOnce`](#pollonceoptions) (the same set is also emitted as
[trade events](#trade-events)):

```ts
type PollChange =
  | { type: "newOffer"; offer: TradeOffer }
  | { type: "sentOfferChanged"; offer: TradeOffer; oldState: ETradeOfferState }
  | { type: "receivedOfferChanged"; offer: TradeOffer; oldState: ETradeOfferState }
  | { type: "unknownOfferSent"; offer: TradeOffer };
```

### TradeOfferUpdate

The payload of the [`offerUpdate`](#event-offerupdate) event — a unified view of any single offer
change. `previousState` is `undefined` the first time an offer is seen; direction is `offer.isOurOffer`:

```ts
interface TradeOfferUpdate {
  offer: TradeOffer;
  previousState?: ETradeOfferState;
}
```

### Confirmation

Returned by [`getConfirmations`](#getconfirmationstime-key): `id`, `type`, `creator`, `key` (nonce),
`title`, `receiving`, `sending`, `time` (ISO string), `timestamp` (`Date`), `icon`.

---

## Enums

All are exported and have the standard Steam numeric values.

### ETradeOfferState

`Invalid (1)`, `Active (2)`, `Accepted (3)`, `Countered (4)`, `Expired (5)`, `Canceled (6)`,
`Declined (7)`, `InvalidItems (8)`, `CreatedNeedsConfirmation (9)`, `CanceledBySecondFactor (10)`,
`InEscrow (11)`, `Reverted (12)`.

### ETradeStatus

`Init (0)`, `PreCommitted (1)`, `Committed (2)`, `Complete (3)`, `Failed (4)`,
`PartialSupportRollback (5)`, `FullSupportRollback (6)`, `SupportRollback_Selective (7)`,
`RollbackFailed (8)`, `RollbackAbandoned (9)`, `InEscrow (10)`, `EscrowRollback (11)`, `Reverted (12)`.

### EConfirmationMethod

`None (0)`, `Email (1)`, `MobileApp (2)`.

### EConfirmationType

`Invalid (0)`, `Generic (1)`, `Trade (2)`, `MarketListing (3)`, `FeatureOptOut (4)`,
`PhoneNumberChange (5)`, `AccountRecovery (6)`, `BuyOrder (12)`.

### EOfferFilter

`ActiveOnly (1)`, `HistoricalOnly (2)`, `All (3)`.

### EAuthSessionGuardType

`Unknown (0)`, `None (1)`, `EmailCode (2)`, `DeviceCode (3)`, `DeviceConfirmation (4)`,
`EmailConfirmation (5)`, `MachineToken (6)`, `LegacyMachineAuth (7)`.

### EAuthTokenRevokeAction

`Logout (0)`, `Permanent (1)`, `Replaced (2)`, `Support (3)`, `Consume (4)`, `NonRememberedLogout (5)`,
`NonRememberedPermanent (6)`, `Automatic (7)`. Used by [`bot.session.logout`](#logoutaction).

### Others

`EAuthTokenPlatformType`, `ESessionPersistence`, `ETokenRenewalType`, and the full `EResult` table are
also exported.

---

## Errors

Every error extends **`SteamError`**, which carries an optional `eresult` (a Steam `EResult`) and `body`
(the raw response). The library **classifies** errors but does not implement a cooldown policy — retry
logic stays in your code.

Steam-supplied messages (the `strError` field on send/accept/cancel responses **and** the
`<div id="error_msg">` text scraped from the trade page when an inventory load fails) are run through
one shared classifier so the same `instanceof` check works everywhere.

| Class | Extra fields | Meaning |
| ----- | ------------ | ------- |
| `SteamError` | `eresult?`, `body?` | Base class for everything. |
| `HttpStatusError` | `statusCode` | A non-2xx HTTP response. |
| `SteamSessionExpiredError` | — | The session/token is no longer valid; re-authenticate. |
| `RateLimitError` | `statusCode?`, `retryAfterMs`, `unlockAt` | Rate limited (HTTP 429 or eresult 84). `unlockAt` is a millisecond epoch when you may retry — **always populated** (a conservative default when Steam gives no hint). |
| `ThrottledError` | `statusCode = 403` | The order book's 403 throttle wall. Not a `RateLimitError`: it persists and switching proxy doesn't help — stop using the account for a while. |
| `ProxyError` | `cause?` | A request through a configured proxy failed at the transport layer (unreachable / refused / timeout / auth). Only thrown when a `proxy` is set. |
| `EscrowError` | `escrowDays` | The trade would be (or is) held in escrow. |
| `TradeBanError` | — | The account is trade-banned. |
| `OfferLimitError` | `eresult = 25` | Sent too many offers. |
| `TargetCannotTradeError` | `eresult?` | Partner is not available to trade (limited, escrow-only, etc.). |
| `NewDeviceError` | `eresult?` | Steam blocks the action because we logged in from a new device recently. |
| `ItemServerUnavailableError` | `eresult = 102` | The game's item server (its Game Coordinator) is unreachable — transient, per-app, retry shortly. |
| `PrivateInventoryError` | — | Partner's inventory is private (or friends-only and we're not friends). A trade URL/token does **not** bypass inventory privacy. |
| `ConfirmationError` | — | A mobile-confirmation step failed (incl. missing `identitySecret` when calling [`offer.confirm()`](#confirm)). |
| `FamilyViewError` | — | Family View is restricting the account. |
| `MarketConfirmationLimitError` | `eresult?` | `sellItem` refused over pending confirmations: too many listings awaiting confirmation, or this item already has one pending. |
| `WalletBalanceLimitError` | `eresult?` | `sellItem` would push the wallet past Steam's maximum balance. |
| `MarketBlockedError` | `eresult?` | The account is currently unable to use the Community Market. |
| `LoginError` | `extendedErrorMessage?`, `isTransient` | Credential-login failure; `isTransient` is `true` for a retryable blip (timeout / service unavailable) rather than bad credentials. |
| `NoMobileAuthenticatorError` | (extends `LoginError`) | `sharedSecret` was supplied but the account has no mobile authenticator attached, so TOTP can't answer the guard challenge. Use `steamGuardCode` / `onSteamGuardRequired` with an email code instead. |

`unlockAt` / `retryAfterMs` on `RateLimitError` are never `undefined`, so a cooldown is just
`cooldownUntil = err.unlockAt`:

```ts
import { RateLimitError } from "@assetpay/steam-mobile";

try {
  await bot.trade.getTradeOffers();
} catch (err) {
  if (err instanceof RateLimitError) {
    await sleepUntil(err.unlockAt);
  } else throw err;
}
```

---

## Mobile-app impersonation

The client presents as the Steam mobile app on the wire: per-host user agents, the `mobileClient`
cookie, an `origin=SteamMobile` header on writes, and `mobileconf` confirmations. Pick a preset with
`mobileProfile: "ios"` (default) or `"android"`, or override individual fields with an object.

A **`MobileProfile`** has: `mobileClient` (`"ios"` | `"android"`), `mobileClientVersion`,
`apiUserAgent`, `webUserAgent`, `deviceFriendlyName` (iOS sends the model id, e.g. `"iPhone18,3"`),
`osType` (signed EOSType; iOS `-600`, Android `-500`), `gamingDeviceType`, and `appType?`. The
`IOS_PROFILE` and `ANDROID_PROFILE` constants (captured from real apps) and `resolveMobileProfile` are
exported if you want to build on them.

```ts
const bot = new SteamMobile({
  refreshToken,
  mobileProfile: { mobileClient: "ios", deviceFriendlyName: "iPhone17,2" },
});
```

---

## Notes & limitations

- **MobileApp-only.** No real-time CM push — offer detection is polling. No Game Coordinator (item data
  comes from the web `asset_properties`). No chat/presence.
- **Limited accounts** (haven't spent the $5 that lifts Steam's anti-spam limit) **can still trade** —
  subject to the usual Steam Guard / escrow holds — but can't use the Community Market or generate a
  Web API key. This library doesn't use a Web API key (it authenticates with the mobile access token),
  so limited accounts can send and receive trades through it. `getProfile().isLimited` surfaces the
  state; `ensureApiKey()` returns `null`.
- **English only** (`l=english`) by design — no localization dependency.
- **Settlement is read-only.** `getTradeStatus` surfaces Steam's `new_assetid`/`new_contextid`;
  reconciling items by inventory diff (the race-prone part) is left to your server, which has the
  concurrency context. `usedInventoryFallback` is therefore always `false`.
- **No auto-retry.** Rate limits are thrown as `RateLimitError` — always with a concrete `unlockAt`, so
  the caller's cooldown needs no guesswork (the poll loop is the one exception: it backs off and resumes).

---

## Development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit (strict NodeNext)
pnpm lint        # biome
pnpm test        # vitest
pnpm build       # tsdown → dist (ESM + d.ts)
pnpm proto       # regenerate src/protobufs from protobufs/*.proto (buf + protoc-gen-es)
```

Live debug scripts live in `debug/` and read a `.env` for credentials:

```bash
pnpm bootstrap          # credential login → save ./bot.refreshtoken (run once)
pnpm smoke              # read-only health check across the whole API
pnpm watch              # live trade-event watcher — send the bot a trade and watch it fire
pnpm trade              # send → confirm → cancel lifecycle (gated: SEND=1 PARTNER_TRADE_URL=…; needs a non-limited bot)
pnpm partner-inventory  # load a partner's inventory via /partnerinventory/ (PARTNER_TRADE_URL=…; surfaces PrivateInventoryError etc.)
```
