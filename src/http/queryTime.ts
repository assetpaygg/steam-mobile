import { URLS } from "../core/constants.js";
import { SteamError } from "../core/errors.js";
import { time as steamTotpTime } from "../crypto/steamTotp.js";
import { httpError } from "./checkers.js";
import { type HttpClient, type RequestControl, requestControl } from "./HttpClient.js";

// Steam server-time offset via ITwoFactorService/QueryTime — used by mobileconf to sign requests
// with Steam's clock instead of the local one (Windows hosts drift; the 30s TOTP/conf window is
// unforgiving). Goes through HttpClient so it inherits the proxy + mobile headers.
export async function queryServerTimeOffset(
  http: HttpClient,
  control?: RequestControl,
): Promise<number> {
  const res = await http.post<{ response?: { server_time?: string | number } }>(
    `${URLS.api}/ITwoFactorService/QueryTime/v1/`,
    { ...requestControl(control), responseType: "json" },
  );
  if (res.statusCode !== 200) throw httpError(res);
  const serverTime = Number(res.body?.response?.server_time);
  if (!serverTime) throw new SteamError("Failed to query Steam server time");
  return serverTime - steamTotpTime();
}
