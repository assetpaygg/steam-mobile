import { EventEmitter } from "node:events";
import type SteamID from "steamid";
import {
  type LoginWithCredentialsOptions,
  loginWithCredentials,
} from "./auth/loginWithCredentials.js";
import { CommunityNamespace } from "./community/CommunityNamespace.js";
import { ConfirmationManager } from "./community/confirmations.js";
import type { OpenidLoginOptions, OpenidLoginResult } from "./community/openid.js";
import {
  type MobilePlatform,
  type MobileProfile,
  resolveMobileProfile,
} from "./core/mobileProfile.js";
import { HttpClient, type HttpResponse, type RequestOptions } from "./http/HttpClient.js";
import { WebApiClient } from "./http/webApi.js";
import { MarketNamespace } from "./market/MarketNamespace.js";
import { SessionManager } from "./session/SessionManager.js";
import type { PollOptions, TradeEvents } from "./trade/pollTypes.js";
import { TradeNamespace } from "./trade/TradeNamespace.js";

// Root surface: session lifecycle events + all trade events re-emitted (so consumers can listen on
// `bot` or `bot.trade`). `debug` comes from TradeEvents.
export interface SteamMobileEvents extends TradeEvents {
  refreshToken: [token: string];
  sessionExpired: [error: Error];
}

export interface SteamMobileOptions {
  refreshToken: string;
  identitySecret?: string;
  proxy?: string;
  // Wire impersonation: a string picks a preset ("ios" default, "android"); an object overrides individual fields.
  mobileProfile?: MobilePlatform | Partial<MobileProfile>;
  // Start polling after login. `true` uses defaults; pass PollOptions to tune cadence or resume from saved pollData.
  polling?: boolean | PollOptions;
}

export type ReauthenticateOptions = Omit<LoginWithCredentialsOptions, "proxy" | "mobileProfile">;

export class SteamMobile extends EventEmitter<SteamMobileEvents> {
  readonly http: HttpClient;
  readonly session: SessionManager;
  readonly api: WebApiClient;
  readonly confirmations: ConfirmationManager;
  readonly trade: TradeNamespace;
  readonly community: CommunityNamespace;
  readonly market: MarketNamespace;
  readonly identitySecret: string | undefined;
  private readonly polling: boolean | PollOptions | undefined;
  private readonly proxy: string | undefined;
  private readonly profile: MobileProfile;

  constructor(options: SteamMobileOptions) {
    super();
    const profile = resolveMobileProfile(options.mobileProfile);
    this.profile = profile;
    this.proxy = options.proxy;
    this.http = new HttpClient({
      ...(options.proxy ? { proxy: options.proxy } : {}),
      profile,
    });
    this.session = new SessionManager(this.http, options.refreshToken);
    this.identitySecret = options.identitySecret;
    this.polling = options.polling;
    this.api = new WebApiClient(this.http, () => this.session.getAccessToken());
    this.confirmations = new ConfirmationManager(
      this.http,
      this.session.steamID,
      options.identitySecret,
      profile,
    );
    this.trade = new TradeNamespace(this.api, this.http, this.session, this.confirmations);
    this.community = new CommunityNamespace(this.http, this.session, this.confirmations, this.api);
    this.market = new MarketNamespace(this.http, this.session, this.confirmations, this.api);

    this.session.on("refreshToken", (token) => this.emit("refreshToken", token));
    this.session.on("sessionExpired", (error) => this.emit("sessionExpired", error));
    this.session.on("debug", (message) => this.emit("debug", message));
    this.trade.on("debug", (message) => this.emit("debug", message));
    this.trade.on("newOffer", (o) => this.emit("newOffer", o));
    this.trade.on("sentOfferChanged", (o, s) => this.emit("sentOfferChanged", o, s));
    this.trade.on("receivedOfferChanged", (o, s) => this.emit("receivedOfferChanged", o, s));
    this.trade.on("unknownOfferSent", (o) => this.emit("unknownOfferSent", o));
    this.trade.on("sentOfferCanceled", (o, r) => this.emit("sentOfferCanceled", o, r));
    this.trade.on("offerUpdate", (u) => this.emit("offerUpdate", u));
    this.trade.on("pollData", (d) => this.emit("pollData", d));
    this.trade.on("pollSuccess", () => this.emit("pollSuccess"));
    this.trade.on("pollFailure", (e) => this.emit("pollFailure", e));
  }

  async login(): Promise<this> {
    await this.session.getAccessToken();
    if (this.polling) {
      this.trade.startPolling(this.polling === true ? {} : this.polling);
    }
    return this;
  }

  async reauthenticate(credentials: ReauthenticateOptions): Promise<void> {
    const result = await loginWithCredentials({
      ...credentials,
      ...(this.proxy ? { proxy: this.proxy } : {}),
      mobileProfile: this.profile,
    });
    await this.session.setRefreshToken(result.refreshToken);
  }

  // Existing Web API key, or register one; null if the account is ineligible.
  ensureApiKey(domain?: string): Promise<string | null> {
    return this.community.ensureApiKey(domain);
  }

  // Log into a third-party site via "Sign in through Steam" (OpenID 2.0), spending this session.
  openidLogin(options: OpenidLoginOptions): Promise<OpenidLoginResult> {
    return this.community.openidLogin(options);
  }

  // Authenticated escape-hatch HTTP: ensures the session is live, then delegates to http.
  async request<T = string>(
    method: "GET" | "POST",
    url: string,
    opts?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    await this.session.getAccessToken();
    return this.http.request<T>(method, url, opts);
  }

  get<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("GET", url, opts);
  }

  post<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, opts);
  }

  get steamID(): SteamID {
    return this.session.steamID;
  }

  get accessToken(): string | undefined {
    return this.session.accessToken;
  }

  get refreshToken(): string {
    return this.session.refreshToken;
  }

  async shutdown(): Promise<void> {
    this.trade.stopPolling();
    this.trade.removeAllListeners();
    this.removeAllListeners();
  }
}
