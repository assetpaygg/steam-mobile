import type SteamID from "steamid";
import { URLS } from "../core/constants.js";
import { EConfirmationType } from "../core/enums.js";
import { ConfirmationError, SteamSessionExpiredError } from "../core/errors.js";
import type { MobileProfile } from "../core/mobileProfile.js";
import * as SteamTotp from "../crypto/steamTotp.js";
import { httpError } from "../http/checkers.js";
import type { HttpClient } from "../http/HttpClient.js";
import { queryServerTimeOffset } from "../http/queryTime.js";

export interface Confirmation {
  id: string;
  type: number;
  creator: string;
  key: string;
  title: string;
  receiving: string;
  sending: string;
  time: string;
  timestamp: Date;
  icon: string;
}

interface RawConfirmation {
  id: string | number;
  type: number;
  creator_id: string | number;
  nonce: string;
  type_name?: string;
  headline?: string;
  summary?: string[];
  creation_time: number;
  icon?: string;
}

interface RawConfListResponse {
  success?: boolean;
  conf?: RawConfirmation[];
  needauth?: boolean;
  message?: string;
  detail?: string;
}

interface RawConfActionResponse {
  success?: boolean;
  message?: string;
}

type ConfKey = string | { tag: string; key: string };

const TIME_OFFSET_TTL_MS = 12 * 60 * 60 * 1000;

export class ConfirmationManager {
  private timeOffset: number | undefined;
  private timeOffsetAt = 0;
  private readonly usedConfTimes: number[] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly steamID: SteamID,
    private readonly identitySecret: string | undefined,
    private readonly profile: MobileProfile,
  ) {}

  get hasIdentitySecret(): boolean {
    return Boolean(this.identitySecret);
  }

  // The mobileconf `p` device id: iOS sends a bare uppercase UUID, Android the `android:`-prefixed one. Stable id only, not part of the `k` HMAC.
  private deviceId(): string {
    const android = SteamTotp.getDeviceID(this.steamID.getSteamID64());
    return this.profile.mobileClient === "ios"
      ? android.replace(/^android:/, "").toUpperCase()
      : android;
  }

  async getConfirmations(time: number, key: ConfKey): Promise<Confirmation[]> {
    const { tag, k } = splitKey(key, "conf");
    const body = await this.getlist(k, time, tag);
    if (!body?.success) {
      if (body?.needauth) throw new SteamSessionExpiredError();
      throw new ConfirmationError(
        String(body?.message ?? body?.detail ?? "Failed to get confirmation list"),
      );
    }
    return (body.conf ?? []).map((c) => ({
      id: String(c.id),
      type: Number(c.type),
      creator: String(c.creator_id),
      key: String(c.nonce),
      title: `${c.type_name ?? "Confirm"} - ${c.headline ?? ""}`,
      receiving: Number(c.type) === EConfirmationType.Trade ? String(c.summary?.[1] ?? "") : "",
      sending: String(c.summary?.[0] ?? ""),
      time: new Date(Number(c.creation_time) * 1000).toISOString(),
      timestamp: new Date(Number(c.creation_time) * 1000),
      icon: String(c.icon ?? ""),
    }));
  }

  // confID/confKey may be parallel arrays (steamcommunity's multi form): one request, one HMAC.
  async respondToConfirmation(
    confID: string | string[],
    confKey: string | string[],
    time: number,
    key: ConfKey,
    accept: boolean,
  ): Promise<void> {
    const ids = Array.isArray(confID) ? confID : [confID];
    const keys = Array.isArray(confKey) ? confKey : [confKey];
    if (ids.length !== keys.length) {
      throw new ConfirmationError("confID and confKey must have the same length");
    }
    const { tag, k } = splitKey(key, accept ? "allow" : "cancel");
    const op = accept ? "allow" : "cancel";
    // multiajaxop: ids go in the multipart body (cid[]/ck[]), op/signature stay in the query string.
    const res = await this.http.post<RawConfActionResponse>(
      `${URLS.community}/mobileconf/multiajaxop`,
      {
        responseType: "json",
        searchParams: { ...this.confParams(k, time, tag), op },
        multipart: ids.flatMap((id, i) => [
          { name: "cid[]", value: id },
          { name: "ck[]", value: keys[i]! },
        ]),
      },
    );
    if (res.statusCode !== 200) throw httpError(res);
    if (res.body?.success) return;
    throw new ConfirmationError(String(res.body?.message ?? "Could not act on confirmation"));
  }

  // All pending confirmations, with the list HMAC derived for you (needs identitySecret).
  async getPending(): Promise<Confirmation[]> {
    const secret = this.requireSecret();
    const offset = await this.getTimeOffset();
    const listTime = SteamTotp.time(offset);
    const listKey = SteamTotp.getConfirmationKey(secret, listTime, "list");
    return this.getConfirmations(listTime, { tag: "list", key: listKey });
  }

  // Accept a single confirmation by id + nonce (its `key`).
  acceptConfirmation(confID: string, nonce: string): Promise<void> {
    return this.actOnConfirmations([{ id: confID, key: nonce }], true);
  }

  // Reject (cancel) a single confirmation by id + nonce.
  rejectConfirmation(confID: string, nonce: string): Promise<void> {
    return this.actOnConfirmations([{ id: confID, key: nonce }], false);
  }

  // Accept / reject a caller-selected set in one multiajaxop request. No-op when empty.
  acceptConfirmations(confs: Pick<Confirmation, "id" | "key">[]): Promise<void> {
    return this.actOnConfirmations(confs, true);
  }

  rejectConfirmations(confs: Pick<Confirmation, "id" | "key">[]): Promise<void> {
    return this.actOnConfirmations(confs, false);
  }

  // Accept every pending confirmation; returns the ones acted on. Fails fast on the first error.
  async acceptAll(): Promise<Confirmation[]> {
    const pending = await this.getPending();
    for (const c of pending) await this.acceptConfirmation(c.id, c.key);
    return pending;
  }

  async acceptConfirmationForObject(objectID: string): Promise<void> {
    const conf = (await this.getPending()).find((c) => c.creator === String(objectID));
    if (!conf) throw new ConfirmationError(`Could not find confirmation for object ${objectID}`);
    await this.acceptConfirmation(conf.id, conf.key);
  }

  private async actOnConfirmations(
    confs: Pick<Confirmation, "id" | "key">[],
    accept: boolean,
  ): Promise<void> {
    if (confs.length === 0) return;
    const secret = this.requireSecret();
    const offset = await this.getTimeOffset();
    const time = this.nextConfTime(offset);
    const tag = accept ? "accept" : "cancel";
    const key = SteamTotp.getConfirmationKey(secret, time, tag);
    await this.respondToConfirmation(
      confs.map((c) => c.id),
      confs.map((c) => c.key),
      time,
      { tag, key },
      accept,
    );
  }

  private requireSecret(): string {
    if (!this.identitySecret) {
      throw new ConfirmationError("identitySecret is required to respond to confirmations");
    }
    return this.identitySecret;
  }

  // A distinct single-use timestamp per HMAC; bump locally past any we've already signed with.
  private nextConfTime(offset: number): number {
    let time = SteamTotp.time(offset);
    let localOffset = 0;
    while (this.usedConfTimes.includes(time)) time = SteamTotp.time(offset) + ++localOffset;
    this.usedConfTimes.push(time);
    if (this.usedConfTimes.length > 60) {
      this.usedConfTimes.splice(0, this.usedConfTimes.length - 60);
    }
    return time;
  }

  private async getTimeOffset(): Promise<number> {
    if (this.timeOffset !== undefined && Date.now() - this.timeOffsetAt < TIME_OFFSET_TTL_MS) {
      return this.timeOffset;
    }
    const offset = await queryServerTimeOffset(this.http);
    this.timeOffset = offset;
    this.timeOffsetAt = Date.now();
    return offset;
  }

  // Common mobileconf query params; the `k` HMAC authorizes the request.
  private confParams(key: string, time: number, tag: string): Record<string, string | number> {
    return {
      p: this.deviceId(),
      a: this.steamID.getSteamID64(),
      k: key,
      t: time,
      m: "react",
      tag,
    };
  }

  private async getlist(key: string, time: number, tag: string): Promise<RawConfListResponse> {
    const res = await this.http.get<RawConfListResponse>(`${URLS.community}/mobileconf/getlist`, {
      responseType: "json",
      searchParams: this.confParams(key, time, tag),
    });
    if (res.statusCode !== 200) throw httpError(res);
    return res.body;
  }
}

function splitKey(key: ConfKey, fallbackTag: string): { tag: string; k: string } {
  return typeof key === "object" ? { tag: key.tag, k: key.key } : { tag: fallbackTag, k: key };
}
