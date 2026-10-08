import SteamID from "steamid";
import { describe, expect, it } from "vitest";
import { ConfirmationManager } from "../src/community/confirmations.js";
import { EConfirmationType } from "../src/core/enums.js";
import { ConfirmationError } from "../src/core/errors.js";
import { ANDROID_PROFILE, IOS_PROFILE } from "../src/core/mobileProfile.js";
import type { HttpClient } from "../src/http/HttpClient.js";

interface Recorded {
  url: string;
  searchParams: Record<string, unknown> | undefined;
  multipart?: { name: string; value: string }[] | undefined;
}

class FakeHttp {
  calls: Recorded[] = [];
  posts: Recorded[] = [];
  private body: unknown = {};

  setBody(body: unknown): void {
    this.body = body;
  }

  async getSessionId(): Promise<string> {
    return "sess";
  }

  async get(url: string, opts: { searchParams?: Record<string, unknown> }) {
    this.calls.push({ url, searchParams: opts.searchParams });
    return { statusCode: 200, headers: {}, body: this.body };
  }

  async post(
    url: string,
    opts: { searchParams?: Record<string, unknown>; multipart?: { name: string; value: string }[] },
  ) {
    this.posts.push({ url, searchParams: opts.searchParams, multipart: opts.multipart });
    return { statusCode: 200, headers: {}, body: this.body };
  }
}

const STEAM_ID = new SteamID("76561198000000000");

describe("ConfirmationManager.getConfirmations", () => {
  it("parses the getlist response and sets request params", async () => {
    const http = new FakeHttp();
    http.setBody({
      success: true,
      conf: [
        {
          id: "12345",
          type: EConfirmationType.Trade,
          creator_id: "9001",
          nonce: "nonceval",
          type_name: "Trade Offer",
          headline: "With PlayerX",
          summary: ["You give 2 items", "You receive 1 item"],
          creation_time: 1700000000,
          icon: "https://img",
        },
      ],
    });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      ANDROID_PROFILE,
    );

    const confs = await mgr.getConfirmations(1700000000, "thekey");
    expect(confs).toHaveLength(1);
    const c = confs[0]!;
    expect(c.id).toBe("12345");
    expect(c.creator).toBe("9001");
    expect(c.key).toBe("nonceval");
    expect(c.sending).toBe("You give 2 items");
    expect(c.receiving).toBe("You receive 1 item");
    expect(c.timestamp).toEqual(new Date(1700000000 * 1000));

    const params = http.calls[0]!.searchParams!;
    expect(http.calls[0]!.url).toBe("https://steamcommunity.com/mobileconf/getlist");
    expect(params.m).toBe("react");
    expect(params.tag).toBe("conf");
    expect(params.k).toBe("thekey");
    expect(params.t).toBe(1700000000);
    expect(params.a).toBe(STEAM_ID.getSteamID64());
    expect(String(params.p)).toMatch(/^android:/);
  });

  it("sends a bare uppercase-UUID device id for the iOS profile", async () => {
    const http = new FakeHttp();
    http.setBody({ success: true, conf: [] });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      IOS_PROFILE,
    );
    await mgr.getConfirmations(1, "k");
    expect(String(http.calls[0]!.searchParams!.p)).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
    );
  });

  it("uses the tag from a key object", async () => {
    const http = new FakeHttp();
    http.setBody({ success: true, conf: [] });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      ANDROID_PROFILE,
    );
    await mgr.getConfirmations(123, { tag: "list", key: "k2" });
    expect(http.calls[0]!.searchParams!.tag).toBe("list");
    expect(http.calls[0]!.searchParams!.k).toBe("k2");
  });

  it("throws ConfirmationError when success is false", async () => {
    const http = new FakeHttp();
    http.setBody({ success: false, message: "Oops" });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      ANDROID_PROFILE,
    );
    await expect(mgr.getConfirmations(1, "k")).rejects.toThrow(/Oops/);
  });
});

describe("ConfirmationManager.respondToConfirmation", () => {
  it("POSTs to multiajaxop with multipart cid[]/ck[] and op in the query", async () => {
    const http = new FakeHttp();
    http.setBody({ success: true });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      IOS_PROFILE,
    );

    await mgr.respondToConfirmation("777", "nonce777", 123, { tag: "accept", key: "kk" }, true);

    expect(http.posts).toHaveLength(1);
    const post = http.posts[0]!;
    expect(post.url).toBe("https://steamcommunity.com/mobileconf/multiajaxop");
    expect(post.searchParams!.op).toBe("allow");
    expect(post.searchParams!.tag).toBe("accept");
    expect(post.multipart).toEqual([
      { name: "cid[]", value: "777" },
      { name: "ck[]", value: "nonce777" },
    ]);
  });

  it("sends parallel id/key arrays as ordered cid[]/ck[] pairs in one request", async () => {
    const http = new FakeHttp();
    http.setBody({ success: true });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      IOS_PROFILE,
    );

    await mgr.respondToConfirmation(["1", "2"], ["n1", "n2"], 123, "kk", false);

    expect(http.posts).toHaveLength(1);
    expect(http.posts[0]!.searchParams!.op).toBe("cancel");
    expect(http.posts[0]!.multipart).toEqual([
      { name: "cid[]", value: "1" },
      { name: "ck[]", value: "n1" },
      { name: "cid[]", value: "2" },
      { name: "ck[]", value: "n2" },
    ]);
  });

  it("rejects mismatched id/key arrays without a request", async () => {
    const http = new FakeHttp();
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      IOS_PROFILE,
    );
    await expect(mgr.respondToConfirmation(["1", "2"], ["n1"], 1, "kk", true)).rejects.toThrow(
      ConfirmationError,
    );
    expect(http.posts).toHaveLength(0);
  });

  it("throws ConfirmationError when the action fails", async () => {
    const http = new FakeHttp();
    http.setBody({ success: false, message: "nope" });
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      ANDROID_PROFILE,
    );
    await expect(
      mgr.respondToConfirmation("1", "k", 1, { tag: "cancel", key: "kk" }, false),
    ).rejects.toThrow(/nope/);
  });
});

describe("ConfirmationManager.acceptConfirmationForObject", () => {
  it("requires an identitySecret", async () => {
    const http = new FakeHttp();
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      undefined,
      ANDROID_PROFILE,
    );
    await expect(mgr.acceptConfirmationForObject("999")).rejects.toBeInstanceOf(ConfirmationError);
    expect(http.calls).toHaveLength(0);
  });
});

describe("ConfirmationManager high-level helpers", () => {
  const NOW = 1700000000;
  // One body that satisfies both QueryTime (response.server_time) and getlist/respond (success/conf).
  const combined = (conf: unknown[]) => ({ response: { server_time: NOW }, success: true, conf });
  const conf = (id: string, creator: string, nonce: string) => ({
    id,
    type: EConfirmationType.Trade,
    creator_id: creator,
    nonce,
    creation_time: NOW,
  });

  function mgrWith(body: unknown): { http: FakeHttp; mgr: ConfirmationManager } {
    const http = new FakeHttp();
    http.setBody(body);
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      "secret",
      ANDROID_PROFILE,
    );
    return { http, mgr };
  }
  const multiajaxop = (http: FakeHttp) =>
    http.posts.filter((p) => p.url.endsWith("/mobileconf/multiajaxop"));

  it("getPending derives the list key automatically", async () => {
    const { http, mgr } = mgrWith(combined([conf("1", "42", "n")]));
    const pending = await mgr.getPending();
    expect(pending).toHaveLength(1);
    const getlist = http.calls.find((c) => c.url.endsWith("/mobileconf/getlist"))!;
    expect(getlist.searchParams!.tag).toBe("list");
    expect(typeof getlist.searchParams!.k).toBe("string"); // HMAC, not caller-supplied
  });

  it("getPending without identitySecret throws and makes no requests", async () => {
    const http = new FakeHttp();
    const mgr = new ConfirmationManager(
      http as unknown as HttpClient,
      STEAM_ID,
      undefined,
      ANDROID_PROFILE,
    );
    await expect(mgr.getPending()).rejects.toBeInstanceOf(ConfirmationError);
    expect(http.calls).toHaveLength(0);
    expect(http.posts).toHaveLength(0);
  });

  it("acceptConfirmation responds with tag=accept and op=allow", async () => {
    const { http, mgr } = mgrWith(combined([]));
    await mgr.acceptConfirmation("777", "nonce777");
    const post = multiajaxop(http)[0]!;
    expect(post.searchParams!.op).toBe("allow");
    expect(post.searchParams!.tag).toBe("accept");
    expect(post.multipart).toEqual([
      { name: "cid[]", value: "777" },
      { name: "ck[]", value: "nonce777" },
    ]);
  });

  it("rejectConfirmation responds with tag=cancel and op=cancel", async () => {
    const { http, mgr } = mgrWith(combined([]));
    await mgr.rejectConfirmation("9", "k9");
    const post = multiajaxop(http)[0]!;
    expect(post.searchParams!.op).toBe("cancel");
    expect(post.searchParams!.tag).toBe("cancel");
  });

  it("acceptConfirmations batches the selected set into one multiajaxop", async () => {
    const { http, mgr } = mgrWith(combined([]));
    await mgr.acceptConfirmations([
      { id: "1", key: "na" },
      { id: "2", key: "nb" },
    ]);
    const ops = multiajaxop(http);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.searchParams!.op).toBe("allow");
    expect(ops[0]!.searchParams!.tag).toBe("accept");
    expect(ops[0]!.multipart!.map((p) => p.value)).toEqual(["1", "na", "2", "nb"]);
  });

  it("rejectConfirmations uses tag=cancel; an empty set makes no requests", async () => {
    const { http, mgr } = mgrWith(combined([]));
    await mgr.rejectConfirmations([]);
    expect(http.calls).toHaveLength(0);
    expect(http.posts).toHaveLength(0);

    await mgr.rejectConfirmations([{ id: "9", key: "k9" }]);
    const post = multiajaxop(http)[0]!;
    expect(post.searchParams!.op).toBe("cancel");
    expect(post.searchParams!.tag).toBe("cancel");
  });

  it("acceptAll accepts every pending confirmation", async () => {
    const { http, mgr } = mgrWith(combined([conf("1", "a", "na"), conf("2", "b", "nb")]));
    const done = await mgr.acceptAll();
    expect(done).toHaveLength(2);
    const ops = multiajaxop(http);
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => o.multipart![0]!.value)).toEqual(["1", "2"]);
  });
});
