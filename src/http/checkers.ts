import {
  FamilyViewError,
  HttpStatusError,
  MarketIneligibleError,
  RateLimitError,
  SteamError,
  SteamSessionExpiredError,
} from "../core/errors.js";
import type { HttpResponse } from "./HttpClient.js";

function locationHeader(res: HttpResponse<unknown>): string {
  const loc = res.headers.location;
  return Array.isArray(loc) ? (loc[0] ?? "") : (loc ?? "");
}

export function httpError(
  res: HttpResponse<unknown>,
  rateLimitWindowMs?: number | null,
): SteamError {
  if (res.statusCode === 429) {
    return new RateLimitError({
      statusCode: 429,
      body: res.body,
      ...(typeof rateLimitWindowMs === "number" ? { retryAfterMs: rateLimitWindowMs } : {}),
    });
  }
  if (res.statusCode === 401) return new SteamSessionExpiredError();
  if (res.statusCode >= 300 && res.statusCode <= 399) {
    const loc = locationHeader(res);
    if (loc.includes("/login")) return new SteamSessionExpiredError();
    if (loc.includes("eligibilitycheck")) {
      return new MarketIneligibleError(
        "Steam redirected to the market eligibility check — this account is limited / not trade-eligible",
      );
    }
  }
  return new HttpStatusError(res.statusCode, undefined, res.body);
}

export function checkHttpError(res: HttpResponse<unknown>): void {
  const { statusCode } = res;

  if (statusCode >= 300 && statusCode <= 399 && locationHeader(res).includes("/login")) {
    throw new SteamSessionExpiredError();
  }

  if (
    statusCode === 403 &&
    typeof res.body === "string" &&
    /<div id="parental_notice_instructions">/.test(res.body)
  ) {
    throw new FamilyViewError();
  }

  if (statusCode >= 400) {
    throw new HttpStatusError(statusCode, undefined, res.body);
  }
}

export function checkCommunityError(html: unknown): void {
  if (typeof html !== "string") return;

  const sorry = html.match(/<h1>Sorry!<\/h1>/);
  if (sorry) {
    const match = html.match(/<h3>(.+)<\/h3>/);
    throw new SteamError(match?.[1] ?? "Unknown error occurred");
  }

  if (html.includes("g_steamID = false;") && html.includes("<title>Sign In</title>")) {
    throw new SteamSessionExpiredError();
  }
}

export function checkTradeError(html: unknown): void {
  if (typeof html !== "string") return;
  const match = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/);
  if (match?.[1]) throw new SteamError(match[1].trim());
}
