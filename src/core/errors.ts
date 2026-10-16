import { isTransientEResult } from "./eresults.js";

// Fallback so every RateLimitError has a concrete unlockAt (Steam never sends Retry-After).
export const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;

export class SteamError extends Error {
  readonly eresult?: number;
  readonly body?: unknown;

  constructor(message: string, options?: { eresult?: number; body?: unknown; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "SteamError";
    if (options?.eresult !== undefined) this.eresult = options.eresult;
    if (options?.body !== undefined) this.body = options.body;
  }
}

export class ProxyError extends SteamError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProxyError";
  }
}

export class HttpStatusError extends SteamError {
  readonly statusCode: number;

  constructor(statusCode: number, message?: string, body?: unknown) {
    super(message ?? `HTTP error ${statusCode}`, { body });
    this.name = "HttpStatusError";
    this.statusCode = statusCode;
  }
}

export class SteamSessionExpiredError extends SteamError {
  constructor(message = "Not Logged In") {
    super(message);
    this.name = "SteamSessionExpiredError";
  }
}

// Steam OpenID relying-party login failed (no interstitial form, missing assertion redirect, etc.).
export class OpenIdError extends SteamError {
  constructor(message: string) {
    super(message);
    this.name = "OpenIdError";
  }
}

export class RateLimitError extends SteamError {
  readonly statusCode: number | undefined;
  readonly retryAfterMs: number;
  readonly unlockAt: number;

  constructor(
    options: {
      message?: string;
      body?: unknown;
      retryAfterMs?: number;
      eresult?: number;
      statusCode?: number;
    } = {},
  ) {
    super(options.message ?? "Rate limit exceeded", {
      ...(options.eresult !== undefined ? { eresult: options.eresult } : {}),
      body: options.body,
    });
    this.name = "RateLimitError";
    this.statusCode = options.statusCode;
    this.retryAfterMs = options.retryAfterMs ?? DEFAULT_RATE_LIMIT_RETRY_MS;
    this.unlockAt = Date.now() + this.retryAfterMs;
  }
}

// Steam's 403 throttle wall on /market/orderbook (only that endpoint). Deliberately not a
// RateLimitError: it persists and isn't cured by retrying or switching proxy — stop using the
// account for a while.
export class ThrottledError extends SteamError {
  readonly statusCode = 403;

  constructor(message = "Throttled (403)", options?: { body?: unknown }) {
    super(message, options);
    this.name = "ThrottledError";
  }
}

export class EscrowError extends SteamError {
  readonly escrowDays: number;

  constructor(escrowDays: number, message?: string) {
    super(message ?? `Trade would be held in escrow for ${escrowDays} days`);
    this.name = "EscrowError";
    this.escrowDays = escrowDays;
  }
}

export class TradeBanError extends SteamError {
  constructor(message = "Trade ban") {
    super(message);
    this.name = "TradeBanError";
  }
}

export class OfferLimitError extends SteamError {
  constructor(message = "Sent too many trade offers") {
    super(message, { eresult: 25 });
    this.name = "OfferLimitError";
  }
}

// Steam blocks the action because we logged in from a new device recently.
export class NewDeviceError extends SteamError {
  constructor(message = "You have logged in from a new device", options?: { eresult?: number }) {
    super(message, options);
    this.name = "NewDeviceError";
  }
}

// Target account is not in a state where it can complete trades (limited, escrow-only, etc.).
export class TargetCannotTradeError extends SteamError {
  constructor(message = "This user is not available to trade", options?: { eresult?: number }) {
    super(message, options);
    this.name = "TargetCannotTradeError";
  }
}

// The game's item server (its Game Coordinator) is unreachable — transient, per-app, retry later.
export class ItemServerUnavailableError extends SteamError {
  constructor(
    message = "Steam is currently unable to contact the game's item server",
    options?: { eresult?: number },
  ) {
    super(message, { eresult: options?.eresult ?? 102 });
    this.name = "ItemServerUnavailableError";
  }
}

export class ConfirmationError extends SteamError {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationError";
  }
}

// Acting on a confirmation got an answer that says neither yes nor no (an unreadable body): it may
// or may not have been accepted. Still a ConfirmationError for callers that only care it failed.
export class ConfirmationOutcomeUnknownError extends ConfirmationError {
  constructor(message = "Confirmation response unreadable; the outcome is unknown") {
    super(message);
    this.name = "ConfirmationOutcomeUnknownError";
  }
}

export class FamilyViewError extends SteamError {
  constructor(message = "Family View Restricted") {
    super(message);
    this.name = "FamilyViewError";
  }
}

// Partner/profile inventory is private (or friends-only and we're not friends).
// A trade URL/token does NOT bypass inventory privacy — only inventory privacy does.
export class PrivateInventoryError extends SteamError {
  constructor(message = "This profile's inventory is private.") {
    super(message);
    this.name = "PrivateInventoryError";
  }
}

// too_many_pending: too many listings await mobile confirmation (confirm them, then retry).
// item_pending: this item already has a listing pending confirmation — if no confirmation exists for
// it any more, that listing is stuck until removed (cancelListing on its listings_to_confirm entry).
export type MarketConfirmationLimitReason = "too_many_pending" | "item_pending" | "unknown";

export class MarketConfirmationLimitError extends SteamError {
  readonly reason: MarketConfirmationLimitReason;

  constructor(
    message = "Too many listings pending confirmation",
    options?: { eresult?: number; body?: unknown; reason?: MarketConfirmationLimitReason },
  ) {
    super(message, options);
    this.name = "MarketConfirmationLimitError";
    this.reason = options?.reason ?? "unknown";
  }
}

// sellitem refused because the asset is not (or no longer) in the inventory, or not marketable.
export class MarketItemUnavailableError extends SteamError {
  constructor(message: string, options?: { eresult?: number; body?: unknown }) {
    super(message, options);
    this.name = "MarketItemUnavailableError";
  }
}

// Steam redirected a market request to its eligibility check and kept doing so after priming: the
// account cannot use the Community Market (limited, new device, recent password reset, …).
export class MarketIneligibleError extends SteamError {
  constructor(
    message = "Steam redirected to the market eligibility check — this account cannot use the market",
  ) {
    super(message);
    this.name = "MarketIneligibleError";
  }
}

// A market response (or a caller's price) is in a different currency than the one required. Prices
// in different currencies must never be compared, so the call is refused instead.
export class CurrencyMismatchError extends SteamError {
  readonly expected: number;
  readonly actual: number | undefined;

  constructor(expected: number, actual: number | undefined, context: string) {
    super(`Currency mismatch in ${context}: expected ${expected}, got ${actual ?? "unknown"}`);
    this.name = "CurrencyMismatchError";
    this.expected = expected;
    this.actual = actual;
  }
}

// The wallet currency is not known (not seeded, not yet read by getWalletDetails(), or the account
// has no wallet), so a currency-dependent market call refuses to run.
export class WalletCurrencyUnknownError extends SteamError {
  constructor(context: string) {
    super(
      `Wallet currency unknown for ${context} — seed walletCurrency or call getWalletDetails() first`,
    );
    this.name = "WalletCurrencyUnknownError";
  }
}

// createBuyOrder failed at `stage`. mayExist: the order may have been placed anyway (an answer
// that proves nothing, a request whose outcome is unknown, or an accepted confirmation) — read
// getMyListings() before acting again. Only Steam's refusals proven to mean "not placed" (15 access
// denied, 25 order limit, 107 insufficient funds) clear it. orderExists: Steam says an order for
// this item already exists (29 duplicate) — possibly at another price. code: Steam's body.success.
// confirmationId: the mobile confirmation involved, if any.
export type BuyOrderStage = "create" | "confirm" | "finalize";

export class BuyOrderError extends SteamError {
  readonly stage: BuyOrderStage;
  readonly code: number | undefined;
  readonly mayExist: boolean;
  readonly orderExists: boolean;
  readonly confirmationId: string | undefined;

  constructor(
    message: string,
    options: {
      stage: BuyOrderStage;
      mayExist: boolean;
      orderExists?: boolean;
      code?: number;
      confirmationId?: string;
      body?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, {
      ...(options.code !== undefined ? { eresult: options.code } : {}),
      body: options.body,
      cause: options.cause,
    });
    this.name = "BuyOrderError";
    this.stage = options.stage;
    this.code = options.code;
    this.orderExists = options.orderExists ?? false;
    this.mayExist = options.mayExist || this.orderExists;
    this.confirmationId = options.confirmationId;
  }
}

// The sale would push the wallet past Steam's maximum wallet balance.
export class WalletBalanceLimitError extends SteamError {
  constructor(
    message = "Listing would exceed the maximum wallet balance",
    options?: { eresult?: number; body?: unknown },
  ) {
    super(message, options);
    this.name = "WalletBalanceLimitError";
  }
}

// Account-level: the account is currently unable to use the Community Market.
export class MarketBlockedError extends SteamError {
  constructor(
    message = "This account is currently unable to use the Community Market",
    options?: { eresult?: number; body?: unknown },
  ) {
    super(message, options);
    this.name = "MarketBlockedError";
  }
}

// Credential-login failures; carries Steam's extended_error_message when present.
export class LoginError extends SteamError {
  readonly extendedErrorMessage: string | undefined;
  readonly isTransient: boolean;

  constructor(
    message: string,
    options?: { eresult?: number; body?: unknown; extendedErrorMessage?: string },
  ) {
    super(message, options);
    this.name = "LoginError";
    this.extendedErrorMessage = options?.extendedErrorMessage;
    this.isTransient = isTransientEResult(options?.eresult);
  }
}

// sharedSecret was supplied but the account has no mobile authenticator attached, so TOTP can't
// answer the guard challenge. Use steamGuardCode / onSteamGuardRequired with an email code instead.
export class NoMobileAuthenticatorError extends LoginError {
  constructor(
    message = "account has no mobile authenticator attached; sharedSecret cannot be used (account uses email Steam Guard)",
  ) {
    super(message);
    this.name = "NoMobileAuthenticatorError";
  }
}
