import { URLS } from "../core/constants.js";
import { SteamError } from "../core/errors.js";
import { parseStrError } from "../core/parseStrError.js";
import { checkCommunityError, httpError } from "../http/checkers.js";
import type { HttpClient } from "../http/HttpClient.js";

export interface UserSideDetails {
  personaName: string;
  contexts: Record<string, unknown> | null;
  escrowDays: number;
  avatarIcon: string | undefined;
  avatarMedium: string | undefined;
  avatarFull: string | undefined;
}

export interface UserPartnerDetails extends UserSideDetails {
  probation: boolean;
}

export interface UserDetails {
  me: UserSideDetails;
  them: UserPartnerDetails;
}

// Fetch + parse the trade page for both sides of a trade. URL is either /tradeoffer/new/?partner=…
// (unsent offer) or /tradeoffer/<id>/ (existing offer); both pages share the same JS vars + avatar
// markup so the parser doesn't care which.
export async function fetchUserDetails(
  http: HttpClient,
  url: string,
  referer: string,
  myAccountId: number,
  partnerAccountId: number,
): Promise<UserDetails> {
  const res = await http.get<string>(url, { responseType: "text", headers: { Referer: referer } });
  if (res.statusCode !== 200) throw httpError(res);
  const html = res.body;
  checkCommunityError(html);
  if (!html.includes("g_rgAppContextData")) {
    throw tradePageError(html) ?? new SteamError("Failed to load the trade page for this user");
  }
  return parseUserDetails(html, myAccountId, partnerAccountId);
}

// A partner we cannot trade with (trade ban, post-reset cooldown, ...) gets the error page, so the
// reason is typed here instead of surfacing as a generic load failure.
export function tradePageError(html: string): SteamError | undefined {
  const message = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/)?.[1];
  return message ? parseStrError(message.replace(/\s+/g, " ").trim()) : undefined;
}

export function buildPartnerTradePageUrl(partnerAccountId: number, token?: string): string {
  return `${URLS.community}/tradeoffer/new/?partner=${partnerAccountId}${token ? `&token=${token}` : ""}`;
}

export function parseUserDetails(
  html: string,
  myAccountId: number,
  partnerAccountId: number,
): UserDetails {
  const myEscrowDays = matchInt(html, /var g_daysMyEscrow = (\d+);/);
  const theirEscrowDays = matchInt(html, /var g_daysTheirEscrow = (\d+);/);
  // Fail loud rather than report a misleading 0 — callers trust 0 to mean "no hold".
  if (myEscrowDays === null || theirEscrowDays === null) {
    throw new SteamError("Failed to parse escrow durations from the trade page");
  }

  return {
    me: {
      personaName: matchJsString(html, "g_strYourPersonaName") ?? "",
      contexts: matchJson(html, /g_rgAppContextData\s*=\s*(\{.*?\});/),
      escrowDays: myEscrowDays,
      ...matchAvatars(html, myAccountId),
    },
    them: {
      personaName: matchJsString(html, "g_strTradePartnerPersonaName") ?? "",
      contexts: matchJson(html, /g_rgPartnerAppContextData\s*=\s*(\{.*?\});/),
      escrowDays: theirEscrowDays,
      probation: /g_bTradePartnerProbation\s*=\s*(?:true|1)\b/.test(html),
      ...matchAvatars(html, partnerAccountId),
    },
  };
}

function matchInt(html: string, re: RegExp): number | null {
  const m = html.match(re);
  return m?.[1] !== undefined ? Number.parseInt(m[1], 10) : null;
}

function matchJson(html: string, re: RegExp): Record<string, unknown> | null {
  const m = html.match(re);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Decode a `var X = "...";` JS string literal. JS escapes that aren't valid JSON (\x, octal) are rare
// in Steam's persona names, so JSON.parse covers the common cases (\n, \t, \", \\, \uXXXX).
function matchJsString(html: string, varName: string): string | undefined {
  const re = new RegExp(`var ${varName}\\s*=\\s*("(?:\\\\.|[^"\\\\])*");`);
  const m = html.match(re);
  if (!m?.[1]) return undefined;
  try {
    return JSON.parse(m[1]) as string;
  } catch {
    return m[1].slice(1, -1);
  }
}

interface AvatarUrls {
  avatarIcon: string | undefined;
  avatarMedium: string | undefined;
  avatarFull: string | undefined;
}

// `<img src="..." [alt="..."] data-miniprofile="<accountid>">`. Steam serves <icon>.jpg; size variants
// are <icon>_medium.jpg / <icon>_full.jpg (mirrors steamcommunity's getUserDetails).
function matchAvatars(html: string, accountId: number): AvatarUrls {
  const re = new RegExp(`<img src="([^"]+)"(?: alt="[^"]*")? data-miniprofile="${accountId}">`);
  const m = html.match(re);
  if (!m?.[1]) return { avatarIcon: undefined, avatarMedium: undefined, avatarFull: undefined };
  const icon = m[1];
  return {
    avatarIcon: icon,
    avatarMedium: icon.replace(/\.jpg$/, "_medium.jpg"),
    avatarFull: icon.replace(/\.jpg$/, "_full.jpg"),
  };
}
