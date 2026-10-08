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
