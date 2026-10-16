import { URLS } from "../core/constants.js";
import { EResult } from "../core/enums.js";
import { RateLimitError, SteamError, SteamSessionExpiredError } from "../core/errors.js";
import { httpError } from "./checkers.js";
import { type HttpClient, requestControl } from "./HttpClient.js";

type Scalar = string | number | boolean;

export interface ApiCallParams {
  httpMethod: "GET" | "POST";
  iface: string;
  method: string;
  version?: number;
  input?: Record<string, Scalar | undefined>;
  retryAfterMs?: number | null;
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

type ApiBody = { response?: Record<string, unknown> } & Record<string, unknown>;

export class WebApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly getAccessToken: () => Promise<string>,
  ) {}

  async call<T = ApiBody>(params: ApiCallParams): Promise<T> {
    const { httpMethod, iface, method, version = 1, input = {}, retryAfterMs = null } = params;
    const accessToken = await this.getAccessToken();
    const url = `${URLS.api}/${iface}/${method}/v${version}/`;
    // origin=SteamMobile keeps us identified as the mobile app on every WebAPI call (matches
    // protoTransport's behavior on IAuthenticationService reads).
    const payload = { origin: "SteamMobile", ...input, access_token: accessToken };

    if (process.env.DEBUG_HTTP === "1") {
      const qs = new URLSearchParams(
        Object.entries(payload)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]): [string, string] => [k, String(v)]),
      );
      console.log(`[http] ${httpMethod} ${url}?${qs.toString()}`);
    }

    const res = await this.http.request<ApiBody>(httpMethod, url, {
      ...requestControl(params),
      responseType: "json",
      ...(httpMethod === "GET" ? { searchParams: payload } : { form: payload }),
    });

    if (res.statusCode !== 200) {
      throw httpError(res, retryAfterMs);
    }

    const header = res.headers["x-eresult"];
    let eresult = Array.isArray(header) ? header[0] : header;
    const errorMessage = headerValue(res.headers["x-error_message"]);
    const body = res.body;

    const responseObj =
      body && typeof body === "object"
        ? (body.response as Record<string, unknown> | undefined)
        : undefined;
    if (
      eresult === "2" &&
      body &&
      (Object.keys(body).length > 1 || (responseObj && Object.keys(responseObj).length > 0))
    ) {
      eresult = "1";
    }

    if (eresult !== undefined && eresult !== "1") {
      const code = Number(eresult);
      const name = EResult[code] ?? "EResult";
      const msg = `${name} (${eresult})${errorMessage ? `: ${errorMessage}` : ""}`;
      if (code === EResult.NotLoggedOn) throw new SteamSessionExpiredError(msg);
      if (code === EResult.RateLimitExceeded) {
        throw new RateLimitError({
          message: msg,
          body,
          eresult: 84,
          ...(typeof retryAfterMs === "number" ? { retryAfterMs } : {}),
        });
      }
      throw new SteamError(msg, { eresult: code, body });
    }

    if (!body || typeof body !== "object") {
      throw new SteamError("Invalid API response", { body });
    }

    return body as T;
  }
}

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
