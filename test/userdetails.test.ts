import SteamID from "steamid";
import { describe, expect, it } from "vitest";
import { parseUserDetails, tradePageError } from "../src/community/userDetails.js";
import { TargetCannotTradeError, TradeBanError } from "../src/core/errors.js";

const SELF_ACCOUNTID = new SteamID("76561198000000000").accountid;
const PARTNER_ACCOUNTID = SteamID.fromIndividualAccountID(46143802).accountid;

const TRADE_PAGE = `
<html><body>
<img src="https://avatars.akamai.steamstatic.com/me_hash.jpg" data-miniprofile="${SELF_ACCOUNTID}">
<img src="https://avatars.akamai.steamstatic.com/them_hash.jpg" alt="partner" data-miniprofile="${PARTNER_ACCOUNTID}">
<script type="text/javascript">
var g_strYourPersonaName = "MyBot";
var g_strTradePartnerPersonaName = "OtherUser";
var g_rgAppContextData = {"730":{"appid":730,"name":"Counter-Strike 2"}};
var g_rgPartnerAppContextData = {"730":{"appid":730,"name":"Counter-Strike 2"}};
var g_daysMyEscrow = 0;
var g_daysTheirEscrow = 3;
var g_bTradePartnerProbation = false;
</script></body></html>`;

describe("parseUserDetails", () => {
  it("extracts both sides: persona, contexts, escrow, avatars; partner probation", () => {
    const { me, them } = parseUserDetails(TRADE_PAGE, SELF_ACCOUNTID, PARTNER_ACCOUNTID);

    expect(me.personaName).toBe("MyBot");
    expect(me.escrowDays).toBe(0);
    expect((me.contexts?.["730"] as { name: string }).name).toBe("Counter-Strike 2");
    expect(me.avatarIcon).toBe("https://avatars.akamai.steamstatic.com/me_hash.jpg");
    expect(me.avatarMedium).toBe("https://avatars.akamai.steamstatic.com/me_hash_medium.jpg");
    expect(me.avatarFull).toBe("https://avatars.akamai.steamstatic.com/me_hash_full.jpg");

    expect(them.personaName).toBe("OtherUser");
    expect(them.escrowDays).toBe(3);
    expect(them.probation).toBe(false);
    expect((them.contexts?.["730"] as { name: string }).name).toBe("Counter-Strike 2");
    expect(them.avatarIcon).toBe("https://avatars.akamai.steamstatic.com/them_hash.jpg");
    expect(them.avatarMedium).toBe("https://avatars.akamai.steamstatic.com/them_hash_medium.jpg");
    expect(them.avatarFull).toBe("https://avatars.akamai.steamstatic.com/them_hash_full.jpg");
  });

  it("detects partner probation (boolean literal)", () => {
    const html = TRADE_PAGE.replace(
      "g_bTradePartnerProbation = false",
      "g_bTradePartnerProbation = true",
    );
    const { them } = parseUserDetails(html, SELF_ACCOUNTID, PARTNER_ACCOUNTID);
    expect(them.probation).toBe(true);
  });

  it("detects partner probation (numeric literal)", () => {
    const html = TRADE_PAGE.replace(
      "g_bTradePartnerProbation = false",
      "g_bTradePartnerProbation = 1",
    );
    const { them } = parseUserDetails(html, SELF_ACCOUNTID, PARTNER_ACCOUNTID);
    expect(them.probation).toBe(true);
  });

  it("throws rather than reporting escrow 0 when the escrow vars are unparseable", () => {
    const html = TRADE_PAGE.replace("var g_daysTheirEscrow = 3;", "");
    expect(() => parseUserDetails(html, SELF_ACCOUNTID, PARTNER_ACCOUNTID)).toThrow(/escrow/);
  });

  it("leaves avatar fields undefined when the <img> tag isn't found", () => {
    const html = TRADE_PAGE.replace(/<img[^>]*>/g, "");
    const { me, them } = parseUserDetails(html, SELF_ACCOUNTID, PARTNER_ACCOUNTID);
    expect(me.avatarIcon).toBeUndefined();
    expect(them.avatarIcon).toBeUndefined();
  });
});

describe("tradePageError", () => {
  const errorPage = (msg: string) =>
    `<div id="error_page_bg"><div id="error_msg">\n\t\t${msg}\n\t</div></div>`;

  it("types a partner who cannot trade", () => {
    const html = errorPage(
      "OtherUser is not available to trade. More information will be shown to OtherUser if they invite you to trade.",
    );
    expect(tradePageError(html)).toBeInstanceOf(TargetCannotTradeError);
  });

  it("types a partner trade ban", () => {
    const html = errorPage("You cannot trade with OtherUser because they have a trade ban.");
    expect(tradePageError(html)).toBeInstanceOf(TradeBanError);
  });

  it("returns undefined for a normal trade page", () => {
    expect(tradePageError(TRADE_PAGE)).toBeUndefined();
  });
});
