import { type Browser, Impit } from "impit";
import { type Cookie, CookieJar } from "tough-cookie";
import { URLS } from "../core/constants.js";
import { ProxyError } from "../core/errors.js";
import type { MobilePlatform, MobileProfile } from "../core/mobileProfile.js";

// Hosts that share our session cookies. api is included because the mobile app sends them to the WebAPI host too.
const COOKIE_HOSTS = [URLS.community, URLS.store, URLS.help, URLS.api];

// TLS fingerprint per request kind. iOS runs webview + API on one Apple stack, so ios18 serves both.
// Android splits: community pages use the Chrome WebView, native api/mobileconf uses okhttp — and Steam's
// WAF 429s an okhttp fingerprint on the community host, so web pages must look like Chrome.
const IMPIT_BROWSER: Record<MobilePlatform, { web: Browser; native: Browser }> = {
  ios: { web: "ios18", native: "ios18" },
  android: { web: "chrome", native: "okhttp5" },
};

// Document Accept for webview page loads; a browser always sends one and its absence is a WAF bot tell.
// (JSON XHRs send application/json instead — see perform().)
const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

type Method = "GET" | "POST";
type ResponseType = "text" | "json" | "buffer";
type Scalar = string | number | boolean;

export interface HttpResponse<T = string> {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: T;
}

// Ordered multipart fields; repeated names (e.g. cid[]/ck[]) are allowed and order-significant.
export interface MultipartField {
  name: string;
  value: string;
}

export interface RequestOptions {
  searchParams?: Record<string, Scalar | undefined>;
  // Request body: pass exactly one of form / multipart / json / body.
  form?: Record<string, Scalar | undefined>;
  multipart?: MultipartField[];
  json?: unknown;
  body?: string | Buffer;
  headers?: Record<string, string>;
  responseType?: ResponseType;
  referer?: string;
  signal?: AbortSignal; // abort the request
  timeoutMs?: number; // per-request timeout override (default 50000)
  // Don't re-send this request after priming Steam's market eligibility check; return the redirect
  // instead. For writes whose replay must never happen implicitly.
  noEligibilityReplay?: boolean;
}

// The per-call controls a caller can thread through higher-level methods.
export type RequestControl = Pick<RequestOptions, "signal" | "timeoutMs">;

export function requestControl(
  control: { signal?: AbortSignal | undefined; timeoutMs?: number | undefined } | undefined,
): RequestControl {
  const out: RequestControl = {};
  if (control?.signal) out.signal = control.signal;
  if (control?.timeoutMs !== undefined) out.timeoutMs = control.timeoutMs;
  return out;
}

function clean(input?: Record<string, Scalar | undefined>): Record<string, string> | undefined {
  if (!input) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = String(v);
  }
  return out;
}

// Hand-built to match the Steam mobile app's mobileconf POSTs.
function buildMultipart(fields: MultipartField[], boundary: string): string {
  let out = "";
  for (const { name, value } of fields) {
    out += `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  return `${out}--${boundary}--\r\n`;
}

export class HttpClient {
  readonly jar: CookieJar;
  private readonly webClient: Impit;
  private readonly nativeClient: Impit;
  private readonly browserClient: Impit;
  private readonly profile: MobileProfile;
  private readonly proxy: string | undefined;

  constructor(opts: { proxy?: string; profile: MobileProfile }) {
    this.jar = new CookieJar();
    this.profile = opts.profile;
    this.proxy = opts.proxy;

    const makeClient = (browser: Browser): Impit =>
      new Impit({
        browser,
        cookieJar: this.jar,
        followRedirects: false,
        timeout: 50000,
        ...(opts.proxy ? { proxyUrl: opts.proxy } : {}),
      });
    const fp = IMPIT_BROWSER[this.profile.mobileClient];
    this.webClient = makeClient(fp.web);
    // iOS uses the same fingerprint for both, so reuse the one instance.
    this.nativeClient = fp.native === fp.web ? this.webClient : makeClient(fp.native);
    // Third-party hosts (e.g. an OpenID relying party behind Cloudflare) get a real Chrome hello:
    // impit's ios18 ClientHello trips Cloudflare's strict TLS parser (decode_error). Steam hosts, which
    // are lenient, keep the app-accurate fingerprint.
    this.browserClient = fp.web === "chrome" ? this.webClient : makeClient("chrome");

    // Cookies that mark every request as coming from the Steam mobile app.
    for (const raw of [
      `mobileClient=${this.profile.mobileClient}`,
      `mobileClientVersion=${this.profile.mobileClientVersion}`,
      "Steam_Language=english",
    ]) {
      for (const host of COOKIE_HOSTS) this.jar.setCookieSync(raw, host);
    }
  }

  async request<T = string>(
    method: Method,
    url: string,
    opts: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const res = await this.perform<T>(method, url, opts);
    // Steam gates trade/market pages behind a one-time eligibility check (302 → /market/
    // eligibilitycheck/ → back). We don't auto-follow redirects, so visit it once to prime the
    // session, then retry. A genuinely limited account keeps redirecting and the retry surfaces it.
    const location = firstHeader(res.headers.location);
    if (
      res.statusCode >= 300 &&
      res.statusCode < 400 &&
      location?.includes("/market/eligibilitycheck")
    ) {
      await this.perform("GET", location, requestControl(opts));
      if (opts.noEligibilityReplay) return res;
      return this.perform<T>(method, url, opts);
    }
    return res;
  }

  private async perform<T = string>(
    method: Method,
    url: string,
    opts: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    // Native app calls (WebAPI + mobileconf) carry the native UA; webview pages carry the web UA (per iOS-app captures).
    const isNative = url.startsWith(URLS.api) || url.includes("/mobileconf/");
    const headers: Record<string, string> = {
      "User-Agent": isNative ? this.profile.apiUserAgent : this.profile.webUserAgent,
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (isNative) {
      // Native app transport: JSON accept, no browser Origin/Sec-Fetch headers.
      headers.Accept = "application/json, text/plain, */*";
    } else {
      headers.Accept =
        opts.responseType === "json" ? "application/json, text/plain, */*" : BROWSER_ACCEPT;
      if (method !== "GET") {
        headers.Origin = URLS.community;
        if (opts.referer) headers.Referer = opts.referer;
      }
    }

    // Body: exactly one of multipart / form / json / body. impit auto-sets Content-Type for URLSearchParams;
    // for the hand-built multipart and json strings we set it explicitly so impit doesn't override.
    let body: string | Buffer | URLSearchParams | undefined;
    if (opts.multipart) {
      const boundary = `----steamMobile${randomSessionId()}`;
      body = buildMultipart(opts.multipart, boundary);
      headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
    } else if (opts.form) {
      body = new URLSearchParams(clean(opts.form));
    } else if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers["Content-Type"] = "application/json";
    } else if (opts.body !== undefined) {
      body = opts.body;
    }
    Object.assign(headers, opts.headers); // explicit caller headers win

    // impit's fetch takes a full URL (no searchParams option) — fold them into the query string.
    const target = new URL(url);
    const sp = clean(opts.searchParams);
    if (sp) for (const [k, v] of Object.entries(sp)) target.searchParams.set(k, v);

    try {
      const client = isNative
        ? this.nativeClient
        : isSteamHost(target.hostname)
          ? this.webClient
          : this.browserClient;
      const res = await client.fetch(target.toString(), {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        ...(opts.signal ? { signal: opts.signal } : {}),
        ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
      });

      const responseType: ResponseType = opts.responseType ?? "text";
      let parsed: unknown;
      if (responseType === "buffer") {
        parsed = Buffer.from(await res.bytes());
      } else if (responseType === "json") {
        // Empty/invalid JSON → undefined body, never throw; callers branch on status, not parse errors.
        const text = await res.text();
        parsed = text ? safeJsonParse(text) : undefined;
      } else {
        parsed = await res.text();
      }

      return {
        statusCode: res.status,
        headers: headersToRecord(res.headers),
        body: parsed as T,
      };
    } catch (err) {
      throw this.wrapTransportError(err);
    }
  }

  // impit only throws on transport failures inside perform() (HTTP statuses don't throw); aborts surface as
  // a DOMException (not an Error subclass), so instanceof Error && !abort isolates a genuine transport failure.
  private wrapTransportError(err: unknown): unknown {
    if (this.proxy && err instanceof Error && !isAbortError(err)) {
      return new ProxyError(`proxy request failed: ${err.message}`, { cause: err });
    }
    return err;
  }

  get<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("GET", url, opts);
  }

  post<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, opts);
  }

  async setCookie(rawCookie: string): Promise<void> {
    for (const host of COOKIE_HOSTS) {
      await this.jar.setCookie(rawCookie, host);
    }
  }

  // Read a cookie value from the jar (includes HttpOnly cookies). undefined if not set.
  async getCookie(key: string, url: string = URLS.community): Promise<string | undefined> {
    const cookies = await this.jar.getCookies(url);
    return cookies.find((c: Cookie) => c.key === key)?.value;
  }

  async getSessionId(): Promise<string> {
    const cookies = await this.jar.getCookies(URLS.community);
    const existing = cookies.find((c: Cookie) => c.key === "sessionid");
    if (existing) return existing.value;
    const sessionId = randomSessionId();
    await this.setCookie(`sessionid=${sessionId}`);
    return sessionId;
  }
}

function randomSessionId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const STEAM_HOSTS = ["steamcommunity.com", "steampowered.com"] as const;

// Steam's own hosts (community/store/help/api); everything else is treated as a third-party site.
function isSteamHost(host: string): boolean {
  const h = host.toLowerCase();
  return STEAM_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

// WHATWG Headers → lowercased plain record (consumers read location / x-eresult / x-error_message).
function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === "AbortError" || e.code === "ERR_ABORTED";
}
