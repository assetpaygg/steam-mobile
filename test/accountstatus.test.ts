import SteamID from "steamid";
import { describe, expect, it } from "vitest";
import { CommunityNamespace } from "../src/community/CommunityNamespace.js";
import type { ConfirmationManager } from "../src/community/confirmations.js";
import type { HttpClient } from "../src/http/HttpClient.js";
import type { ApiCallParams, WebApiClient } from "../src/http/webApi.js";
import type { SessionManager } from "../src/session/SessionManager.js";

const SELF = new SteamID("76561198000000000");

function makeCommunity(apiBody: unknown) {
  const calls: ApiCallParams[] = [];
  const api = {
    call: async (params: ApiCallParams) => {
      calls.push(params);
      return apiBody;
    },
  };
  const session = { steamID: SELF, async getAccessToken() {} } as unknown as SessionManager;
  const community = new CommunityNamespace(
    {} as unknown as HttpClient,
    session,
    {} as unknown as ConfirmationManager,
    api as unknown as WebApiClient,
  );
  return { community, calls };
}

describe("CommunityNamespace.getSteamGuardDetails", () => {
  it("returns ICredentialsService/GetSteamGuardDetails as sent", async () => {
    const response = {
      is_steamguard_enabled: true,
      timestamp_steamguard_enabled: 1600000000,
      is_twofactor_enabled: true,
      timestamp_twofactor_enabled: 1600000500,
      is_phone_verified: false,
      session_data: [{ timestamp_machine_steamguard_enabled: 1600001000 }],
    };
    const { community, calls } = makeCommunity({ response });
    expect(await community.getSteamGuardDetails()).toEqual(response);
    expect(calls[0]).toEqual({
      httpMethod: "GET",
      iface: "ICredentialsService",
      method: "GetSteamGuardDetails",
    });
  });

  it("throws on a body without a response", async () => {
    const { community } = makeCommunity({});
    await expect(community.getSteamGuardDetails()).rejects.toThrow(/Steam Guard/);
  });
});

describe("CommunityNamespace.getTwoFactorStatus", () => {
  it("queries ITwoFactorService/QueryStatus for our steamid", async () => {
    const response = { state: 1, email_validated: true, time_created: 1600000000 };
    const { community, calls } = makeCommunity({ response });
    expect(await community.getTwoFactorStatus()).toEqual(response);
    expect(calls[0]).toEqual({
      httpMethod: "POST",
      iface: "ITwoFactorService",
      method: "QueryStatus",
      input: { steamid: "76561198000000000" },
    });
  });

  it("throws on a body without a response", async () => {
    const { community } = makeCommunity({});
    await expect(community.getTwoFactorStatus()).rejects.toThrow(/two-factor/);
  });
});
