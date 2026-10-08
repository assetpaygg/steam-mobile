import { DEFAULT_CONTEXTID, LANG, URLS } from "../core/constants.js";
import { SteamError } from "../core/errors.js";
import { type Page, paginate } from "../core/paginate.js";
import { parseStrError } from "../core/parseStrError.js";
import { RETRY_AFTER } from "../core/rateLimits.js";
import type { RawTwoFactorStatus, WebTradeEligibility } from "../core/types.js";
import { checkCommunityError, httpError } from "../http/checkers.js";
import type { HttpClient } from "../http/HttpClient.js";
import { inventoryFailureError } from "../http/tradePageError.js";
import type { WebApiClient } from "../http/webApi.js";
import {
  type EconItem,
  parseInventory,
  parsePartnerInventory,
  type RawInventoryResponse,
  type RawPartnerInventoryResponse,
} from "../models/EconItem.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { ConfirmationManager } from "./confirmations.js";
import { type OpenidLoginOptions, type OpenidLoginResult, steamOpenidLogin } from "./openid.js";
import { acknowledgeTradeProtection } from "./tradeProtection.js";

const INVENTORY_PAGE_SIZE = 2000;

export interface GetInventoryOptions {
  steamId?: string;
  tradableOnly?: boolean;
}

export interface SteamProfile {
  steamId: string;
  personaName: string;
  avatar: string;
  accountCreated: Date | null;
  tradeBanState: string;
  isLimited: boolean;
  vacBanned: boolean;
  privacyState: string;
}

export class CommunityNamespace {
  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionManager,
    private readonly confirmations: ConfirmationManager,
    private readonly api: WebApiClient,
  ) {}

  acknowledgeTradeProtection(): Promise<void> {
    return acknowledgeTradeProtection(this.http);
  }

  // Our trade URL, scraped from /profiles/<id>/tradeoffers/privacy directly (we know our steamid; skip upstream's /my redirect).
  async getTradeURL(): Promise<{ url: string; token: string }> {
    await this.session.getAccessToken();
    const steamId = this.session.steamID.getSteamID64();
    const res = await this.http.get<string>(
      `${URLS.community}/profiles/${steamId}/tradeoffers/privacy`,
      { responseType: "text", headers: { Referer: `${URLS.community}/profiles/${steamId}` } },
    );
    if (res.statusCode !== 200) throw httpError(res);
    const html = res.body;
    checkCommunityError(html);

    const match = html.match(
      /https?:\/\/(?:www\.)?steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+(?:&|&amp;)token=([a-zA-Z0-9\-_]+)/,
    );
    if (!match?.[1]) throw new SteamError("Failed to parse trade URL from the privacy page");
    return { url: match[0].replace(/&amp;/g, "&"), token: match[1] };
  }

  // Regenerate our trade URL/token (invalidates the old one).
  async changeTradeURL(): Promise<{ url: string; token: string }> {
    await this.session.getAccessToken();
    const steamId = this.session.steamID.getSteamID64();
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<unknown>(
      `${URLS.community}/profiles/${steamId}/tradeoffers/newtradeurl`,
      { responseType: "json", form: { sessionid } },
    );
    if (res.statusCode !== 200) throw httpError(res);
    // Steam returns either a bare JSON string token or { token }.
    const body = res.body;
    const token =
      typeof body === "string" ? body : String((body as { token?: string })?.token ?? "");
    if (!token) throw new SteamError("Failed to parse the new trade token");
    const accountId = this.session.steamID.accountid;
    return { url: `${URLS.community}/tradeoffer/new/?partner=${accountId}&token=${token}`, token };
  }

  // Profile summary from the community XML (one request). Steam level isn't here — use getSteamLevel().
  async getProfile(steamId?: string): Promise<SteamProfile> {
    await this.session.getAccessToken();
    const id = steamId ?? this.session.steamID.getSteamID64();
    const res = await this.http.get<string>(`${URLS.community}/profiles/${id}?xml=1`, {
      responseType: "text",
    });
    if (res.statusCode !== 200) throw httpError(res);
    const xml = res.body;
    checkCommunityError(xml);
    if (!xml.includes("<steamID64>")) throw new SteamError("Failed to load the profile XML");

    const memberSince = xmlValue(xml, "memberSince");
    const created = memberSince ? new Date(memberSince) : null;

    return {
      steamId: id,
      personaName: xmlValue(xml, "steamID") ?? "",
      avatar: xmlValue(xml, "avatarFull") ?? "",
      accountCreated: created && !Number.isNaN(created.getTime()) ? created : null,
      tradeBanState: xmlValue(xml, "tradeBanState") ?? "None",
      isLimited: xmlValue(xml, "isLimitedAccount") === "1",
      vacBanned: xmlValue(xml, "vacBanned") === "1",
      privacyState: xmlValue(xml, "privacyState") ?? "",
    };
  }

  // Run Steam's web-trade eligibility check. The endpoint 302s back (we don't follow), priming the
  // session and leaving a `webTradeEligibility` cookie that carries the verdict — whether trades are
  // allowed plus the active Steam Guard / new-device holds gating them. We decode and return it 1:1.
  async getWebTradeEligibility(): Promise<WebTradeEligibility> {
    await this.session.getAccessToken();
    const res = await this.http.get<string>(`${URLS.community}/market/eligibilitycheck/`, {
      responseType: "text",
      headers: { Referer: `${URLS.community}/` },
    });
    if (res.statusCode >= 400) throw httpError(res);
    const raw = await this.http.getCookie("webTradeEligibility");
    if (!raw) throw new SteamError("Steam did not return a webTradeEligibility cookie");
    try {
      return JSON.parse(decodeURIComponent(raw)) as WebTradeEligibility;
    } catch {
      throw new SteamError("Failed to parse the webTradeEligibility cookie");
    }
  }

  // Log into a third-party site that offers "Sign in through Steam" (OpenID 2.0), spending this live
  // web session. Returns the cookies the site set - carry them into your own HTTP client for its API.
  async openidLogin(options: OpenidLoginOptions): Promise<OpenidLoginResult> {
    await this.session.getAccessToken();
    return steamOpenidLogin(this.http, options);
  }

  // Steam level via IPlayerService (accepts the access token — no API key needed).
  async getSteamLevel(steamId?: string): Promise<number> {
    const id = steamId ?? this.session.steamID.getSteamID64();
    const res = await this.api.call<{ response?: { player_level?: number } }>({
      httpMethod: "GET",
      iface: "IPlayerService",
      method: "GetSteamLevel",
      input: { steamid: id },
    });
    return res.response?.player_level ?? 0;
  }

  // Mobile-authenticator status as the app queries it: state, time_created (when 2FA was added),
  // email_validated. (ICredentialsService/GetSteamGuardDetails isn't served over the WebAPI — 404.)
  async getTwoFactorStatus(): Promise<RawTwoFactorStatus> {
    const body = await this.api.call<{ response?: RawTwoFactorStatus }>({
      httpMethod: "POST",
      iface: "ITwoFactorService",
      method: "QueryStatus",
      input: { steamid: this.session.steamID.getSteamID64() },
    });
    if (!body.response) throw new SteamError("Malformed two-factor status response", { body });
    return body.response;
  }

  // Existing Web API key, else register one (auto-confirms via identitySecret). null if ineligible.
  async ensureApiKey(domain = "assetpay.gg"): Promise<string | null> {
    await this.session.getAccessToken();
    const res = await this.http.get<string>(`${URLS.community}/dev/apikey?l=english`, {
      responseType: "text",
    });
    if (res.statusCode !== 200) throw httpError(res);
    const body = res.body;
    const key = body.match(/<p>Key:\s*([0-9A-F]+)<\/p>/i)?.[1];
    if (key) return key;
    if (
      /validated email address|Steam Guard Mobile Authenticator|<h2>Access Denied<\/h2>/i.test(body)
    ) {
      return null;
    }
    return this.requestApiKey(domain);
  }

  private async requestApiKey(domain: string, requestId = "0"): Promise<string | null> {
    const sessionid = await this.http.getSessionId();
    const res = await this.http.post<{ api_key?: string; request_id?: string }>(
      `${URLS.community}/dev/requestkey`,
      {
        responseType: "json",
        form: { domain, request_id: requestId, sessionid, agreeToTerms: "true" },
      },
    );
    if (res.statusCode !== 200) throw httpError(res);
    const body = res.body ?? {};
    if (body.api_key) return body.api_key;
    // Pending: Steam wants a mobile confirmation. Auto-accept it (needs identitySecret), then retry.
    if (body.request_id) {
      try {
        await this.confirmations.acceptConfirmationForObject(body.request_id);
      } catch {
        return null;
      }
      return this.requestApiKey(domain, body.request_id);
    }
    return null;
  }

  async getInventory(
    appid: number,
    contextid: string = DEFAULT_CONTEXTID,
    options: GetInventoryOptions = {},
  ): Promise<EconItem[]> {
    await this.session.getAccessToken();
    const ownId = this.session.steamID.getSteamID64();
    const steamId = options.steamId ?? ownId;
    const tradableOnly = options.tradableOnly ?? false;
    return steamId === ownId
      ? this.getOwnInventoryItems(steamId, appid, contextid, tradableOnly)
      : this.getTheirInventory(steamId, appid, contextid, tradableOnly);
  }

  // Own inventory uses the legacy /inventory/json/ endpoint: near-nonexistent rate limits, surfaces
  // trade-protected items, and the rg* response shape matches /partnerinventory/. The modern
  // IEconService/GetInventoryItemsWithDescriptions endpoint trips Steam's silent throttle (returns
  // {response:{}}) on ≥2 calls/sec, which makes it unfit for repeated use.
  // trading=1 is Steam's server-side tradable filter; legacy endpoint has no other knob for it.
  private getOwnInventoryItems(
    steamId: string,
    appid: number,
    contextid: string,
    tradableOnly: boolean,
  ): Promise<EconItem[]> {
    const url = `${URLS.community}/profiles/${steamId}/inventory/json/${appid}/${contextid}`;
    return paginate<EconItem, number>(async (start): Promise<Page<EconItem, number>> => {
      const res = await this.http.get<RawPartnerInventoryResponse>(url, {
        responseType: "json",
        searchParams: {
          trading: tradableOnly ? 1 : 0,
          preserve_bbcode: 1,
          l: LANG.l,
          ...(start !== undefined ? { start } : {}),
        },
        headers: { Referer: `${URLS.community}/profiles/${steamId}/inventory` },
      });
      if (res.statusCode !== 200) throw httpError(res, RETRY_AFTER.inventory);
      const body = res.body;
      if (!body?.success) {
        throw new SteamError(body?.error ?? body?.Error ?? "Malformed inventory response");
      }

      const next =
        body.more && typeof body.more_start === "number" && body.more_start > (start ?? 0)
          ? body.more_start
          : undefined;
      return { items: parsePartnerInventory(body, contextid, tradableOnly), next };
    });
  }

  // Their inventory uses the new /inventory/ endpoint (the legacy one only serves the logged-in user).
  private getTheirInventory(
    steamId: string,
    appid: number,
    contextid: string,
    tradableOnly: boolean,
  ): Promise<EconItem[]> {
    const url = `${URLS.community}/inventory/${steamId}/${appid}/${contextid}`;
    return paginate<EconItem, string>(async (startAssetId): Promise<Page<EconItem, string>> => {
      const res = await this.http.get<RawInventoryResponse>(url, {
        responseType: "json",
        searchParams: {
          l: LANG.l,
          count: INVENTORY_PAGE_SIZE,
          raw_asset_properties: 1,
          preserve_bbcode: 1,
          start_assetid: startAssetId,
        },
        headers: { Referer: `${URLS.community}/profiles/${steamId}/inventory` },
      });
      const body = res.body;

      if (res.statusCode === 403 && !body) {
        throw await inventoryFailureError(
          this.http,
          steamId,
          undefined,
          "This profile is private.",
        );
      }
      if (res.statusCode === 500 && body?.error) throw parseStrError(body.error);
      if (res.statusCode !== 200) throw httpError(res, RETRY_AFTER.inventory);

      if (!body?.success) {
        throw await inventoryFailureError(
          this.http,
          steamId,
          undefined,
          body?.error ?? body?.Error,
        );
      }
      // Empty inventory: Steam returns success with no assets.
      if (!body.assets) return { items: [], next: undefined };

      return {
        items: parseInventory(body, contextid, tradableOnly),
        next: body.more_items && body.last_assetid ? body.last_assetid : undefined,
      };
    });
  }
}

// Read a profile-XML element's text, tolerating optional CDATA wrapping.
function xmlValue(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m?.[1]?.trim() || undefined;
}
