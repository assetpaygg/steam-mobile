import { Buffer as Buffer$1 } from "node:buffer";
import { create, fromBinary, fromJson, toBinary, toJson } from "@bufbuild/protobuf";
import { fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import { EventEmitter } from "node:events";
import SteamID from "steamid";
import { constants, createHash, createHmac, createPublicKey, publicEncrypt } from "node:crypto";
import { Impit } from "impit";
import { CookieJar } from "tough-cookie";
//#region src/core/constants.ts
const LANG = {
	l: "english",
	language: "en"
};
const URLS = {
	community: "https://steamcommunity.com",
	store: "https://store.steampowered.com",
	help: "https://help.steampowered.com",
	api: "https://api.steampowered.com"
};
const DEFAULT_CONTEXTID = "2";
const REFRESH_TOKEN_RENEW_THRESHOLD_SECONDS = 2592e3;
//#endregion
//#region src/core/enums.ts
let ETradeOfferState = /* @__PURE__ */ function(ETradeOfferState) {
	ETradeOfferState[ETradeOfferState["Invalid"] = 1] = "Invalid";
	ETradeOfferState[ETradeOfferState["Active"] = 2] = "Active";
	ETradeOfferState[ETradeOfferState["Accepted"] = 3] = "Accepted";
	ETradeOfferState[ETradeOfferState["Countered"] = 4] = "Countered";
	ETradeOfferState[ETradeOfferState["Expired"] = 5] = "Expired";
	ETradeOfferState[ETradeOfferState["Canceled"] = 6] = "Canceled";
	ETradeOfferState[ETradeOfferState["Declined"] = 7] = "Declined";
	ETradeOfferState[ETradeOfferState["InvalidItems"] = 8] = "InvalidItems";
	ETradeOfferState[ETradeOfferState["CreatedNeedsConfirmation"] = 9] = "CreatedNeedsConfirmation";
	ETradeOfferState[ETradeOfferState["CanceledBySecondFactor"] = 10] = "CanceledBySecondFactor";
	ETradeOfferState[ETradeOfferState["InEscrow"] = 11] = "InEscrow";
	/** Trade was reverted by the user (Trade protection update 2025) */
	ETradeOfferState[ETradeOfferState["Reverted"] = 12] = "Reverted";
	return ETradeOfferState;
}({});
let ETradeStatus = /* @__PURE__ */ function(ETradeStatus) {
	ETradeStatus[ETradeStatus["Init"] = 0] = "Init";
	ETradeStatus[ETradeStatus["PreCommitted"] = 1] = "PreCommitted";
	ETradeStatus[ETradeStatus["Committed"] = 2] = "Committed";
	ETradeStatus[ETradeStatus["Complete"] = 3] = "Complete";
	ETradeStatus[ETradeStatus["Failed"] = 4] = "Failed";
	ETradeStatus[ETradeStatus["PartialSupportRollback"] = 5] = "PartialSupportRollback";
	ETradeStatus[ETradeStatus["FullSupportRollback"] = 6] = "FullSupportRollback";
	ETradeStatus[ETradeStatus["SupportRollback_Selective"] = 7] = "SupportRollback_Selective";
	ETradeStatus[ETradeStatus["RollbackFailed"] = 8] = "RollbackFailed";
	ETradeStatus[ETradeStatus["RollbackAbandoned"] = 9] = "RollbackAbandoned";
	ETradeStatus[ETradeStatus["InEscrow"] = 10] = "InEscrow";
	ETradeStatus[ETradeStatus["EscrowRollback"] = 11] = "EscrowRollback";
	/** Trade was reverted by the user (Trade protection update 2025) */
	ETradeStatus[ETradeStatus["Reverted"] = 12] = "Reverted";
	return ETradeStatus;
}({});
let EConfirmationMethod = /* @__PURE__ */ function(EConfirmationMethod) {
	EConfirmationMethod[EConfirmationMethod["None"] = 0] = "None";
	EConfirmationMethod[EConfirmationMethod["Email"] = 1] = "Email";
	EConfirmationMethod[EConfirmationMethod["MobileApp"] = 2] = "MobileApp";
	return EConfirmationMethod;
}({});
let EConfirmationType = /* @__PURE__ */ function(EConfirmationType) {
	EConfirmationType[EConfirmationType["Invalid"] = 0] = "Invalid";
	EConfirmationType[EConfirmationType["Generic"] = 1] = "Generic";
	EConfirmationType[EConfirmationType["Trade"] = 2] = "Trade";
	EConfirmationType[EConfirmationType["MarketListing"] = 3] = "MarketListing";
	EConfirmationType[EConfirmationType["FeatureOptOut"] = 4] = "FeatureOptOut";
	EConfirmationType[EConfirmationType["PhoneNumberChange"] = 5] = "PhoneNumberChange";
	EConfirmationType[EConfirmationType["AccountRecovery"] = 6] = "AccountRecovery";
	EConfirmationType[EConfirmationType["BuyOrder"] = 12] = "BuyOrder";
	return EConfirmationType;
}({});
let EOfferFilter = /* @__PURE__ */ function(EOfferFilter) {
	EOfferFilter[EOfferFilter["ActiveOnly"] = 1] = "ActiveOnly";
	EOfferFilter[EOfferFilter["HistoricalOnly"] = 2] = "HistoricalOnly";
	EOfferFilter[EOfferFilter["All"] = 3] = "All";
	return EOfferFilter;
}({});
let EAuthTokenPlatformType = /* @__PURE__ */ function(EAuthTokenPlatformType) {
	EAuthTokenPlatformType[EAuthTokenPlatformType["Unknown"] = 0] = "Unknown";
	EAuthTokenPlatformType[EAuthTokenPlatformType["SteamClient"] = 1] = "SteamClient";
	EAuthTokenPlatformType[EAuthTokenPlatformType["WebBrowser"] = 2] = "WebBrowser";
	EAuthTokenPlatformType[EAuthTokenPlatformType["MobileApp"] = 3] = "MobileApp";
	return EAuthTokenPlatformType;
}({});
let ESessionPersistence = /* @__PURE__ */ function(ESessionPersistence) {
	ESessionPersistence[ESessionPersistence["Invalid"] = -1] = "Invalid";
	ESessionPersistence[ESessionPersistence["Ephemeral"] = 0] = "Ephemeral";
	ESessionPersistence[ESessionPersistence["Persistent"] = 1] = "Persistent";
	return ESessionPersistence;
}({});
let EAuthSessionGuardType = /* @__PURE__ */ function(EAuthSessionGuardType) {
	EAuthSessionGuardType[EAuthSessionGuardType["Unknown"] = 0] = "Unknown";
	EAuthSessionGuardType[EAuthSessionGuardType["None"] = 1] = "None";
	EAuthSessionGuardType[EAuthSessionGuardType["EmailCode"] = 2] = "EmailCode";
	EAuthSessionGuardType[EAuthSessionGuardType["DeviceCode"] = 3] = "DeviceCode";
	EAuthSessionGuardType[EAuthSessionGuardType["DeviceConfirmation"] = 4] = "DeviceConfirmation";
	EAuthSessionGuardType[EAuthSessionGuardType["EmailConfirmation"] = 5] = "EmailConfirmation";
	EAuthSessionGuardType[EAuthSessionGuardType["MachineToken"] = 6] = "MachineToken";
	EAuthSessionGuardType[EAuthSessionGuardType["LegacyMachineAuth"] = 7] = "LegacyMachineAuth";
	return EAuthSessionGuardType;
}({});
let EAuthTokenRevokeAction = /* @__PURE__ */ function(EAuthTokenRevokeAction) {
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Logout"] = 0] = "Logout";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Permanent"] = 1] = "Permanent";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Replaced"] = 2] = "Replaced";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Support"] = 3] = "Support";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Consume"] = 4] = "Consume";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["NonRememberedLogout"] = 5] = "NonRememberedLogout";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["NonRememberedPermanent"] = 6] = "NonRememberedPermanent";
	EAuthTokenRevokeAction[EAuthTokenRevokeAction["Automatic"] = 7] = "Automatic";
	return EAuthTokenRevokeAction;
}({});
let ETokenRenewalType = /* @__PURE__ */ function(ETokenRenewalType) {
	ETokenRenewalType[ETokenRenewalType["None"] = 0] = "None";
	ETokenRenewalType[ETokenRenewalType["Allow"] = 1] = "Allow";
	return ETokenRenewalType;
}({});
let EResult = /* @__PURE__ */ function(EResult) {
	EResult[EResult["Invalid"] = 0] = "Invalid";
	EResult[EResult["OK"] = 1] = "OK";
	EResult[EResult["Fail"] = 2] = "Fail";
	EResult[EResult["NoConnection"] = 3] = "NoConnection";
	EResult[EResult["InvalidPassword"] = 5] = "InvalidPassword";
	EResult[EResult["LoggedInElsewhere"] = 6] = "LoggedInElsewhere";
	EResult[EResult["InvalidProtocolVer"] = 7] = "InvalidProtocolVer";
	EResult[EResult["InvalidParam"] = 8] = "InvalidParam";
	EResult[EResult["FileNotFound"] = 9] = "FileNotFound";
	EResult[EResult["Busy"] = 10] = "Busy";
	EResult[EResult["InvalidState"] = 11] = "InvalidState";
	EResult[EResult["InvalidName"] = 12] = "InvalidName";
	EResult[EResult["InvalidEmail"] = 13] = "InvalidEmail";
	EResult[EResult["DuplicateName"] = 14] = "DuplicateName";
	EResult[EResult["AccessDenied"] = 15] = "AccessDenied";
	EResult[EResult["Timeout"] = 16] = "Timeout";
	EResult[EResult["Banned"] = 17] = "Banned";
	EResult[EResult["AccountNotFound"] = 18] = "AccountNotFound";
	EResult[EResult["InvalidSteamID"] = 19] = "InvalidSteamID";
	EResult[EResult["ServiceUnavailable"] = 20] = "ServiceUnavailable";
	EResult[EResult["NotLoggedOn"] = 21] = "NotLoggedOn";
	EResult[EResult["Pending"] = 22] = "Pending";
	EResult[EResult["EncryptionFailure"] = 23] = "EncryptionFailure";
	EResult[EResult["InsufficientPrivilege"] = 24] = "InsufficientPrivilege";
	EResult[EResult["LimitExceeded"] = 25] = "LimitExceeded";
	EResult[EResult["Revoked"] = 26] = "Revoked";
	EResult[EResult["Expired"] = 27] = "Expired";
	EResult[EResult["AlreadyRedeemed"] = 28] = "AlreadyRedeemed";
	EResult[EResult["DuplicateRequest"] = 29] = "DuplicateRequest";
	EResult[EResult["AlreadyOwned"] = 30] = "AlreadyOwned";
	EResult[EResult["IPNotFound"] = 31] = "IPNotFound";
	EResult[EResult["PersistFailed"] = 32] = "PersistFailed";
	EResult[EResult["LockingFailed"] = 33] = "LockingFailed";
	EResult[EResult["LogonSessionReplaced"] = 34] = "LogonSessionReplaced";
	EResult[EResult["ConnectFailed"] = 35] = "ConnectFailed";
	EResult[EResult["HandshakeFailed"] = 36] = "HandshakeFailed";
	EResult[EResult["IOFailure"] = 37] = "IOFailure";
	EResult[EResult["RemoteDisconnect"] = 38] = "RemoteDisconnect";
	EResult[EResult["ShoppingCartNotFound"] = 39] = "ShoppingCartNotFound";
	EResult[EResult["Blocked"] = 40] = "Blocked";
	EResult[EResult["Ignored"] = 41] = "Ignored";
	EResult[EResult["NoMatch"] = 42] = "NoMatch";
	EResult[EResult["AccountDisabled"] = 43] = "AccountDisabled";
	EResult[EResult["ServiceReadOnly"] = 44] = "ServiceReadOnly";
	EResult[EResult["AccountNotFeatured"] = 45] = "AccountNotFeatured";
	EResult[EResult["AdministratorOK"] = 46] = "AdministratorOK";
	EResult[EResult["ContentVersion"] = 47] = "ContentVersion";
	EResult[EResult["TryAnotherCM"] = 48] = "TryAnotherCM";
	EResult[EResult["PasswordRequiredToKickSession"] = 49] = "PasswordRequiredToKickSession";
	EResult[EResult["AlreadyLoggedInElsewhere"] = 50] = "AlreadyLoggedInElsewhere";
	EResult[EResult["Suspended"] = 51] = "Suspended";
	EResult[EResult["Cancelled"] = 52] = "Cancelled";
	EResult[EResult["DataCorruption"] = 53] = "DataCorruption";
	EResult[EResult["DiskFull"] = 54] = "DiskFull";
	EResult[EResult["RemoteCallFailed"] = 55] = "RemoteCallFailed";
	EResult[EResult["PasswordUnset"] = 56] = "PasswordUnset";
	EResult[EResult["ExternalAccountUnlinked"] = 57] = "ExternalAccountUnlinked";
	EResult[EResult["PSNTicketInvalid"] = 58] = "PSNTicketInvalid";
	EResult[EResult["ExternalAccountAlreadyLinked"] = 59] = "ExternalAccountAlreadyLinked";
	EResult[EResult["RemoteFileConflict"] = 60] = "RemoteFileConflict";
	EResult[EResult["IllegalPassword"] = 61] = "IllegalPassword";
	EResult[EResult["SameAsPreviousValue"] = 62] = "SameAsPreviousValue";
	EResult[EResult["AccountLogonDenied"] = 63] = "AccountLogonDenied";
	EResult[EResult["CannotUseOldPassword"] = 64] = "CannotUseOldPassword";
	EResult[EResult["InvalidLoginAuthCode"] = 65] = "InvalidLoginAuthCode";
	EResult[EResult["AccountLogonDeniedNoMail"] = 66] = "AccountLogonDeniedNoMail";
	EResult[EResult["HardwareNotCapableOfIPT"] = 67] = "HardwareNotCapableOfIPT";
	EResult[EResult["IPTInitError"] = 68] = "IPTInitError";
	EResult[EResult["ParentalControlRestricted"] = 69] = "ParentalControlRestricted";
	EResult[EResult["FacebookQueryError"] = 70] = "FacebookQueryError";
	EResult[EResult["ExpiredLoginAuthCode"] = 71] = "ExpiredLoginAuthCode";
	EResult[EResult["IPLoginRestrictionFailed"] = 72] = "IPLoginRestrictionFailed";
	EResult[EResult["AccountLockedDown"] = 73] = "AccountLockedDown";
	EResult[EResult["AccountLogonDeniedVerifiedEmailRequired"] = 74] = "AccountLogonDeniedVerifiedEmailRequired";
	EResult[EResult["NoMatchingURL"] = 75] = "NoMatchingURL";
	EResult[EResult["BadResponse"] = 76] = "BadResponse";
	EResult[EResult["RequirePasswordReEntry"] = 77] = "RequirePasswordReEntry";
	EResult[EResult["ValueOutOfRange"] = 78] = "ValueOutOfRange";
	EResult[EResult["UnexpectedError"] = 79] = "UnexpectedError";
	EResult[EResult["Disabled"] = 80] = "Disabled";
	EResult[EResult["InvalidCEGSubmission"] = 81] = "InvalidCEGSubmission";
	EResult[EResult["RestrictedDevice"] = 82] = "RestrictedDevice";
	EResult[EResult["RegionLocked"] = 83] = "RegionLocked";
	EResult[EResult["RateLimitExceeded"] = 84] = "RateLimitExceeded";
	EResult[EResult["AccountLoginDeniedNeedTwoFactor"] = 85] = "AccountLoginDeniedNeedTwoFactor";
	EResult[EResult["ItemDeleted"] = 86] = "ItemDeleted";
	EResult[EResult["AccountLoginDeniedThrottle"] = 87] = "AccountLoginDeniedThrottle";
	EResult[EResult["TwoFactorCodeMismatch"] = 88] = "TwoFactorCodeMismatch";
	EResult[EResult["TwoFactorActivationCodeMismatch"] = 89] = "TwoFactorActivationCodeMismatch";
	EResult[EResult["AccountAssociatedToMultiplePartners"] = 90] = "AccountAssociatedToMultiplePartners";
	EResult[EResult["NotModified"] = 91] = "NotModified";
	EResult[EResult["NoMobileDevice"] = 92] = "NoMobileDevice";
	EResult[EResult["TimeNotSynced"] = 93] = "TimeNotSynced";
	EResult[EResult["SMSCodeFailed"] = 94] = "SMSCodeFailed";
	EResult[EResult["AccountLimitExceeded"] = 95] = "AccountLimitExceeded";
	EResult[EResult["AccountActivityLimitExceeded"] = 96] = "AccountActivityLimitExceeded";
	EResult[EResult["PhoneActivityLimitExceeded"] = 97] = "PhoneActivityLimitExceeded";
	EResult[EResult["RefundToWallet"] = 98] = "RefundToWallet";
	EResult[EResult["EmailSendFailure"] = 99] = "EmailSendFailure";
	EResult[EResult["NotSettled"] = 100] = "NotSettled";
	EResult[EResult["NeedCaptcha"] = 101] = "NeedCaptcha";
	EResult[EResult["GSLTDenied"] = 102] = "GSLTDenied";
	EResult[EResult["GSOwnerDenied"] = 103] = "GSOwnerDenied";
	EResult[EResult["InvalidItemType"] = 104] = "InvalidItemType";
	EResult[EResult["IPBanned"] = 105] = "IPBanned";
	EResult[EResult["GSLTExpired"] = 106] = "GSLTExpired";
	EResult[EResult["InsufficientFunds"] = 107] = "InsufficientFunds";
	EResult[EResult["TooManyPending"] = 108] = "TooManyPending";
	EResult[EResult["NoSiteLicensesFound"] = 109] = "NoSiteLicensesFound";
	EResult[EResult["WGNetworkSendExceeded"] = 110] = "WGNetworkSendExceeded";
	EResult[EResult["AccountNotFriends"] = 111] = "AccountNotFriends";
	EResult[EResult["LimitedUserAccount"] = 112] = "LimitedUserAccount";
	return EResult;
}({});
//#endregion
//#region src/core/eresults.ts
const TRANSIENT_ERESULTS = /* @__PURE__ */ new Set([
	20,
	10,
	16,
	48,
	55
]);
function isTransientEResult(eresult) {
	return eresult !== void 0 && TRANSIENT_ERESULTS.has(eresult);
}
const TERMINAL_AUTH_ERESULTS = /* @__PURE__ */ new Set([
	5,
	15,
	26,
	27
]);
function isTerminalAuthEResult(eresult) {
	return eresult !== void 0 && TERMINAL_AUTH_ERESULTS.has(eresult);
}
//#endregion
//#region src/core/errors.ts
const DEFAULT_RATE_LIMIT_RETRY_MS = 6e4;
var SteamError = class extends Error {
	eresult;
	body;
	constructor(message, options) {
		super(message, options?.cause !== void 0 ? { cause: options.cause } : void 0);
		this.name = "SteamError";
		if (options?.eresult !== void 0) this.eresult = options.eresult;
		if (options?.body !== void 0) this.body = options.body;
	}
};
var ProxyError = class extends SteamError {
	constructor(message, options) {
		super(message, options);
		this.name = "ProxyError";
	}
};
var HttpStatusError = class extends SteamError {
	statusCode;
	constructor(statusCode, message, body) {
		super(message ?? `HTTP error ${statusCode}`, { body });
		this.name = "HttpStatusError";
		this.statusCode = statusCode;
	}
};
var SteamSessionExpiredError = class extends SteamError {
	constructor(message = "Not Logged In") {
		super(message);
		this.name = "SteamSessionExpiredError";
	}
};
var OpenIdError = class extends SteamError {
	constructor(message) {
		super(message);
		this.name = "OpenIdError";
	}
};
var RateLimitError = class extends SteamError {
	statusCode;
	retryAfterMs;
	unlockAt;
	constructor(options = {}) {
		super(options.message ?? "Rate limit exceeded", {
			...options.eresult !== void 0 ? { eresult: options.eresult } : {},
			body: options.body
		});
		this.name = "RateLimitError";
		this.statusCode = options.statusCode;
		this.retryAfterMs = options.retryAfterMs ?? 6e4;
		this.unlockAt = Date.now() + this.retryAfterMs;
	}
};
var ThrottledError = class extends SteamError {
	statusCode = 403;
	constructor(message = "Throttled (403)", options) {
		super(message, options);
		this.name = "ThrottledError";
	}
};
var EscrowError = class extends SteamError {
	escrowDays;
	constructor(escrowDays, message) {
		super(message ?? `Trade would be held in escrow for ${escrowDays} days`);
		this.name = "EscrowError";
		this.escrowDays = escrowDays;
	}
};
var TradeBanError = class extends SteamError {
	constructor(message = "Trade ban") {
		super(message);
		this.name = "TradeBanError";
	}
};
var OfferLimitError = class extends SteamError {
	constructor(message = "Sent too many trade offers") {
		super(message, { eresult: 25 });
		this.name = "OfferLimitError";
	}
};
var NewDeviceError = class extends SteamError {
	constructor(message = "You have logged in from a new device", options) {
		super(message, options);
		this.name = "NewDeviceError";
	}
};
var TargetCannotTradeError = class extends SteamError {
	constructor(message = "This user is not available to trade", options) {
		super(message, options);
		this.name = "TargetCannotTradeError";
	}
};
var ItemServerUnavailableError = class extends SteamError {
	constructor(message = "Steam is currently unable to contact the game's item server", options) {
		super(message, { eresult: options?.eresult ?? 102 });
		this.name = "ItemServerUnavailableError";
	}
};
var ConfirmationError = class extends SteamError {
	constructor(message) {
		super(message);
		this.name = "ConfirmationError";
	}
};
var FamilyViewError = class extends SteamError {
	constructor(message = "Family View Restricted") {
		super(message);
		this.name = "FamilyViewError";
	}
};
var PrivateInventoryError = class extends SteamError {
	constructor(message = "This profile's inventory is private.") {
		super(message);
		this.name = "PrivateInventoryError";
	}
};
var MarketConfirmationLimitError = class extends SteamError {
	constructor(message = "Too many listings pending confirmation", options) {
		super(message, options);
		this.name = "MarketConfirmationLimitError";
	}
};
var WalletBalanceLimitError = class extends SteamError {
	constructor(message = "Listing would exceed the maximum wallet balance", options) {
		super(message, options);
		this.name = "WalletBalanceLimitError";
	}
};
var MarketBlockedError = class extends SteamError {
	constructor(message = "This account is currently unable to use the Community Market", options) {
		super(message, options);
		this.name = "MarketBlockedError";
	}
};
var LoginError = class extends SteamError {
	extendedErrorMessage;
	isTransient;
	constructor(message, options) {
		super(message, options);
		this.name = "LoginError";
		this.extendedErrorMessage = options?.extendedErrorMessage;
		this.isTransient = isTransientEResult(options?.eresult);
	}
};
var NoMobileAuthenticatorError = class extends LoginError {
	constructor(message = "account has no mobile authenticator attached; sharedSecret cannot be used (account uses email Steam Guard)") {
		super(message);
		this.name = "NoMobileAuthenticatorError";
	}
};
//#endregion
//#region src/protobufs/steammessages_auth_pb.ts
/**
* Describes the file steammessages_auth.proto.
*/
const file_steammessages_auth = /*@__PURE__*/ fileDesc("ChhzdGVhbW1lc3NhZ2VzX2F1dGgucHJvdG8iRwovQ0F1dGhlbnRpY2F0aW9uX0dldFBhc3N3b3JkUlNBUHVibGljS2V5X1JlcXVlc3QSFAoMYWNjb3VudF9uYW1lGAEgASgJInMKMENBdXRoZW50aWNhdGlvbl9HZXRQYXNzd29yZFJTQVB1YmxpY0tleV9SZXNwb25zZRIVCg1wdWJsaWNrZXlfbW9kGAEgASgJEhUKDXB1YmxpY2tleV9leHAYAiABKAkSEQoJdGltZXN0YW1wGAMgASgEIqkCCh1DQXV0aGVudGljYXRpb25fRGV2aWNlRGV0YWlscxIcChRkZXZpY2VfZnJpZW5kbHlfbmFtZRgBIAEoCRJQCg1wbGF0Zm9ybV90eXBlGAIgASgOMhcuRUF1dGhUb2tlblBsYXRmb3JtVHlwZToga19FQXV0aFRva2VuUGxhdGZvcm1UeXBlX1Vua25vd24SDwoHb3NfdHlwZRgDIAEoBRIaChJnYW1pbmdfZGV2aWNlX3R5cGUYBCABKA0SFAoMY2xpZW50X2NvdW50GAUgASgNEhIKCm1hY2hpbmVfaWQYBiABKAwSQQoIYXBwX3R5cGUYByABKA4yEi5FQXV0aFRva2VuQXBwVHlwZToba19FQXV0aFRva2VuQXBwVHlwZV9Vbmtub3duIpUBCiNDQXV0aGVudGljYXRpb25fQWxsb3dlZENvbmZpcm1hdGlvbhJSChFjb25maXJtYXRpb25fdHlwZRgBIAEoDjIWLkVBdXRoU2Vzc2lvbkd1YXJkVHlwZTofa19FQXV0aFNlc3Npb25HdWFyZFR5cGVfVW5rbm93bhIaChJhc3NvY2lhdGVkX21lc3NhZ2UYAiABKAki7gMKNkNBdXRoZW50aWNhdGlvbl9CZWdpbkF1dGhTZXNzaW9uVmlhQ3JlZGVudGlhbHNfUmVxdWVzdBIcChRkZXZpY2VfZnJpZW5kbHlfbmFtZRgBIAEoCRIUCgxhY2NvdW50X25hbWUYAiABKAkSGgoSZW5jcnlwdGVkX3Bhc3N3b3JkGAMgASgJEhwKFGVuY3J5cHRpb25fdGltZXN0YW1wGAQgASgEEhYKDnJlbWVtYmVyX2xvZ2luGAUgASgIElAKDXBsYXRmb3JtX3R5cGUYBiABKA4yFy5FQXV0aFRva2VuUGxhdGZvcm1UeXBlOiBrX0VBdXRoVG9rZW5QbGF0Zm9ybVR5cGVfVW5rbm93bhJLCgtwZXJzaXN0ZW5jZRgHIAEoDjIULkVTZXNzaW9uUGVyc2lzdGVuY2U6IGtfRVNlc3Npb25QZXJzaXN0ZW5jZV9QZXJzaXN0ZW50EhsKCndlYnNpdGVfaWQYCCABKAk6B1Vua25vd24SNgoOZGV2aWNlX2RldGFpbHMYCSABKAsyHi5DQXV0aGVudGljYXRpb25fRGV2aWNlRGV0YWlscxISCgpndWFyZF9kYXRhGAogASgJEhAKCGxhbmd1YWdlGAsgASgNEhQKCXFvc19sZXZlbBgMIAEoBToBMiKbAgo3Q0F1dGhlbnRpY2F0aW9uX0JlZ2luQXV0aFNlc3Npb25WaWFDcmVkZW50aWFsc19SZXNwb25zZRIRCgljbGllbnRfaWQYASABKAQSEgoKcmVxdWVzdF9pZBgCIAEoDBIQCghpbnRlcnZhbBgDIAEoAhJDChVhbGxvd2VkX2NvbmZpcm1hdGlvbnMYBCADKAsyJC5DQXV0aGVudGljYXRpb25fQWxsb3dlZENvbmZpcm1hdGlvbhIPCgdzdGVhbWlkGAUgASgEEhIKCndlYWtfdG9rZW4YBiABKAkSHQoVYWdyZWVtZW50X3Nlc3Npb25fdXJsGAcgASgJEh4KFmV4dGVuZGVkX2Vycm9yX21lc3NhZ2UYCCABKAkibwotQ0F1dGhlbnRpY2F0aW9uX1BvbGxBdXRoU2Vzc2lvblN0YXR1c19SZXF1ZXN0EhEKCWNsaWVudF9pZBgBIAEoBBISCgpyZXF1ZXN0X2lkGAIgASgMEhcKD3Rva2VuX3RvX3Jldm9rZRgDIAEoBiL8AQouQ0F1dGhlbnRpY2F0aW9uX1BvbGxBdXRoU2Vzc2lvblN0YXR1c19SZXNwb25zZRIVCg1uZXdfY2xpZW50X2lkGAEgASgEEhkKEW5ld19jaGFsbGVuZ2VfdXJsGAIgASgJEhUKDXJlZnJlc2hfdG9rZW4YAyABKAkSFAoMYWNjZXNzX3Rva2VuGAQgASgJEh4KFmhhZF9yZW1vdGVfaW50ZXJhY3Rpb24YBSABKAgSFAoMYWNjb3VudF9uYW1lGAYgASgJEhYKDm5ld19ndWFyZF9kYXRhGAcgASgJEh0KFWFncmVlbWVudF9zZXNzaW9uX3VybBgIIAEoCSK7AQo7Q0F1dGhlbnRpY2F0aW9uX1VwZGF0ZUF1dGhTZXNzaW9uV2l0aFN0ZWFtR3VhcmRDb2RlX1JlcXVlc3QSEQoJY2xpZW50X2lkGAEgASgEEg8KB3N0ZWFtaWQYAiABKAYSDAoEY29kZRgDIAEoCRJKCgljb2RlX3R5cGUYBCABKA4yFi5FQXV0aFNlc3Npb25HdWFyZFR5cGU6H2tfRUF1dGhTZXNzaW9uR3VhcmRUeXBlX1Vua25vd24iXQo8Q0F1dGhlbnRpY2F0aW9uX1VwZGF0ZUF1dGhTZXNzaW9uV2l0aFN0ZWFtR3VhcmRDb2RlX1Jlc3BvbnNlEh0KFWFncmVlbWVudF9zZXNzaW9uX3VybBgHIAEoCSKgAQoyQ0F1dGhlbnRpY2F0aW9uX0FjY2Vzc1Rva2VuX0dlbmVyYXRlRm9yQXBwX1JlcXVlc3QSFQoNcmVmcmVzaF90b2tlbhgBIAEoCRIPCgdzdGVhbWlkGAIgASgGEkIKDHJlbmV3YWxfdHlwZRgDIAEoDjISLkVUb2tlblJlbmV3YWxUeXBlOhhrX0VUb2tlblJlbmV3YWxUeXBlX05vbmUiYgozQ0F1dGhlbnRpY2F0aW9uX0FjY2Vzc1Rva2VuX0dlbmVyYXRlRm9yQXBwX1Jlc3BvbnNlEhQKDGFjY2Vzc190b2tlbhgBIAEoCRIVCg1yZWZyZXNoX3Rva2VuGAIgASgJIjMKMUNBdXRoZW50aWNhdGlvbl9HZXRBdXRoU2Vzc2lvbnNGb3JBY2NvdW50X1JlcXVlc3QiSAoyQ0F1dGhlbnRpY2F0aW9uX0dldEF1dGhTZXNzaW9uc0ZvckFjY291bnRfUmVzcG9uc2USEgoKY2xpZW50X2lkcxgBIAMoBCKwAQorQ0F1dGhlbnRpY2F0aW9uX1JlZnJlc2hUb2tlbl9SZXZva2VfUmVxdWVzdBIQCgh0b2tlbl9pZBgBIAEoBhIPCgdzdGVhbWlkGAIgASgGEksKDXJldm9rZV9hY3Rpb24YAyABKA4yFy5FQXV0aFRva2VuUmV2b2tlQWN0aW9uOhtrX0VBdXRoVG9rZW5SZXZva2VQZXJtYW5lbnQSEQoJc2lnbmF0dXJlGAQgASgMIi4KLENBdXRoZW50aWNhdGlvbl9SZWZyZXNoVG9rZW5fUmV2b2tlX1Jlc3BvbnNlKrkBChZFQXV0aFRva2VuUGxhdGZvcm1UeXBlEiQKIGtfRUF1dGhUb2tlblBsYXRmb3JtVHlwZV9Vbmtub3duEAASKAoka19FQXV0aFRva2VuUGxhdGZvcm1UeXBlX1N0ZWFtQ2xpZW50EAESJwoja19FQXV0aFRva2VuUGxhdGZvcm1UeXBlX1dlYkJyb3dzZXIQAhImCiJrX0VBdXRoVG9rZW5QbGF0Zm9ybVR5cGVfTW9iaWxlQXBwEAMqhQEKEUVBdXRoVG9rZW5BcHBUeXBlEh8KG2tfRUF1dGhUb2tlbkFwcFR5cGVfVW5rbm93bhAAEicKI2tfRUF1dGhUb2tlbkFwcFR5cGVfTW9iaWxlX1N0ZWFtQXBwEAESJgoia19FQXV0aFRva2VuQXBwVHlwZV9Nb2JpbGVfQ2hhdEFwcBACKuUCChVFQXV0aFNlc3Npb25HdWFyZFR5cGUSIwofa19FQXV0aFNlc3Npb25HdWFyZFR5cGVfVW5rbm93bhAAEiAKHGtfRUF1dGhTZXNzaW9uR3VhcmRUeXBlX05vbmUQARIlCiFrX0VBdXRoU2Vzc2lvbkd1YXJkVHlwZV9FbWFpbENvZGUQAhImCiJrX0VBdXRoU2Vzc2lvbkd1YXJkVHlwZV9EZXZpY2VDb2RlEAMSLgoqa19FQXV0aFNlc3Npb25HdWFyZFR5cGVfRGV2aWNlQ29uZmlybWF0aW9uEAQSLQopa19FQXV0aFNlc3Npb25HdWFyZFR5cGVfRW1haWxDb25maXJtYXRpb24QBRIoCiRrX0VBdXRoU2Vzc2lvbkd1YXJkVHlwZV9NYWNoaW5lVG9rZW4QBhItCilrX0VBdXRoU2Vzc2lvbkd1YXJkVHlwZV9MZWdhY3lNYWNoaW5lQXV0aBAHKlAKEUVUb2tlblJlbmV3YWxUeXBlEhwKGGtfRVRva2VuUmVuZXdhbFR5cGVfTm9uZRAAEh0KGWtfRVRva2VuUmVuZXdhbFR5cGVfQWxsb3cQASqvAgoWRUF1dGhUb2tlblJldm9rZUFjdGlvbhIcChhrX0VBdXRoVG9rZW5SZXZva2VMb2dvdXQQABIfChtrX0VBdXRoVG9rZW5SZXZva2VQZXJtYW5lbnQQARIeChprX0VBdXRoVG9rZW5SZXZva2VSZXBsYWNlZBACEh0KGWtfRUF1dGhUb2tlblJldm9rZVN1cHBvcnQQAxIdChlrX0VBdXRoVG9rZW5SZXZva2VDb25zdW1lEAQSKQola19FQXV0aFRva2VuUmV2b2tlTm9uUmVtZW1iZXJlZExvZ291dBAFEiwKKGtfRUF1dGhUb2tlblJldm9rZU5vblJlbWVtYmVyZWRQZXJtYW5lbnQQBhIfChtrX0VBdXRoVG9rZW5SZXZva2VBdXRvbWF0aWMQByqMAQoTRVNlc3Npb25QZXJzaXN0ZW5jZRIqCh1rX0VTZXNzaW9uUGVyc2lzdGVuY2VfSW52YWxpZBD///////////8BEiMKH2tfRVNlc3Npb25QZXJzaXN0ZW5jZV9FcGhlbWVyYWwQABIkCiBrX0VTZXNzaW9uUGVyc2lzdGVuY2VfUGVyc2lzdGVudBAB");
/**
* Describes the message CAuthentication_GetPasswordRSAPublicKey_Request.
* Use `create(CAuthentication_GetPasswordRSAPublicKey_RequestSchema)` to create a new message.
*/
const CAuthentication_GetPasswordRSAPublicKey_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 0);
/**
* Describes the message CAuthentication_GetPasswordRSAPublicKey_Response.
* Use `create(CAuthentication_GetPasswordRSAPublicKey_ResponseSchema)` to create a new message.
*/
const CAuthentication_GetPasswordRSAPublicKey_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 1);
/**
* Describes the message CAuthentication_DeviceDetails.
* Use `create(CAuthentication_DeviceDetailsSchema)` to create a new message.
*/
const CAuthentication_DeviceDetailsSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 2);
/**
* Describes the message CAuthentication_BeginAuthSessionViaCredentials_Request.
* Use `create(CAuthentication_BeginAuthSessionViaCredentials_RequestSchema)` to create a new message.
*/
const CAuthentication_BeginAuthSessionViaCredentials_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 4);
/**
* Describes the message CAuthentication_BeginAuthSessionViaCredentials_Response.
* Use `create(CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema)` to create a new message.
*/
const CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 5);
/**
* Describes the message CAuthentication_PollAuthSessionStatus_Request.
* Use `create(CAuthentication_PollAuthSessionStatus_RequestSchema)` to create a new message.
*/
const CAuthentication_PollAuthSessionStatus_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 6);
/**
* Describes the message CAuthentication_PollAuthSessionStatus_Response.
* Use `create(CAuthentication_PollAuthSessionStatus_ResponseSchema)` to create a new message.
*/
const CAuthentication_PollAuthSessionStatus_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 7);
/**
* Describes the message CAuthentication_UpdateAuthSessionWithSteamGuardCode_Request.
* Use `create(CAuthentication_UpdateAuthSessionWithSteamGuardCode_RequestSchema)` to create a new message.
*/
const CAuthentication_UpdateAuthSessionWithSteamGuardCode_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 8);
/**
* Describes the message CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response.
* Use `create(CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema)` to create a new message.
*/
const CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 9);
/**
* Describes the message CAuthentication_AccessToken_GenerateForApp_Request.
* Use `create(CAuthentication_AccessToken_GenerateForApp_RequestSchema)` to create a new message.
*/
const CAuthentication_AccessToken_GenerateForApp_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 10);
/**
* Describes the message CAuthentication_AccessToken_GenerateForApp_Response.
* Use `create(CAuthentication_AccessToken_GenerateForApp_ResponseSchema)` to create a new message.
*/
const CAuthentication_AccessToken_GenerateForApp_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 11);
/**
* Describes the message CAuthentication_GetAuthSessionsForAccount_Request.
* Use `create(CAuthentication_GetAuthSessionsForAccount_RequestSchema)` to create a new message.
*/
const CAuthentication_GetAuthSessionsForAccount_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 12);
/**
* Describes the message CAuthentication_GetAuthSessionsForAccount_Response.
* Use `create(CAuthentication_GetAuthSessionsForAccount_ResponseSchema)` to create a new message.
*/
const CAuthentication_GetAuthSessionsForAccount_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 13);
/**
* Describes the message CAuthentication_RefreshToken_Revoke_Request.
* Use `create(CAuthentication_RefreshToken_Revoke_RequestSchema)` to create a new message.
*/
const CAuthentication_RefreshToken_Revoke_RequestSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 14);
/**
* Describes the message CAuthentication_RefreshToken_Revoke_Response.
* Use `create(CAuthentication_RefreshToken_Revoke_ResponseSchema)` to create a new message.
*/
const CAuthentication_RefreshToken_Revoke_ResponseSchema = /*@__PURE__*/ messageDesc(file_steammessages_auth, 15);
//#endregion
//#region src/session/protoTransport.ts
function createProtoTransport(http) {
	return async (req) => {
		const base64 = req.body && req.body.length > 0 ? Buffer$1.from(req.body).toString("base64") : "";
		const searchParams = {};
		if (req.accessToken) {
			searchParams.access_token = req.accessToken;
			searchParams.spoof_steamid = req.spoofSteamid ?? "";
		}
		if (req.origin) searchParams.origin = "SteamMobile";
		let res;
		if (req.method === "GET") {
			searchParams.input_protobuf_encoded = base64;
			res = await http.get(req.url, {
				responseType: "buffer",
				searchParams
			});
		} else {
			const bodyOpt = req.multipart ? { multipart: [{
				name: "input_protobuf_encoded",
				value: base64
			}] } : { form: { input_protobuf_encoded: base64 } };
			res = await http.post(req.url, {
				responseType: "buffer",
				...Object.keys(searchParams).length > 0 ? { searchParams } : {},
				...bodyOpt
			});
		}
		return {
			status: res.statusCode,
			eresult: headerValue$1(res.headers["x-eresult"]) ?? null,
			errorMessage: headerValue$1(res.headers["x-error_message"]) ?? null,
			body: res.body
		};
	};
}
function createProtoPost(http) {
	const transport = createProtoTransport(http);
	return (url, base64Body, accessToken) => transport({
		url,
		method: "POST",
		body: Buffer$1.from(base64Body, "base64"),
		...accessToken ? { accessToken } : {}
	});
}
function headerValue$1(v) {
	return Array.isArray(v) ? v[0] : v;
}
//#endregion
//#region src/auth/AuthClient.ts
var AuthClient = class {
	transport;
	constructor(http) {
		this.transport = createProtoTransport(http);
	}
	async getPasswordRSAPublicKey(accountName) {
		const body = toBinary(CAuthentication_GetPasswordRSAPublicKey_RequestSchema, create(CAuthentication_GetPasswordRSAPublicKey_RequestSchema, { accountName }));
		const out = await this.send({
			apiMethod: "GetPasswordRSAPublicKey",
			method: "GET",
			body,
			origin: true
		});
		return fromBinary(CAuthentication_GetPasswordRSAPublicKey_ResponseSchema, out);
	}
	async beginAuthSessionViaCredentials(req) {
		const body = toBinary(CAuthentication_BeginAuthSessionViaCredentials_RequestSchema, create(CAuthentication_BeginAuthSessionViaCredentials_RequestSchema, req));
		const out = await this.send({
			apiMethod: "BeginAuthSessionViaCredentials",
			method: "POST",
			body,
			multipart: true
		});
		return fromBinary(CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema, out);
	}
	async pollAuthSessionStatus(clientId, requestId) {
		const body = toBinary(CAuthentication_PollAuthSessionStatus_RequestSchema, create(CAuthentication_PollAuthSessionStatus_RequestSchema, {
			clientId,
			requestId
		}));
		const out = await this.send({
			apiMethod: "PollAuthSessionStatus",
			method: "POST",
			body,
			multipart: true
		});
		return fromBinary(CAuthentication_PollAuthSessionStatus_ResponseSchema, out);
	}
	async updateAuthSessionWithSteamGuardCode(clientId, steamid, code, codeType) {
		const body = toBinary(CAuthentication_UpdateAuthSessionWithSteamGuardCode_RequestSchema, create(CAuthentication_UpdateAuthSessionWithSteamGuardCode_RequestSchema, {
			clientId,
			steamid,
			code,
			codeType
		}));
		const out = await this.send({
			apiMethod: "UpdateAuthSessionWithSteamGuardCode",
			method: "POST",
			body,
			multipart: true
		});
		return fromBinary(CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema, out);
	}
	async getAuthSessionsForAccount(accessToken) {
		const body = toBinary(CAuthentication_GetAuthSessionsForAccount_RequestSchema, create(CAuthentication_GetAuthSessionsForAccount_RequestSchema, {}));
		const out = await this.send({
			apiMethod: "GetAuthSessionsForAccount",
			method: "GET",
			body,
			accessToken,
			origin: true
		});
		return fromBinary(CAuthentication_GetAuthSessionsForAccount_ResponseSchema, out);
	}
	async revokeRefreshToken(accessToken, revokeAction) {
		const body = toBinary(CAuthentication_RefreshToken_Revoke_RequestSchema, create(CAuthentication_RefreshToken_Revoke_RequestSchema, { revokeAction }));
		const out = await this.send({
			apiMethod: "RevokeRefreshToken",
			method: "POST",
			body,
			accessToken,
			multipart: true
		});
		return fromBinary(CAuthentication_RefreshToken_Revoke_ResponseSchema, out);
	}
	async send(opts) {
		const url = `${URLS.api}/IAuthenticationService/${opts.apiMethod}/v1`;
		const res = await this.transport({
			url,
			method: opts.method,
			...opts.body ? { body: opts.body } : {},
			...opts.accessToken ? { accessToken: opts.accessToken } : {},
			...opts.origin ? { origin: true } : {},
			...opts.multipart ? { multipart: true } : {}
		});
		ensureOk(res, opts.apiMethod);
		return toUint8$1(res.body);
	}
};
function ensureOk(res, apiMethod) {
	if (res.status === 429) throw new RateLimitError({
		message: `IAuthenticationService/${apiMethod} HTTP 429`,
		...res.eresult ? { eresult: Number(res.eresult) } : {}
	});
	if (res.status < 200 || res.status >= 300) throw new LoginError(`IAuthenticationService/${apiMethod} HTTP ${res.status}`, {
		...res.eresult ? { eresult: Number(res.eresult) } : {},
		...res.errorMessage ? { extendedErrorMessage: res.errorMessage } : {}
	});
	const er = res.eresult;
	if (er && er !== "1") {
		const code = Number(er);
		if (code === 2 && res.body.length > 0) return;
		const msg = `${apiMethod}: ${EResult[code] ?? "EResult"} (${er})${res.errorMessage ? ` ${res.errorMessage}` : ""}`;
		if (code === 84) throw new RateLimitError({
			message: msg,
			eresult: code
		});
		throw new LoginError(msg, {
			eresult: code,
			...res.errorMessage ? { extendedErrorMessage: res.errorMessage } : {}
		});
	}
}
function toUint8$1(input) {
	return input instanceof Uint8Array && !Buffer$1.isBuffer(input) ? input : new Uint8Array(input);
}
//#endregion
//#region src/crypto/rsa.ts
function encryptPassword(password, modHex, expHex) {
	const n = Buffer$1.from(modHex, "hex").toString("base64url");
	const e = Buffer$1.from(expHex, "hex").toString("base64url");
	const key = createPublicKey({
		key: {
			kty: "RSA",
			n,
			e
		},
		format: "jwk"
	});
	return publicEncrypt({
		key,
		padding: constants.RSA_PKCS1_PADDING
	}, Buffer$1.from(password, "utf8")).toString("base64");
}
//#endregion
//#region src/crypto/steamTotp.ts
const CODE_CHARS = "23456789BCDFGHJKMNPQRTVWXY";
function time(timeOffset = 0) {
	return Math.floor(Date.now() / 1e3) + timeOffset;
}
function getAuthCode(secret, timeOffset = 0) {
	const key = bufferizeSecret(secret);
	const buffer = Buffer$1.allocUnsafe(8);
	buffer.writeUInt32BE(0, 0);
	buffer.writeUInt32BE(Math.floor(time(timeOffset) / 30), 4);
	const hmac = createHmac("sha1", key).update(buffer).digest();
	const start = (hmac[19] ?? 0) & 15;
	let fullcode = hmac.subarray(start, start + 4).readUInt32BE(0) & 2147483647;
	let code = "";
	for (let i = 0; i < 5; i++) {
		code += CODE_CHARS.charAt(fullcode % 26);
		fullcode /= 26;
	}
	return code;
}
function getConfirmationKey(identitySecret, t, tag) {
	const key = bufferizeSecret(identitySecret);
	const dataLen = 8 + (tag ? Math.min(tag.length, 32) : 0);
	const buffer = Buffer$1.allocUnsafe(dataLen);
	buffer.writeBigUInt64BE(BigInt(t), 0);
	if (tag) buffer.write(tag, 8);
	return createHmac("sha1", key).update(buffer).digest("base64");
}
function getDeviceID(steamID) {
	const salt = process.env.STEAM_TOTP_SALT ?? "";
	return `android:${createHash("sha1").update(steamID + salt).digest("hex").replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12}).*$/, "$1-$2-$3-$4-$5")}`;
}
function bufferizeSecret(secret) {
	if (typeof secret !== "string") return secret;
	return /[0-9a-f]{40}/i.test(secret) ? Buffer$1.from(secret, "hex") : Buffer$1.from(secret, "base64");
}
//#endregion
//#region src/auth/deviceDetails.ts
function buildDeviceDetails(profile) {
	return create(CAuthentication_DeviceDetailsSchema, {
		deviceFriendlyName: profile.deviceFriendlyName,
		platformType: 3,
		osType: profile.osType,
		gamingDeviceType: profile.gamingDeviceType,
		...profile.appType !== void 0 ? { appType: profile.appType } : {}
	});
}
//#endregion
//#region src/auth/CredentialSession.ts
const DEFAULT_POLL_TIMEOUT_MS = 18e4;
const DEFAULT_POLL_INTERVAL_MS = 5e3;
var CredentialSession = class extends EventEmitter {
	profile;
	pollTimeoutMs;
	auth;
	clientId = 0n;
	requestId = /* @__PURE__ */ new Uint8Array();
	pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
	allowedConfirmations = [];
	deadline = 0;
	pollTimer;
	settled = false;
	remoteInteractionEmitted = false;
	steamID;
	username = "";
	accessToken;
	refreshToken;
	constructor(http, profile, pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS) {
		super();
		this.profile = profile;
		this.pollTimeoutMs = pollTimeoutMs;
		this.auth = new AuthClient(http);
	}
	async start(opts) {
		this.username = opts.username;
		const rsa = await this.auth.getPasswordRSAPublicKey(opts.username);
		const encryptedPassword = encryptPassword(opts.password, rsa.publickeyMod, rsa.publickeyExp);
		const begin = await this.auth.beginAuthSessionViaCredentials({
			accountName: opts.username,
			encryptedPassword,
			encryptionTimestamp: rsa.timestamp,
			rememberLogin: true,
			persistence: 1,
			websiteId: "Mobile",
			deviceDetails: buildDeviceDetails(this.profile),
			language: 0
		});
		if (begin.requestId.length === 0) throw new LoginError(begin.extendedErrorMessage || "login was rejected by Steam", { ...begin.extendedErrorMessage ? { extendedErrorMessage: begin.extendedErrorMessage } : {} });
		this.clientId = begin.clientId;
		this.requestId = begin.requestId;
		if (begin.steamid) this.steamID = new SteamID(begin.steamid.toString());
		if (begin.interval > 0) this.pollIntervalMs = Math.round(begin.interval * 1e3);
		this.allowedConfirmations = begin.allowedConfirmations.map((c) => Number(c.confirmationType));
		this.emit("debug", `begin OK: confirmations=[${this.allowedConfirmations.join(",")}]`);
		await this.answerConfirmations(opts);
		this.deadline = Date.now() + this.pollTimeoutMs;
		this.schedulePoll();
	}
	async submitSteamGuardCode(code) {
		const trimmed = code?.trim();
		if (!trimmed) throw new LoginError("a Steam Guard code is required");
		const codeType = this.allowedConfirmations.includes(3) ? 3 : 2;
		await this.submitCode(trimmed, codeType);
	}
	stop() {
		this.settled = true;
		if (this.pollTimer) clearTimeout(this.pollTimer);
		this.pollTimer = void 0;
	}
	async answerConfirmations(opts) {
		const allowed = this.allowedConfirmations;
		if (allowed.includes(3) && opts.sharedSecret) {
			const code = getAuthCode(opts.sharedSecret);
			this.emit("debug", "answering DeviceCode with generated TOTP");
			await this.submitCode(code, 3);
			return;
		}
		if (opts.sharedSecret && !allowed.includes(3)) throw new NoMobileAuthenticatorError();
		if (opts.steamGuardCode) {
			const codeType = allowed.includes(3) ? 3 : 2;
			await this.submitCode(opts.steamGuardCode, codeType);
			return;
		}
		if (allowed.includes(4) || allowed.includes(5)) {
			this.emitRemoteInteraction();
			return;
		}
		const codeGuard = allowed.find((t) => t === 2 || t === 3);
		if (codeGuard !== void 0) this.emit("steamGuardRequired", {
			type: codeGuard,
			message: codeGuard === 2 ? "an email Steam Guard code is required" : "a device (TOTP) Steam Guard code is required"
		});
	}
	async submitCode(code, codeType) {
		if (!this.steamID) throw new LoginError("cannot submit Steam Guard code before begin");
		await this.auth.updateAuthSessionWithSteamGuardCode(this.clientId, BigInt(this.steamID.getSteamID64()), code, codeType);
	}
	schedulePoll() {
		if (this.settled) return;
		this.pollTimer = setTimeout(() => {
			this.poll().catch((err) => this.fail(err instanceof Error ? err : new Error(String(err))));
		}, this.pollIntervalMs);
	}
	async poll() {
		if (this.settled) return;
		let res;
		try {
			res = await this.auth.pollAuthSessionStatus(this.clientId, this.requestId);
		} catch (err) {
			if (Date.now() >= this.deadline) {
				this.stop();
				this.emit("timeout");
				return;
			}
			this.emit("debug", `poll error, retrying: ${err.message}`);
			this.schedulePoll();
			return;
		}
		if (res.hadRemoteInteraction) this.emitRemoteInteraction();
		if (res.newClientId) this.clientId = res.newClientId;
		if (res.accessToken) this.accessToken = res.accessToken;
		if (res.refreshToken) {
			this.refreshToken = res.refreshToken;
			if (res.accountName) this.username = res.accountName;
			this.stop();
			this.emit("authenticated");
			return;
		}
		if (Date.now() >= this.deadline) {
			this.stop();
			this.emit("timeout");
			return;
		}
		this.schedulePoll();
	}
	emitRemoteInteraction() {
		if (this.remoteInteractionEmitted) return;
		this.remoteInteractionEmitted = true;
		this.emit("remoteInteraction");
	}
	fail(error) {
		if (this.settled) return;
		this.stop();
		this.emit("error", error);
	}
};
//#endregion
//#region src/core/mobileProfile.ts
const IOS_PROFILE = {
	mobileClient: "ios",
	mobileClientVersion: "777777 3.10.9",
	apiUserAgent: "Steam%20Mobile/10472498 CFNetwork/3860.600.12 Darwin/25.5.0",
	webUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X; Valve Steam App Version/3) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
	deviceFriendlyName: "iPhone18,3",
	osType: -600,
	gamingDeviceType: 528,
	appType: 1
};
const ANDROID_PROFILE = {
	mobileClient: "android",
	mobileClientVersion: "777777 3.10.3",
	apiUserAgent: "okhttp/4.9.2",
	webUserAgent: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
	deviceFriendlyName: "Galaxy S25",
	osType: -500,
	gamingDeviceType: 528
};
const PRESETS = {
	ios: IOS_PROFILE,
	android: ANDROID_PROFILE
};
function resolveMobileProfile(input) {
	if (input === void 0) return { ...IOS_PROFILE };
	if (typeof input === "string") return { ...PRESETS[input] };
	return {
		...input.mobileClient === "android" ? ANDROID_PROFILE : IOS_PROFILE,
		...input
	};
}
//#endregion
//#region src/http/HttpClient.ts
const COOKIE_HOSTS = [
	URLS.community,
	URLS.store,
	URLS.help,
	URLS.api
];
const IMPIT_BROWSER = {
	ios: {
		web: "ios18",
		native: "ios18"
	},
	android: {
		web: "chrome",
		native: "okhttp5"
	}
};
const BROWSER_ACCEPT$1 = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
function clean(input) {
	if (!input) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(input)) if (v !== void 0) out[k] = String(v);
	return out;
}
function buildMultipart(fields, boundary) {
	let out = "";
	for (const { name, value } of fields) out += `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
	return `${out}--${boundary}--\r\n`;
}
var HttpClient = class {
	jar;
	webClient;
	nativeClient;
	browserClient;
	profile;
	proxy;
	constructor(opts) {
		this.jar = new CookieJar();
		this.profile = opts.profile;
		this.proxy = opts.proxy;
		const makeClient = (browser) => new Impit({
			browser,
			cookieJar: this.jar,
			followRedirects: false,
			timeout: 5e4,
			...opts.proxy ? { proxyUrl: opts.proxy } : {}
		});
		const fp = IMPIT_BROWSER[this.profile.mobileClient];
		this.webClient = makeClient(fp.web);
		this.nativeClient = fp.native === fp.web ? this.webClient : makeClient(fp.native);
		this.browserClient = fp.web === "chrome" ? this.webClient : makeClient("chrome");
		for (const raw of [
			`mobileClient=${this.profile.mobileClient}`,
			`mobileClientVersion=${this.profile.mobileClientVersion}`,
			"Steam_Language=english"
		]) for (const host of COOKIE_HOSTS) this.jar.setCookieSync(raw, host);
	}
	async request(method, url, opts = {}) {
		const res = await this.perform(method, url, opts);
		const location = firstHeader(res.headers.location);
		if (res.statusCode >= 300 && res.statusCode < 400 && location?.includes("/market/eligibilitycheck")) {
			await this.perform("GET", location, opts.signal ? { signal: opts.signal } : {});
			return this.perform(method, url, opts);
		}
		return res;
	}
	async perform(method, url, opts = {}) {
		const isNative = url.startsWith(URLS.api) || url.includes("/mobileconf/");
		const headers = {
			"User-Agent": isNative ? this.profile.apiUserAgent : this.profile.webUserAgent,
			"Accept-Language": "en-US,en;q=0.9"
		};
		if (isNative) headers.Accept = "application/json, text/plain, */*";
		else {
			headers.Accept = opts.responseType === "json" ? "application/json, text/plain, */*" : BROWSER_ACCEPT$1;
			if (method !== "GET") {
				headers.Origin = URLS.community;
				if (opts.referer) headers.Referer = opts.referer;
			}
		}
		let body;
		if (opts.multipart) {
			const boundary = `----steamMobile${randomSessionId()}`;
			body = buildMultipart(opts.multipart, boundary);
			headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
		} else if (opts.form) body = new URLSearchParams(clean(opts.form));
		else if (opts.json !== void 0) {
			body = JSON.stringify(opts.json);
			headers["Content-Type"] = "application/json";
		} else if (opts.body !== void 0) body = opts.body;
		Object.assign(headers, opts.headers);
		const target = new URL(url);
		const sp = clean(opts.searchParams);
		if (sp) for (const [k, v] of Object.entries(sp)) target.searchParams.set(k, v);
		try {
			const res = await (isNative ? this.nativeClient : isSteamHost(target.hostname) ? this.webClient : this.browserClient).fetch(target.toString(), {
				method,
				headers,
				...body !== void 0 ? { body } : {},
				...opts.signal ? { signal: opts.signal } : {},
				...opts.timeoutMs !== void 0 ? { timeout: opts.timeoutMs } : {}
			});
			const responseType = opts.responseType ?? "text";
			let parsed;
			if (responseType === "buffer") parsed = Buffer.from(await res.bytes());
			else if (responseType === "json") {
				const text = await res.text();
				parsed = text ? safeJsonParse(text) : void 0;
			} else parsed = await res.text();
			return {
				statusCode: res.status,
				headers: headersToRecord(res.headers),
				body: parsed
			};
		} catch (err) {
			throw this.wrapTransportError(err);
		}
	}
	wrapTransportError(err) {
		if (this.proxy && err instanceof Error && !isAbortError(err)) return new ProxyError(`proxy request failed: ${err.message}`, { cause: err });
		return err;
	}
	get(url, opts) {
		return this.request("GET", url, opts);
	}
	post(url, opts) {
		return this.request("POST", url, opts);
	}
	async setCookie(rawCookie) {
		for (const host of COOKIE_HOSTS) await this.jar.setCookie(rawCookie, host);
	}
	async getCookie(key, url = URLS.community) {
		return (await this.jar.getCookies(url)).find((c) => c.key === key)?.value;
	}
	async getSessionId() {
		const existing = (await this.jar.getCookies(URLS.community)).find((c) => c.key === "sessionid");
		if (existing) return existing.value;
		const sessionId = randomSessionId();
		await this.setCookie(`sessionid=${sessionId}`);
		return sessionId;
	}
};
function randomSessionId() {
	const bytes = /* @__PURE__ */ new Uint8Array(12);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function firstHeader(v) {
	return Array.isArray(v) ? v[0] : v;
}
const STEAM_HOSTS = ["steamcommunity.com", "steampowered.com"];
function isSteamHost(host) {
	const h = host.toLowerCase();
	return STEAM_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}
function headersToRecord(h) {
	const out = {};
	h.forEach((value, key) => {
		out[key] = value;
	});
	return out;
}
function safeJsonParse(text) {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
function isAbortError(err) {
	if (typeof err !== "object" || err === null) return false;
	const e = err;
	return e.name === "AbortError" || e.code === "ERR_ABORTED";
}
//#endregion
//#region src/auth/loginWithCredentials.ts
function loginWithCredentials(opts) {
	const profile = resolveMobileProfile(opts.mobileProfile);
	const session = new CredentialSession(new HttpClient({
		...opts.proxy ? { proxy: opts.proxy } : {},
		profile
	}), profile);
	return new Promise((resolve, reject) => {
		const { signal } = opts;
		const onAbort = () => {
			session.stop();
			reject(new LoginError("login aborted"));
		};
		const cleanup = () => signal?.removeEventListener("abort", onAbort);
		const fail = (err) => {
			session.stop();
			cleanup();
			reject(err);
		};
		if (signal?.aborted) {
			reject(new LoginError("login aborted"));
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		session.on("error", fail);
		session.on("timeout", () => fail(new LoginError("login timed out waiting for confirmation")));
		session.on("authenticated", () => {
			cleanup();
			if (!session.refreshToken || !session.steamID) {
				reject(new LoginError("login completed without a refresh token"));
				return;
			}
			resolve({
				refreshToken: session.refreshToken,
				accessToken: session.accessToken,
				steamId: session.steamID.getSteamID64(),
				username: session.username
			});
		});
		session.on("steamGuardRequired", (info) => {
			const handler = opts.onSteamGuardRequired;
			if (!handler) {
				fail(new LoginError(`${info.message}; pass sharedSecret, steamGuardCode, or onSteamGuardRequired`));
				return;
			}
			Promise.resolve(handler(info)).then((code) => session.submitSteamGuardCode(code)).catch((err) => fail(err instanceof Error ? err : new Error(String(err))));
		});
		session.start(opts).catch((err) => fail(err instanceof Error ? err : new Error(String(err))));
	});
}
//#endregion
//#region src/core/paginate.ts
async function paginate(fetchPage) {
	const all = [];
	let cursor;
	do {
		const { items, next } = await fetchPage(cursor);
		all.push(...items);
		cursor = next;
	} while (cursor !== void 0);
	return all;
}
//#endregion
//#region src/core/parseStrError.ts
function parseStrError(message) {
	const match = message.match(/\((\d+)\)$/);
	const eresult = match?.[1] !== void 0 ? Number(match[1]) : void 0;
	const opts = eresult !== void 0 ? { eresult } : void 0;
	if (/You cannot trade with .* because they have a trade ban\./.test(message)) return new TradeBanError(message);
	if (/sent too many trade offers/.test(message)) return new OfferLimitError(message);
	if (/You have logged in from a new device/.test(message)) return new NewDeviceError(message, opts);
	if (/is not available to trade\. More information will be shown to/.test(message)) return new TargetCannotTradeError(message, opts);
	if (/unable to contact the game's item server/.test(message)) return new ItemServerUnavailableError(message, { eresult: eresult ?? 20 });
	if (/inventory privacy is set to|inventory is (?:currently )?private|profile's inventory is private/i.test(message)) return new PrivateInventoryError(message);
	return new SteamError(message, opts);
}
//#endregion
//#region src/core/rateLimits.ts
const RATE_LIMITS = {
	partnerInventory: {
		type: "window",
		windowMs: 12e4,
		max: 30
	},
	inventory: null,
	GetTradeHistory: {
		type: "bucket",
		capacity: 25,
		refillMs: 15e3
	},
	GetTradeHoldDurations: {
		type: "bucket",
		capacity: 3750,
		refillMs: 5
	},
	GetTradeOffer: {
		type: "bucket",
		capacity: 3750,
		refillMs: 5
	},
	GetTradeOffers: {
		type: "bucket",
		capacity: 85,
		refillMs: 125
	},
	GetTradeOffersSummary: {
		type: "bucket",
		capacity: 85,
		refillMs: 125
	},
	GetTradeStatus: {
		type: "bucket",
		capacity: 25,
		refillMs: 2e3
	}
};
function retryAfterMs(limit) {
	if (!limit) return null;
	return limit.type === "bucket" ? limit.refillMs : limit.windowMs;
}
const RETRY_AFTER = Object.fromEntries(Object.entries(RATE_LIMITS).map(([key, limit]) => [key, retryAfterMs(limit)]));
//#endregion
//#region src/http/checkers.ts
function locationHeader(res) {
	const loc = res.headers.location;
	return Array.isArray(loc) ? loc[0] ?? "" : loc ?? "";
}
function httpError(res, rateLimitWindowMs) {
	if (res.statusCode === 429) return new RateLimitError({
		statusCode: 429,
		body: res.body,
		...typeof rateLimitWindowMs === "number" ? { retryAfterMs: rateLimitWindowMs } : {}
	});
	if (res.statusCode === 401) return new SteamSessionExpiredError();
	if (res.statusCode >= 300 && res.statusCode <= 399) {
		const loc = locationHeader(res);
		if (loc.includes("/login")) return new SteamSessionExpiredError();
		if (loc.includes("eligibilitycheck")) return new SteamError("Steam redirected to the market eligibility check — this account is limited / not trade-eligible");
	}
	return new HttpStatusError(res.statusCode, void 0, res.body);
}
function checkCommunityError(html) {
	if (typeof html !== "string") return;
	if (html.match(/<h1>Sorry!<\/h1>/)) throw new SteamError(html.match(/<h3>(.+)<\/h3>/)?.[1] ?? "Unknown error occurred");
	if (html.includes("g_steamID = false;") && html.includes("<title>Sign In</title>")) throw new SteamSessionExpiredError();
}
//#endregion
//#region src/http/tradePageError.ts
async function fetchTradePageErrorMessage(http, steamId, token) {
	const accountId = new SteamID(steamId).accountid;
	const url = `${URLS.community}/tradeoffer/new/?partner=${accountId}${token ? `&token=${token}` : ""}`;
	const res = await http.get(url, {
		responseType: "text",
		headers: { Referer: `${URLS.community}/profiles/${steamId}` }
	});
	if (res.statusCode !== 200) return void 0;
	return res.body.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/)?.[1]?.replace(/\s+/g, " ").trim() || void 0;
}
async function inventoryFailureError(http, steamId, token, bodyMessage) {
	return parseStrError(await fetchTradePageErrorMessage(http, steamId, token).catch(() => void 0) ?? bodyMessage ?? "Failed to load inventory");
}
//#endregion
//#region src/models/EconItem.ts
function toBool(value) {
	return typeof value === "boolean" ? value : Number(value ?? 0) !== 0;
}
function toInt(value) {
	return value ? Number.parseInt(String(value), 10) : 0;
}
function asRecord(value) {
	return value && !Array.isArray(value) ? value : {};
}
function buildDescriptionMap(descriptions) {
	const map = /* @__PURE__ */ new Map();
	for (const d of descriptions ?? []) map.set(`${d.appid}_${d.classid}_${d.instanceid ?? "0"}`, d);
	return map;
}
function buildItem(asset, description, properties, fallbackContextId) {
	return {
		...asset,
		...description,
		appid: Number(asset.appid ?? description?.appid ?? 0),
		contextid: (asset.contextid ?? fallbackContextId).toString(),
		assetid: (asset.assetid ?? asset.id ?? "").toString(),
		classid: asset.classid.toString(),
		instanceid: (asset.instanceid ?? "0").toString(),
		amount: toInt(asset.amount),
		...asset.currencyid ? { currencyid: asset.currencyid } : {},
		name: description?.name ?? "",
		market_name: description?.market_name ?? "",
		market_hash_name: description?.market_hash_name ?? "",
		type: description?.type ?? "",
		icon_url: description?.icon_url ?? "",
		tradable: toBool(description?.tradable),
		marketable: toBool(description?.marketable),
		commodity: toBool(description?.commodity),
		market_tradable_restriction: toInt(description?.market_tradable_restriction),
		market_marketable_restriction: toInt(description?.market_marketable_restriction),
		descriptions: description?.descriptions ?? [],
		owner_descriptions: description?.owner_descriptions ?? [],
		actions: description?.actions ?? [],
		market_actions: description?.market_actions ?? [],
		fraudwarnings: description?.fraudwarnings ?? [],
		tags: description?.tags ?? [],
		asset_properties: properties
	};
}
function parseInventory(body, contextid, tradableOnly = false) {
	const descriptions = /* @__PURE__ */ new Map();
	for (const d of body.descriptions ?? []) descriptions.set(`${d.classid}_${d.instanceid ?? "0"}`, d);
	const properties = /* @__PURE__ */ new Map();
	for (const p of body.asset_properties ?? []) properties.set(p.assetid, p.asset_properties);
	const items = [];
	for (const asset of body.assets ?? []) {
		const assetid = (asset.assetid ?? asset.id ?? "").toString();
		const description = descriptions.get(`${asset.classid}_${asset.instanceid ?? "0"}`);
		if (tradableOnly && !toBool(description?.tradable)) continue;
		items.push(buildItem(asset, description, properties.get(assetid) ?? [], contextid));
	}
	return items;
}
function parsePartnerInventory(body, contextid, tradableOnly = false) {
	const inventory = asRecord(body.rgInventory);
	const descriptions = asRecord(body.rgDescriptions);
	const properties = asRecord(body.rgAssetProperties);
	const assets = Object.values(inventory).sort((a, b) => Number(a.pos ?? 0) - Number(b.pos ?? 0));
	const items = [];
	for (const asset of assets) {
		const description = descriptions[`${asset.classid}_${asset.instanceid ?? "0"}`];
		if (tradableOnly && !toBool(description?.tradable)) continue;
		const assetid = (asset.assetid ?? asset.id ?? "").toString();
		items.push(buildItem(asset, description, properties[assetid] ?? [], contextid));
	}
	return items;
}
//#endregion
//#region src/community/openid.ts
const STEAM_OPENID_URL = `${URLS.community}/openid/login`;
const DEFAULT_MAX_REDIRECTS = 10;
const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
function locationOf(res) {
	const loc = res.headers.location;
	return (Array.isArray(loc) ? loc[0] : loc) || void 0;
}
function isRedirect(res) {
	return res.statusCode >= 300 && res.statusCode < 400 && locationOf(res) !== void 0;
}
function queryParams(url) {
	const out = {};
	for (const [k, v] of new URL(url).searchParams) out[k] = v;
	return out;
}
function decodeEntities$1(s) {
	return s.replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function parseOpenidForm(html) {
	const form = [...html.matchAll(/<form\b([^>]*?)>([\s\S]*?)<\/form>/gi)].find((m) => /openid\/login/i.test(m[1] ?? ""));
	const action = form?.[1]?.match(/\baction=["']([^"']+)["']/i)?.[1];
	if (!form || !action) return null;
	const fields = [];
	for (const tag of (form[2] ?? "").match(/<input\b[^>]*>/gi) ?? []) {
		const name = tag.match(/\bname=["']([^"']*)["']/i)?.[1];
		if (!name) continue;
		const value = decodeEntities$1(tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "");
		fields.push({
			name,
			value
		});
	}
	return {
		action: new URL(decodeEntities$1(action), STEAM_OPENID_URL).toString(),
		fields
	};
}
async function confirmOpenid(http, interstitialHtml, referer) {
	const form = parseOpenidForm(interstitialHtml);
	if (!form) throw new OpenIdError("no Steam OpenID form in the page; the web session is not authenticated");
	const res = await http.post(form.action, {
		multipart: form.fields,
		headers: { Accept: BROWSER_ACCEPT },
		...referer ? { referer } : {}
	});
	const location = isRedirect(res) ? locationOf(res) : void 0;
	if (!location) throw new OpenIdError(`Steam returned no OpenID assertion redirect (HTTP ${res.statusCode})`);
	const params = queryParams(location);
	const steamId = (params["openid.claimed_id"] ?? params["openid.identity"] ?? "").match(/\/id\/(\d{17})/)?.[1];
	if (!steamId) throw new OpenIdError("OpenID assertion carried no steamid");
	return {
		location,
		params,
		steamId
	};
}
async function steamOpenidLogin(http, options) {
	const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	await http.getSessionId();
	const get = (u) => http.get(u, { headers: { Accept: BROWSER_ACCEPT } });
	let url = options.initiateUrl;
	let res = await get(url);
	for (let i = 0; i < maxRedirects && isRedirect(res); i++) {
		url = new URL(locationOf(res), url).toString();
		res = await get(url);
	}
	const confirmation = await confirmOpenid(http, res.body, url);
	url = confirmation.location;
	res = await get(url);
	for (let i = 0; i < maxRedirects && isRedirect(res); i++) {
		url = new URL(locationOf(res), url).toString();
		res = await get(url);
	}
	const cookieHost = options.cookieHost ? `https://${options.cookieHost}` : new URL(url).origin;
	const cookies = (await http.jar.getCookies(cookieHost)).map((c) => ({
		name: c.key,
		value: c.value
	}));
	return {
		steamId: confirmation.steamId,
		finalUrl: url,
		cookies
	};
}
//#endregion
//#region src/community/tradeProtection.ts
async function acknowledgeTradeProtection(http) {
	const sessionid = await http.getSessionId();
	const res = await http.post(`${URLS.community}/trade/new/acknowledge`, { form: {
		sessionid,
		message: 1
	} });
	if (res.statusCode !== 200) throw httpError(res);
}
//#endregion
//#region src/community/CommunityNamespace.ts
const INVENTORY_PAGE_SIZE = 2e3;
var CommunityNamespace = class {
	http;
	session;
	confirmations;
	api;
	constructor(http, session, confirmations, api) {
		this.http = http;
		this.session = session;
		this.confirmations = confirmations;
		this.api = api;
	}
	acknowledgeTradeProtection() {
		return acknowledgeTradeProtection(this.http);
	}
	async getTradeURL() {
		await this.session.getAccessToken();
		const steamId = this.session.steamID.getSteamID64();
		const res = await this.http.get(`${URLS.community}/profiles/${steamId}/tradeoffers/privacy`, {
			responseType: "text",
			headers: { Referer: `${URLS.community}/profiles/${steamId}` }
		});
		if (res.statusCode !== 200) throw httpError(res);
		const html = res.body;
		checkCommunityError(html);
		const match = html.match(/https?:\/\/(?:www\.)?steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+(?:&|&amp;)token=([a-zA-Z0-9\-_]+)/);
		if (!match?.[1]) throw new SteamError("Failed to parse trade URL from the privacy page");
		return {
			url: match[0].replace(/&amp;/g, "&"),
			token: match[1]
		};
	}
	async changeTradeURL() {
		await this.session.getAccessToken();
		const steamId = this.session.steamID.getSteamID64();
		const sessionid = await this.http.getSessionId();
		const res = await this.http.post(`${URLS.community}/profiles/${steamId}/tradeoffers/newtradeurl`, {
			responseType: "json",
			form: { sessionid }
		});
		if (res.statusCode !== 200) throw httpError(res);
		const body = res.body;
		const token = typeof body === "string" ? body : String(body?.token ?? "");
		if (!token) throw new SteamError("Failed to parse the new trade token");
		const accountId = this.session.steamID.accountid;
		return {
			url: `${URLS.community}/tradeoffer/new/?partner=${accountId}&token=${token}`,
			token
		};
	}
	async getProfile(steamId) {
		await this.session.getAccessToken();
		const id = steamId ?? this.session.steamID.getSteamID64();
		const res = await this.http.get(`${URLS.community}/profiles/${id}?xml=1`, { responseType: "text" });
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
			privacyState: xmlValue(xml, "privacyState") ?? ""
		};
	}
	async getWebTradeEligibility() {
		await this.session.getAccessToken();
		const res = await this.http.get(`${URLS.community}/market/eligibilitycheck/`, {
			responseType: "text",
			headers: { Referer: `${URLS.community}/` }
		});
		if (res.statusCode >= 400) throw httpError(res);
		const raw = await this.http.getCookie("webTradeEligibility");
		if (!raw) throw new SteamError("Steam did not return a webTradeEligibility cookie");
		try {
			return JSON.parse(decodeURIComponent(raw));
		} catch {
			throw new SteamError("Failed to parse the webTradeEligibility cookie");
		}
	}
	async openidLogin(options) {
		await this.session.getAccessToken();
		return steamOpenidLogin(this.http, options);
	}
	async getSteamLevel(steamId) {
		const id = steamId ?? this.session.steamID.getSteamID64();
		return (await this.api.call({
			httpMethod: "GET",
			iface: "IPlayerService",
			method: "GetSteamLevel",
			input: { steamid: id }
		})).response?.player_level ?? 0;
	}
	async getTwoFactorStatus() {
		const body = await this.api.call({
			httpMethod: "POST",
			iface: "ITwoFactorService",
			method: "QueryStatus",
			input: { steamid: this.session.steamID.getSteamID64() }
		});
		if (!body.response) throw new SteamError("Malformed two-factor status response", { body });
		return body.response;
	}
	async ensureApiKey(domain = "assetpay.gg") {
		await this.session.getAccessToken();
		const res = await this.http.get(`${URLS.community}/dev/apikey?l=english`, { responseType: "text" });
		if (res.statusCode !== 200) throw httpError(res);
		const body = res.body;
		const key = body.match(/<p>Key:\s*([0-9A-F]+)<\/p>/i)?.[1];
		if (key) return key;
		if (/validated email address|Steam Guard Mobile Authenticator|<h2>Access Denied<\/h2>/i.test(body)) return null;
		return this.requestApiKey(domain);
	}
	async requestApiKey(domain, requestId = "0") {
		const sessionid = await this.http.getSessionId();
		const res = await this.http.post(`${URLS.community}/dev/requestkey`, {
			responseType: "json",
			form: {
				domain,
				request_id: requestId,
				sessionid,
				agreeToTerms: "true"
			}
		});
		if (res.statusCode !== 200) throw httpError(res);
		const body = res.body ?? {};
		if (body.api_key) return body.api_key;
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
	async getInventory(appid, contextid = "2", options = {}) {
		await this.session.getAccessToken();
		const ownId = this.session.steamID.getSteamID64();
		const steamId = options.steamId ?? ownId;
		const tradableOnly = options.tradableOnly ?? false;
		return steamId === ownId ? this.getOwnInventoryItems(steamId, appid, contextid, tradableOnly) : this.getTheirInventory(steamId, appid, contextid, tradableOnly);
	}
	getOwnInventoryItems(steamId, appid, contextid, tradableOnly) {
		const url = `${URLS.community}/profiles/${steamId}/inventory/json/${appid}/${contextid}`;
		return paginate(async (start) => {
			const res = await this.http.get(url, {
				responseType: "json",
				searchParams: {
					trading: tradableOnly ? 1 : 0,
					preserve_bbcode: 1,
					l: LANG.l,
					...start !== void 0 ? { start } : {}
				},
				headers: { Referer: `${URLS.community}/profiles/${steamId}/inventory` }
			});
			if (res.statusCode !== 200) throw httpError(res, RETRY_AFTER.inventory);
			const body = res.body;
			if (!body?.success) throw new SteamError(body?.error ?? body?.Error ?? "Malformed inventory response");
			const next = body.more && typeof body.more_start === "number" && body.more_start > (start ?? 0) ? body.more_start : void 0;
			return {
				items: parsePartnerInventory(body, contextid, tradableOnly),
				next
			};
		});
	}
	getTheirInventory(steamId, appid, contextid, tradableOnly) {
		const url = `${URLS.community}/inventory/${steamId}/${appid}/${contextid}`;
		return paginate(async (startAssetId) => {
			const res = await this.http.get(url, {
				responseType: "json",
				searchParams: {
					l: LANG.l,
					count: INVENTORY_PAGE_SIZE,
					raw_asset_properties: 1,
					preserve_bbcode: 1,
					start_assetid: startAssetId
				},
				headers: { Referer: `${URLS.community}/profiles/${steamId}/inventory` }
			});
			const body = res.body;
			if (res.statusCode === 403 && !body) throw await inventoryFailureError(this.http, steamId, void 0, "This profile is private.");
			if (res.statusCode === 500 && body?.error) throw parseStrError(body.error);
			if (res.statusCode !== 200) throw httpError(res, RETRY_AFTER.inventory);
			if (!body?.success) throw await inventoryFailureError(this.http, steamId, void 0, body?.error ?? body?.Error);
			if (!body.assets) return {
				items: [],
				next: void 0
			};
			return {
				items: parseInventory(body, contextid, tradableOnly),
				next: body.more_items && body.last_assetid ? body.last_assetid : void 0
			};
		});
	}
};
function xmlValue(xml, tag) {
	return xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1]?.trim() || void 0;
}
//#endregion
//#region src/http/queryTime.ts
async function queryServerTimeOffset(http) {
	const res = await http.post(`${URLS.api}/ITwoFactorService/QueryTime/v1/`, { responseType: "json" });
	if (res.statusCode !== 200) throw httpError(res);
	const serverTime = Number(res.body?.response?.server_time);
	if (!serverTime) throw new SteamError("Failed to query Steam server time");
	return serverTime - time();
}
//#endregion
//#region src/community/confirmations.ts
const TIME_OFFSET_TTL_MS = 432e5;
var ConfirmationManager = class {
	http;
	steamID;
	identitySecret;
	profile;
	timeOffset;
	timeOffsetAt = 0;
	usedConfTimes = [];
	constructor(http, steamID, identitySecret, profile) {
		this.http = http;
		this.steamID = steamID;
		this.identitySecret = identitySecret;
		this.profile = profile;
	}
	get hasIdentitySecret() {
		return Boolean(this.identitySecret);
	}
	deviceId() {
		const android = getDeviceID(this.steamID.getSteamID64());
		return this.profile.mobileClient === "ios" ? android.replace(/^android:/, "").toUpperCase() : android;
	}
	async getConfirmations(time, key) {
		const { tag, k } = splitKey(key, "conf");
		const body = await this.getlist(k, time, tag);
		if (!body?.success) {
			if (body?.needauth) throw new SteamSessionExpiredError();
			throw new ConfirmationError(String(body?.message ?? body?.detail ?? "Failed to get confirmation list"));
		}
		return (body.conf ?? []).map((c) => ({
			id: String(c.id),
			type: Number(c.type),
			creator: String(c.creator_id),
			key: String(c.nonce),
			title: `${c.type_name ?? "Confirm"} - ${c.headline ?? ""}`,
			receiving: Number(c.type) === 2 ? String(c.summary?.[1] ?? "") : "",
			sending: String(c.summary?.[0] ?? ""),
			time: (/* @__PURE__ */ new Date(Number(c.creation_time) * 1e3)).toISOString(),
			timestamp: /* @__PURE__ */ new Date(Number(c.creation_time) * 1e3),
			icon: String(c.icon ?? "")
		}));
	}
	async respondToConfirmation(confID, confKey, time, key, accept) {
		const ids = Array.isArray(confID) ? confID : [confID];
		const keys = Array.isArray(confKey) ? confKey : [confKey];
		if (ids.length !== keys.length) throw new ConfirmationError("confID and confKey must have the same length");
		const { tag, k } = splitKey(key, accept ? "allow" : "cancel");
		const op = accept ? "allow" : "cancel";
		const res = await this.http.post(`${URLS.community}/mobileconf/multiajaxop`, {
			responseType: "json",
			searchParams: {
				...this.confParams(k, time, tag),
				op
			},
			multipart: ids.flatMap((id, i) => [{
				name: "cid[]",
				value: id
			}, {
				name: "ck[]",
				value: keys[i]
			}])
		});
		if (res.statusCode !== 200) throw httpError(res);
		if (res.body?.success) return;
		throw new ConfirmationError(String(res.body?.message ?? "Could not act on confirmation"));
	}
	async getPending() {
		const secret = this.requireSecret();
		const listTime = time(await this.getTimeOffset());
		const listKey = getConfirmationKey(secret, listTime, "list");
		return this.getConfirmations(listTime, {
			tag: "list",
			key: listKey
		});
	}
	acceptConfirmation(confID, nonce) {
		return this.actOnConfirmations([{
			id: confID,
			key: nonce
		}], true);
	}
	rejectConfirmation(confID, nonce) {
		return this.actOnConfirmations([{
			id: confID,
			key: nonce
		}], false);
	}
	acceptConfirmations(confs) {
		return this.actOnConfirmations(confs, true);
	}
	rejectConfirmations(confs) {
		return this.actOnConfirmations(confs, false);
	}
	async acceptAll() {
		const pending = await this.getPending();
		for (const c of pending) await this.acceptConfirmation(c.id, c.key);
		return pending;
	}
	async acceptConfirmationForObject(objectID) {
		const conf = (await this.getPending()).find((c) => c.creator === String(objectID));
		if (!conf) throw new ConfirmationError(`Could not find confirmation for object ${objectID}`);
		await this.acceptConfirmation(conf.id, conf.key);
	}
	async actOnConfirmations(confs, accept) {
		if (confs.length === 0) return;
		const secret = this.requireSecret();
		const offset = await this.getTimeOffset();
		const time = this.nextConfTime(offset);
		const tag = accept ? "accept" : "cancel";
		const key = getConfirmationKey(secret, time, tag);
		await this.respondToConfirmation(confs.map((c) => c.id), confs.map((c) => c.key), time, {
			tag,
			key
		}, accept);
	}
	requireSecret() {
		if (!this.identitySecret) throw new ConfirmationError("identitySecret is required to respond to confirmations");
		return this.identitySecret;
	}
	nextConfTime(offset) {
		let time$1 = time(offset);
		let localOffset = 0;
		while (this.usedConfTimes.includes(time$1)) time$1 = time(offset) + ++localOffset;
		this.usedConfTimes.push(time$1);
		if (this.usedConfTimes.length > 60) this.usedConfTimes.splice(0, this.usedConfTimes.length - 60);
		return time$1;
	}
	async getTimeOffset() {
		if (this.timeOffset !== void 0 && Date.now() - this.timeOffsetAt < TIME_OFFSET_TTL_MS) return this.timeOffset;
		const offset = await queryServerTimeOffset(this.http);
		this.timeOffset = offset;
		this.timeOffsetAt = Date.now();
		return offset;
	}
	confParams(key, time, tag) {
		return {
			p: this.deviceId(),
			a: this.steamID.getSteamID64(),
			k: key,
			t: time,
			m: "react",
			tag
		};
	}
	async getlist(key, time, tag) {
		const res = await this.http.get(`${URLS.community}/mobileconf/getlist`, {
			responseType: "json",
			searchParams: this.confParams(key, time, tag)
		});
		if (res.statusCode !== 200) throw httpError(res);
		return res.body;
	}
};
function splitKey(key, fallbackTag) {
	return typeof key === "object" ? {
		tag: key.tag,
		k: key.key
	} : {
		tag: fallbackTag,
		k: key
	};
}
//#endregion
//#region src/core/offerState.ts
const NON_TERMINAL = /* @__PURE__ */ new Set([
	2,
	9,
	11
]);
function isTerminalState(state) {
	return !NON_TERMINAL.has(state);
}
//#endregion
//#region src/core/target.ts
function resolveTarget(target) {
	if ("tradeUrl" in target && target.tradeUrl) {
		const params = new URL(target.tradeUrl).searchParams;
		const partner = params.get("partner");
		if (!partner) throw new SteamError("invalid trade URL: missing partner");
		const accountId = Number(partner);
		if (!Number.isInteger(accountId) || accountId <= 0) throw new SteamError(`invalid trade URL: non-numeric partner '${partner}'`);
		return {
			steamId: SteamID.fromIndividualAccountID(accountId).getSteamID64(),
			token: params.get("token") ?? void 0
		};
	}
	if ("steamId" in target && target.steamId) return {
		steamId: target.steamId,
		token: target.token
	};
	throw new SteamError("invalid target: provide tradeUrl or steamId");
}
//#endregion
//#region src/http/webApi.ts
var WebApiClient = class {
	http;
	getAccessToken;
	constructor(http, getAccessToken) {
		this.http = http;
		this.getAccessToken = getAccessToken;
	}
	async call(params) {
		const { httpMethod, iface, method, version = 1, input = {}, retryAfterMs = null } = params;
		const accessToken = await this.getAccessToken();
		const url = `${URLS.api}/${iface}/${method}/v${version}/`;
		const payload = {
			origin: "SteamMobile",
			...input,
			access_token: accessToken
		};
		if (process.env.DEBUG_HTTP === "1") {
			const qs = new URLSearchParams(Object.entries(payload).filter(([, v]) => v !== void 0).map(([k, v]) => [k, String(v)]));
			console.log(`[http] ${httpMethod} ${url}?${qs.toString()}`);
		}
		const res = await this.http.request(httpMethod, url, {
			responseType: "json",
			...httpMethod === "GET" ? { searchParams: payload } : { form: payload }
		});
		if (res.statusCode !== 200) throw httpError(res, retryAfterMs);
		const header = res.headers["x-eresult"];
		let eresult = Array.isArray(header) ? header[0] : header;
		const errorMessage = headerValue(res.headers["x-error_message"]);
		const body = res.body;
		const responseObj = body && typeof body === "object" ? body.response : void 0;
		if (eresult === "2" && body && (Object.keys(body).length > 1 || responseObj && Object.keys(responseObj).length > 0)) eresult = "1";
		if (eresult !== void 0 && eresult !== "1") {
			const code = Number(eresult);
			const msg = `${EResult[code] ?? "EResult"} (${eresult})${errorMessage ? `: ${errorMessage}` : ""}`;
			if (code === 21) throw new SteamSessionExpiredError(msg);
			if (code === 84) throw new RateLimitError({
				message: msg,
				body,
				eresult: 84,
				...typeof retryAfterMs === "number" ? { retryAfterMs } : {}
			});
			throw new SteamError(msg, {
				eresult: code,
				body
			});
		}
		if (!body || typeof body !== "object") throw new SteamError("Invalid API response", { body });
		return body;
	}
};
function headerValue(v) {
	return Array.isArray(v) ? v[0] : v;
}
//#endregion
//#region src/keyApi/SteamWebApi.ts
const GET_PLAYER_BANS_BATCH = 100;
const GET_PLAYER_SUMMARIES_BATCH = 100;
var SteamWebApi = class {
	http;
	apiKey;
	constructor(options) {
		this.apiKey = options.apiKey;
		this.http = options.http ?? new HttpClient({
			...options.proxy ? { proxy: options.proxy } : {},
			profile: resolveMobileProfile()
		});
	}
	async getPlayerBans(steamIds) {
		if (steamIds.length === 0) return [];
		const out = [];
		for (let i = 0; i < steamIds.length; i += GET_PLAYER_BANS_BATCH) {
			const chunk = steamIds.slice(i, i + GET_PLAYER_BANS_BATCH);
			const res = await this.http.get(`${URLS.api}/ISteamUser/GetPlayerBans/v1/`, {
				responseType: "json",
				searchParams: {
					key: this.apiKey,
					steamids: chunk.join(",")
				}
			});
			if (res.statusCode !== 200) throw httpError(res);
			const players = res.body?.players;
			if (!Array.isArray(players)) throw new SteamError("Invalid GetPlayerBans response", { body: res.body });
			out.push(...players);
		}
		return out;
	}
	async getPlayerSummaries(steamIds) {
		if (steamIds.length === 0) return [];
		const out = [];
		for (let i = 0; i < steamIds.length; i += GET_PLAYER_SUMMARIES_BATCH) {
			const chunk = steamIds.slice(i, i + GET_PLAYER_SUMMARIES_BATCH);
			const res = await this.http.get(`${URLS.api}/ISteamUser/GetPlayerSummaries/v2/`, {
				responseType: "json",
				searchParams: {
					key: this.apiKey,
					steamids: chunk.join(",")
				}
			});
			if (res.statusCode !== 200) throw httpError(res);
			const players = res.body?.response?.players;
			if (!Array.isArray(players)) throw new SteamError("Invalid GetPlayerSummaries response", { body: res.body });
			out.push(...players);
		}
		return out;
	}
	async getBadges(steamId) {
		const res = await this.http.get(`${URLS.api}/IPlayerService/GetBadges/v1/`, {
			responseType: "json",
			searchParams: {
				key: this.apiKey,
				steamid: steamId
			}
		});
		if (res.statusCode !== 200) throw httpError(res);
		const response = res.body?.response;
		if (!response || !Array.isArray(response.badges)) throw new SteamError("Invalid GetBadges response", { body: res.body });
		return response;
	}
};
//#endregion
//#region src/market/prices.ts
function getPriceValueAsInt(strAmount) {
	if (!strAmount) return 0;
	let amount = String(strAmount);
	amount = amount.replace(/,/g, ".");
	amount = amount.replace(".--", ".00");
	amount = amount.replace(/[^\d.]/g, "");
	if (amount.indexOf(".") !== -1) {
		const segments = amount.split(".");
		const last = segments[segments.length - 1] ?? "";
		if (!Number.isNaN(Number(last)) && last.length === 3 && segments[segments.length - 2] !== "0") amount = segments.join("");
		else amount = `${segments.slice(0, -1).join("")}.${last}`;
	}
	const cents = Number.parseFloat(amount) * 100;
	return Math.max(Math.floor(Number.isNaN(cents) ? 0 : cents + 1e-6), 0);
}
//#endregion
//#region src/market/history.ts
function parseMarketHistory(body) {
	const history = {
		events: [],
		sales: [],
		purchases: [],
		listingEvents: [],
		totalCount: body.total_count
	};
	if (!body.results_html) return history;
	const hovers = body.hovers ?? "";
	const assets = body.assets ?? {};
	const html = body.results_html.replace(/<!--[\s\S]*?-->/g, "");
	for (const row of findByClass(html, "market_listing_row", "market_recent_listing_row")) {
		const dates = findByClass(row.inner, "market_listing_listed_date");
		const itemName = textOf(row.inner, "market_listing_item_name");
		const gameName = textOf(row.inner, "market_listing_game_name");
		const actedOn = dates[0] ? elementText(dates[0]).trim() : "";
		const listedOn = dates[1] ? elementText(dates[1]).trim() : "";
		const displayPrice = textOf(row.inner, "market_listing_price").trim();
		const rowId = attrValue(row.attrs, "id") ?? "";
		const priceInCents = getPriceValueAsInt(displayPrice);
		if (priceInCents === 0 && displayPrice) throw new SteamError(`Market history price parsed to 0 cents for "${displayPrice}" in row ${rowId || "?"}`);
		const gainOrLoss = textOf(row.inner, "market_listing_gainorloss").trim();
		const type = gainOrLoss === "-" ? "sale" : gainOrLoss === "+" ? "purchase" : "listing_event";
		const idMatch = rowId.match(/^history_row_(\d+)_(\d+)$/);
		if (!idMatch) continue;
		const event = {
			historyId: rowId,
			listingid: idMatch[1],
			eventid: idMatch[2],
			itemName,
			gameName,
			listedOn,
			actedOn,
			displayPrice,
			priceInCents,
			type,
			marketName: null,
			appID: null,
			contextID: null,
			assetID: null,
			classID: null,
			instanceID: null,
			unOwnedContextID: null,
			unOwnedID: null
		};
		if (type !== "listing_event") attachAsset(event, rowId, hovers, assets);
		if (type === "sale") {
			const sale = {
				...event,
				type,
				receivedAmount: priceInCents
			};
			history.sales.push(sale);
			history.events.push(sale);
		} else if (type === "purchase") {
			const purchase = {
				...event,
				type,
				paidAmount: priceInCents
			};
			history.purchases.push(purchase);
			history.events.push(purchase);
		} else {
			const listingEvent = {
				...event,
				type
			};
			history.listingEvents.push(listingEvent);
			history.events.push(listingEvent);
		}
	}
	return history;
}
function attachAsset(event, rowId, hovers, assets) {
	try {
		const args = hovers.split(`${rowId}_name`)[1].split(")")[0].split(",");
		event.appID = Number.parseInt(args[1], 10);
		event.contextID = args[2].split("'")[1] ?? null;
		event.assetID = args[3].split("'")[1] ?? null;
		if (event.contextID === null || event.assetID === null) return;
		const asset = assets[String(event.appID)]?.[event.contextID]?.[event.assetID];
		if (asset) {
			event.classID = asset.classid ?? null;
			event.instanceID = asset.instanceid ?? null;
			event.unOwnedContextID = asset.unowned_contextid ?? null;
			event.unOwnedID = asset.unowned_id ?? null;
			event.marketName = asset.market_hash_name ?? null;
		}
	} catch {}
}
const TAG = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const VOID_TAGS = /* @__PURE__ */ new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr"
]);
function findByClass(html, ...classes) {
	const found = [];
	for (const m of html.matchAll(TAG)) {
		const attrs = m[2] ?? "";
		const tokens = (attrValue(attrs, "class") ?? "").split(/\s+/);
		if (!classes.every((c) => tokens.includes(c))) continue;
		const tag = m[1].toLowerCase();
		const start = m.index + m[0].length;
		const empty = VOID_TAGS.has(tag) || attrs.trimEnd().endsWith("/");
		found.push({
			attrs,
			inner: empty ? "" : html.slice(start, closeIndex(html, tag, start))
		});
	}
	return found;
}
function closeIndex(html, tag, from) {
	const re = new RegExp(`<(/?)${tag}\\b((?:"[^"]*"|'[^']*'|[^'">])*)>`, "gi");
	re.lastIndex = from;
	let depth = 1;
	for (let m = re.exec(html); m; m = re.exec(html)) if (m[1]) {
		if (--depth === 0) return m.index;
	} else if (!(m[2] ?? "").trimEnd().endsWith("/")) depth++;
	return html.length;
}
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function attrValue(attrs, name) {
	for (const m of attrs.matchAll(ATTR)) if (m[1].toLowerCase() === name) return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
}
function textOf(html, className) {
	return findByClass(html, className).map(elementText).join("");
}
function elementText(el) {
	return decodeEntities(el.inner.replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, ""));
}
const NAMED_ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: "\xA0"
};
function decodeEntities(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref) => {
		if (ref[0] === "#") {
			const code = ref[1] === "x" || ref[1] === "X" ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
			return code <= 1114111 ? String.fromCodePoint(code) : whole;
		}
		return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
	});
}
//#endregion
//#region src/market/MarketNamespace.ts
const LISTINGS_PAGE_SIZE = 100;
const MARKET_REFERER = `${URLS.community}/market/`;
var MarketNamespace = class {
	http;
	session;
	confirmations;
	api;
	walletCurrency;
	constructor(http, session, confirmations, api) {
		this.http = http;
		this.session = session;
		this.confirmations = confirmations;
		this.api = api;
	}
	async getWalletDetails() {
		const body = await this.api.call({
			httpMethod: "POST",
			iface: "IUserAccountService",
			method: "GetClientWalletDetails",
			input: {
				include_balance_in_usd: 1,
				include_formatted_balance: 1
			}
		});
		if (!body.response) throw new SteamError("Malformed wallet details response", { body });
		const currency = body.response.currency_code;
		if (typeof currency === "number" && currency > 0) this.walletCurrency = currency;
		return body.response;
	}
	async getMyListings(options = {}) {
		await this.session.getAccessToken();
		const result = {
			listings: [],
			listings_to_confirm: [],
			buy_orders: [],
			num_active_listings: 0
		};
		let start = 0;
		for (;;) {
			const res = await this.http.get(`${URLS.community}/market/mylistings/`, {
				responseType: "json",
				searchParams: {
					norender: 1,
					currency: options.currency ?? this.walletCurrency,
					start,
					count: LISTINGS_PAGE_SIZE
				}
			});
			if (res.statusCode !== 200) throw httpError(res);
			const body = res.body;
			if (!body?.success) throw new SteamError("Steam returned success=false for /market/mylistings", { body });
			if (body.num_active_listings !== void 0) result.num_active_listings = body.num_active_listings;
			if (start === 0) {
				if (Array.isArray(body.buy_orders)) result.buy_orders = body.buy_orders;
				if (Array.isArray(body.listings_to_confirm)) result.listings_to_confirm = body.listings_to_confirm;
			}
			const page = body.listings ?? body.results?.listings ?? [];
			result.listings.push(...page);
			start += page.length;
			if (start >= result.num_active_listings || page.length === 0) return result;
		}
	}
	async getMyHistory(options = {}) {
		await this.session.getAccessToken();
		const res = await this.http.get(`${URLS.community}/market/myhistory`, {
			responseType: "json",
			searchParams: {
				count: options.count ?? 500,
				start: options.start
			}
		});
		if (res.statusCode !== 200) throw httpError(res);
		if (!res.body?.success) throw new SteamError("Steam returned success=false for /market/myhistory", { body: res.body });
		return parseMarketHistory(res.body);
	}
	async getOrderbook(appid, marketHashName, options = {}) {
		await this.session.getAccessToken();
		const qp = encodeURIComponent(JSON.stringify([appid, marketHashName]));
		const res = await this.http.get(`${URLS.community}/market/orderbook?q=Load&qp=${qp}`, { responseType: "json" });
		if (res.statusCode === 403) throw new ThrottledError(void 0, { body: res.body });
		if (res.statusCode !== 200) throw httpError(res);
		const body = res.body;
		const payload = body && body.success === void 0 && body.data ? body.data : body;
		if (!payload?.success || !payload.data) throw new SteamError(`Bad orderbook response for ${marketHashName}`, { body });
		const data = payload.data;
		const expected = options.expectedCurrency ?? this.walletCurrency;
		if (expected && data.eCurrency !== expected) throw new SteamError(`Orderbook currency ${data.eCurrency} != expected ${expected} for ${marketHashName}`, { body });
		return data;
	}
	async getPriceHistory(appid, marketHashName) {
		await this.session.getAccessToken();
		const res = await this.http.get(`${URLS.community}/market/pricehistory?appid=${appid}&market_hash_name=${encodeURIComponent(marketHashName)}`, { responseType: "json" });
		if (res.statusCode !== 200) throw httpError(res);
		if (!res.body?.success) throw new SteamError(`Steam returned success=false for pricehistory of ${marketHashName}`, { body: res.body });
		return Array.isArray(res.body.prices) ? res.body.prices : [];
	}
	async getMarketItemDetails(appid, marketHashName) {
		await this.session.getAccessToken();
		const query = encodeURIComponent(`"${marketHashName}"`);
		const res = await this.http.get(`${URLS.community}/market/search/render/?query=${query}&start=0&count=10&search_descriptions=0&sort_column=quantity&sort_dir=desc&appid=${appid}&norender=1`, { responseType: "json" });
		if (res.statusCode !== 200) throw httpError(res);
		const body = res.body;
		if (!body || typeof body !== "object") throw new SteamError("Malformed market search response", { body });
		return (Array.isArray(body.results) ? body.results : []).find((r) => r.hash_name === marketHashName) ?? null;
	}
	async sellItem(options) {
		await this.session.getAccessToken();
		const sessionid = await this.http.getSessionId();
		const res = await this.http.post(`${URLS.community}/market/sellitem/`, {
			responseType: "json",
			form: {
				sessionid,
				appid: options.appid,
				contextid: options.contextid ?? "2",
				assetid: options.assetid,
				amount: options.amount ?? 1,
				price: options.price
			},
			headers: { Referer: MARKET_REFERER }
		});
		const body = res.body;
		if (res.statusCode === 200 && (body?.success === true || body?.success === 1)) return body;
		if (res.statusCode === 429 || res.statusCode === 401) throw httpError(res);
		if (body?.message) throw sellItemError(body.message, body);
		if (res.statusCode !== 200) throw httpError(res);
		throw new SteamError("Unknown error listing item", {
			...eresultOf(body),
			body
		});
	}
	async cancelListing(listingId) {
		await this.session.getAccessToken();
		const sessionid = await this.http.getSessionId();
		const res = await this.http.post(`${URLS.community}/market/removelisting/${listingId}`, {
			form: { sessionid },
			headers: { Referer: MARKET_REFERER }
		});
		if (res.statusCode === 200 || res.statusCode === 302 && redirectsToMarket(res)) return;
		throw httpError(res);
	}
	async createBuyOrder(options) {
		const currency = options.currency ?? this.walletCurrency;
		if (!currency) throw new SteamError("Wallet currency unknown — call getWalletDetails() or pass currency");
		await this.session.getAccessToken();
		const sessionid = await this.http.getSessionId();
		const referer = `${URLS.community}/market/listings/${options.appid}/${encodeURIComponent(options.marketHashName)}`;
		const form = {
			sessionid,
			currency,
			appid: options.appid,
			market_hash_name: options.marketHashName,
			price_total: options.priceTotal,
			quantity: options.quantity,
			confirmation: 0
		};
		const first = await this.postBuyOrder(form, referer);
		const direct = buyOrderId(first);
		if (direct) return direct;
		const confirmationId = first.body?.confirmation?.confirmation_id;
		if (!confirmationId) throw buyOrderError(first, `No confirmation_id (HTTP ${first.statusCode})`);
		await this.confirmations.acceptConfirmationForObject(String(confirmationId));
		const final = await this.postBuyOrder({
			...form,
			confirmation: String(confirmationId)
		}, referer);
		const orderId = buyOrderId(final);
		if (orderId) return orderId;
		throw buyOrderError(final, `Finalization failed (HTTP ${final.statusCode})`);
	}
	async cancelBuyOrder(buyOrderId) {
		await this.session.getAccessToken();
		const sessionid = await this.http.getSessionId();
		const res = await this.http.post(`${URLS.community}/market/cancelbuyorder/`, {
			responseType: "json",
			form: {
				sessionid,
				buy_orderid: buyOrderId
			},
			headers: { Referer: MARKET_REFERER }
		});
		if (res.statusCode !== 200) throw httpError(res);
		return res.body ?? {};
	}
	async confirmListings(expected) {
		if (Object.values(expected).reduce((sum, n) => sum + n, 0) === 0) return {
			confirmed: [],
			skipped: []
		};
		await this.session.getAccessToken();
		const listings = (await this.confirmations.getPending()).filter((c) => c.type === 3).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		const remaining = { ...expected };
		const confirmed = [];
		const skipped = [];
		for (const conf of listings) {
			const name = (remaining[conf.sending] ?? 0) > 0 ? conf.sending : Object.keys(remaining).find((n) => (remaining[n] ?? 0) > 0 && conf.sending !== "" && n.includes(conf.sending));
			if (name === void 0) {
				skipped.push(conf);
				continue;
			}
			confirmed.push(conf);
			remaining[name] = (remaining[name] ?? 0) - 1;
		}
		await this.confirmations.acceptConfirmations(confirmed);
		return {
			confirmed,
			skipped
		};
	}
	async rejectListings(types = [3]) {
		await this.session.getAccessToken();
		const matched = (await this.confirmations.getPending()).filter((c) => types.includes(c.type));
		await this.confirmations.rejectConfirmations(matched);
		return matched;
	}
	async postBuyOrder(form, referer) {
		const res = await this.http.post(`${URLS.community}/market/createbuyorder/`, {
			responseType: "json",
			form,
			headers: { Referer: referer }
		});
		if (res.statusCode === 429 || res.statusCode === 401) throw httpError(res);
		return res;
	}
};
function redirectsToMarket(res) {
	const location = res.headers.location;
	if (typeof location !== "string" || !URL.canParse(location, URLS.community)) return false;
	const { pathname } = new URL(location, URLS.community);
	return pathname === "/market/" || pathname === "/market";
}
function eresultOf(body) {
	const success = body?.success;
	return typeof success === "number" && success !== 1 ? { eresult: success } : {};
}
function sellItemError(message, body) {
	const options = {
		...eresultOf(body),
		body
	};
	const lower = message.toLowerCase();
	if (lower.includes("pending confirmation")) return new MarketConfirmationLimitError(message, options);
	if (lower.includes("maximum wallet balance")) return new WalletBalanceLimitError(message, options);
	if (lower.includes("unable to use the community market")) return new MarketBlockedError(message, options);
	return new SteamError(message, options);
}
function buyOrderId(res) {
	const body = res.body;
	const ok = body?.success === 1 || body?.success === true || body?.wallet_info?.success === 1;
	return res.statusCode === 200 && ok && body?.buy_orderid ? String(body.buy_orderid) : void 0;
}
function buyOrderError(res, fallback) {
	const body = res.body;
	const eresult = eresultOf(body);
	if (!body?.message && eresult.eresult === void 0 && ![200, 406].includes(res.statusCode)) return httpError(res);
	return new SteamError(body?.message || fallback, {
		...eresult,
		body
	});
}
/**
* Describes the message CEconItemPreviewDataBlock.
* Use `create(CEconItemPreviewDataBlockSchema)` to create a new message.
*/
const CEconItemPreviewDataBlockSchema = /*@__PURE__*/ messageDesc(/* @__PURE__ */ fileDesc("Chdjc2dvX2Vjb25fcHJldmlldy5wcm90byL8CgoZQ0Vjb25JdGVtUHJldmlld0RhdGFCbG9jaxIWCglhY2NvdW50aWQYASABKA1IAIgBARITCgZpdGVtaWQYAiABKARIAYgBARIVCghkZWZpbmRleBgDIAEoDUgCiAEBEhcKCnBhaW50aW5kZXgYBCABKA1IA4gBARITCgZyYXJpdHkYBSABKA1IBIgBARIUCgdxdWFsaXR5GAYgASgNSAWIAQESFgoJcGFpbnR3ZWFyGAcgASgNSAaIAQESFgoJcGFpbnRzZWVkGAggASgNSAeIAQESHwoSa2lsbGVhdGVyc2NvcmV0eXBlGAkgASgNSAiIAQESGwoOa2lsbGVhdGVydmFsdWUYCiABKA1ICYgBARIXCgpjdXN0b21uYW1lGAsgASgJSAqIAQESNAoIc3RpY2tlcnMYDCADKAsyIi5DRWNvbkl0ZW1QcmV2aWV3RGF0YUJsb2NrLlN0aWNrZXISFgoJaW52ZW50b3J5GA0gASgNSAuIAQESEwoGb3JpZ2luGA4gASgNSAyIAQESFAoHcXVlc3RpZBgPIAEoDUgNiAEBEhcKCmRyb3ByZWFzb24YECABKA1IDogBARIXCgptdXNpY2luZGV4GBEgASgNSA+IAQESFQoIZW50aW5kZXgYEiABKAVIEIgBARIVCghwZXRpbmRleBgTIAEoDUgRiAEBEjUKCWtleWNoYWlucxgUIAMoCzIiLkNFY29uSXRlbVByZXZpZXdEYXRhQmxvY2suU3RpY2tlchISCgVzdHlsZRgVIAEoDUgSiAEBEjYKCnZhcmlhdGlvbnMYFiADKAsyIi5DRWNvbkl0ZW1QcmV2aWV3RGF0YUJsb2NrLlN0aWNrZXISGgoNdXBncmFkZV9sZXZlbBgXIAEoDUgTiAEBGr0DCgdTdGlja2VyEhEKBHNsb3QYASABKA1IAIgBARIXCgpzdGlja2VyX2lkGAIgASgNSAGIAQESEQoEd2VhchgDIAEoAkgCiAEBEhIKBXNjYWxlGAQgASgCSAOIAQESFQoIcm90YXRpb24YBSABKAJIBIgBARIUCgd0aW50X2lkGAYgASgNSAWIAQESFQoIb2Zmc2V0X3gYByABKAJIBogBARIVCghvZmZzZXRfeRgIIAEoAkgHiAEBEhUKCG9mZnNldF96GAkgASgCSAiIAQESFAoHcGF0dGVybhgKIAEoDUgJiAEBEhsKDmhpZ2hsaWdodF9yZWVsGAsgASgNSAqIAQESHAoPd3JhcHBlZF9zdGlja2VyGAwgASgNSAuIAQFCBwoFX3Nsb3RCDQoLX3N0aWNrZXJfaWRCBwoFX3dlYXJCCAoGX3NjYWxlQgsKCV9yb3RhdGlvbkIKCghfdGludF9pZEILCglfb2Zmc2V0X3hCCwoJX29mZnNldF95QgsKCV9vZmZzZXRfekIKCghfcGF0dGVybkIRCg9faGlnaGxpZ2h0X3JlZWxCEgoQX3dyYXBwZWRfc3RpY2tlckIMCgpfYWNjb3VudGlkQgkKB19pdGVtaWRCCwoJX2RlZmluZGV4Qg0KC19wYWludGluZGV4QgkKB19yYXJpdHlCCgoIX3F1YWxpdHlCDAoKX3BhaW50d2VhckIMCgpfcGFpbnRzZWVkQhUKE19raWxsZWF0ZXJzY29yZXR5cGVCEQoPX2tpbGxlYXRlcnZhbHVlQg0KC19jdXN0b21uYW1lQgwKCl9pbnZlbnRvcnlCCQoHX29yaWdpbkIKCghfcXVlc3RpZEINCgtfZHJvcHJlYXNvbkINCgtfbXVzaWNpbmRleEILCglfZW50aW5kZXhCCwoJX3BldGluZGV4QggKBl9zdHlsZUIQCg5fdXBncmFkZV9sZXZlbGIGcHJvdG8z"), 0);
//#endregion
//#region src/models/inspect.ts
const HEX_RE = /^[0-9a-fA-F]+$/;
const wearView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4));
const CRC32_TABLE = /* @__PURE__ */ new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
	CRC32_TABLE[i] = c >>> 0;
}
/** Trailing checksum: crc32 over `[xorKey, ...protobuf]` folded with the protobuf length. */
function previewChecksum(keyed, protoLength) {
	let crc = 4294967295;
	for (const byte of keyed) crc = CRC32_TABLE[(crc ^ byte) & 255] ^ crc >>> 8;
	crc = (crc ^ 4294967295) >>> 0;
	return (crc & 65535 ^ protoLength * crc) >>> 0;
}
/**
* Decode a CS2 masked preview token — the asset_properties propertyid-6
* "certificate" hex — into a plain JSON object (uint64 ids as strings, camelCase
* fields, only set fields present). Layout is `[xorKey][protobuf][crc32]`: every
* byte after the key is XOR'd with it and the trailing 4-byte crc32 dropped.
* `paintwear` is returned as the float wear (0..1), not its raw uint32 bits.
* Returns `null` for non-hex input.
*/
function decodePreviewToken(hex) {
	if (!hex || hex.length % 2 !== 0 || hex.length < 12 || !HEX_RE.test(hex)) return null;
	try {
		const bytes = Buffer$1.from(hex, "hex");
		const xorKey = bytes[0];
		for (let i = 1; i < bytes.length; i++) bytes[i] = bytes[i] ^ xorKey;
		const message = fromBinary(CEconItemPreviewDataBlockSchema, bytes.subarray(1, bytes.length - 4));
		const json = toJson(CEconItemPreviewDataBlockSchema, message);
		if (typeof json.paintwear === "number") {
			wearView.setUint32(0, json.paintwear >>> 0, true);
			json.paintwear = wearView.getFloat32(0, true);
		}
		return json;
	} catch {
		return null;
	}
}
/**
* Encode JSON back into a masked preview token — the inverse of
* {@link decodePreviewToken}, accepting the same shape it returns. `paintwear` is read as
* the float wear (0..1) and re-packed into its uint32 bits. `xorKey` 0 leaves the payload
* readable; any other byte masks it the way CS2's own links do. The checksum is unkeyed
* crc32, so this is an integrity code and not a signature. Returns `null` if the input is
* not a valid CEconItemPreviewDataBlock.
*/
function encodePreviewToken(data, xorKey = 0) {
	if (!Number.isInteger(xorKey) || xorKey < 0 || xorKey > 255) return null;
	try {
		const json = { ...data };
		if (typeof json.paintwear === "number") {
			wearView.setFloat32(0, json.paintwear, true);
			json.paintwear = wearView.getUint32(0, true);
		}
		const proto = toBinary(CEconItemPreviewDataBlockSchema, fromJson(CEconItemPreviewDataBlockSchema, json));
		const bytes = Buffer$1.alloc(proto.length + 5);
		bytes[0] = xorKey;
		bytes.set(proto, 1);
		bytes.writeUInt32BE(previewChecksum(bytes.subarray(0, proto.length + 1), proto.length), proto.length + 1);
		for (let i = 1; i < bytes.length; i++) bytes[i] = bytes[i] ^ xorKey;
		return bytes.toString("hex").toUpperCase();
	} catch {
		return null;
	}
}
//#endregion
//#region src/session/tokens.ts
const GENERATE_TOKEN_URL = "https://api.steampowered.com/IAuthenticationService/GenerateAccessTokenForApp/v1";
var AccessTokenError = class extends Error {
	eresult;
	constructor(message, eresult) {
		super(message);
		this.eresult = eresult;
		this.name = "AccessTokenError";
	}
};
function decodeJwt(token) {
	try {
		const payload = token.split(".")[1];
		if (!payload) return null;
		const json = Buffer$1.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
		return JSON.parse(json);
	} catch {
		return null;
	}
}
function secondsUntilExpiry(token) {
	const exp = decodeJwt(token)?.exp;
	return typeof exp === "number" ? exp - Math.floor(Date.now() / 1e3) : NaN;
}
function encodeGenerateForAppRequest(refreshToken, renew = false) {
	const sub = decodeJwt(refreshToken)?.sub;
	if (!sub) throw new AccessTokenError("invalid refresh token: no steamid (sub) in payload");
	let steamId;
	try {
		steamId = BigInt(sub);
	} catch {
		throw new AccessTokenError(`invalid refresh token: non-numeric steamid '${sub}'`);
	}
	const msg = create(CAuthentication_AccessToken_GenerateForApp_RequestSchema, {
		refreshToken,
		steamid: steamId,
		renewalType: renew ? 1 : 0
	});
	return Buffer$1.from(toBinary(CAuthentication_AccessToken_GenerateForApp_RequestSchema, msg));
}
function decodeGenerateForAppResponse(input) {
	let accessToken;
	let refreshToken;
	try {
		const msg = fromBinary(CAuthentication_AccessToken_GenerateForApp_ResponseSchema, toUint8(input));
		accessToken = msg.accessToken;
		refreshToken = msg.refreshToken;
	} catch {
		throw new AccessTokenError("malformed GenerateAccessTokenForApp response");
	}
	if (!accessToken) throw new AccessTokenError("response had no access_token field");
	return refreshToken ? {
		accessToken,
		refreshToken
	} : { accessToken };
}
function toUint8(input) {
	return input instanceof Uint8Array && !Buffer$1.isBuffer(input) ? input : new Uint8Array(input);
}
const ERESULT_OK = "1";
async function mintAccessToken(refreshToken, renew, post) {
	const req = encodeGenerateForAppRequest(refreshToken, renew);
	const { status, eresult, errorMessage, body } = await post(GENERATE_TOKEN_URL, req.toString("base64"));
	if (status < 200 || status >= 300) throw new AccessTokenError(`GenerateAccessTokenForApp HTTP ${status} (eresult=${eresult ?? "?"}${errorMessage ? `, ${errorMessage}` : ""})`, eresult ? Number(eresult) : void 0);
	if (eresult && eresult !== ERESULT_OK) throw new AccessTokenError(`GenerateAccessTokenForApp failed: eresult=${eresult}${errorMessage ? ` (${errorMessage})` : ""}`, Number(eresult));
	if (!body.length) throw new AccessTokenError(`GenerateAccessTokenForApp empty response (eresult=${eresult ?? "?"})`);
	return decodeGenerateForAppResponse(body);
}
//#endregion
//#region src/session/SessionManager.ts
var SessionManager = class extends EventEmitter {
	refreshToken;
	accessToken;
	steamID;
	http;
	protoPost;
	minting;
	revoked = false;
	constructor(http, refreshToken) {
		super();
		const sub = decodeJwt(refreshToken)?.sub;
		if (!sub) throw new SteamSessionExpiredError("invalid refresh token: no steamid (sub) in payload");
		this.http = http;
		this.protoPost = createProtoPost(http);
		this.refreshToken = refreshToken;
		this.steamID = new SteamID(sub);
	}
	async getAccessToken() {
		if (this.revoked) throw new SteamSessionExpiredError("session has been revoked (logged out)");
		if (this.accessToken && secondsUntilExpiry(this.accessToken) > 300) return this.accessToken;
		if (!this.minting) this.minting = this.mint().finally(() => {
			this.minting = void 0;
		});
		return this.minting;
	}
	async listSessions() {
		const accessToken = await this.getAccessToken();
		return (await new AuthClient(this.http).getAuthSessionsForAccount(accessToken)).clientIds;
	}
	async logout(action = 0) {
		const accessToken = await this.getAccessToken();
		await new AuthClient(this.http).revokeRefreshToken(accessToken, action);
		this.revoked = true;
		this.accessToken = void 0;
		this.emit("debug", "refresh token revoked (logout)");
	}
	async setRefreshToken(refreshToken) {
		const sub = decodeJwt(refreshToken)?.sub;
		if (!sub) throw new SteamSessionExpiredError("invalid refresh token: no steamid (sub) in payload");
		if (sub !== this.steamID.getSteamID64()) throw new SteamError(`refresh token is for a different account (${sub} != ${this.steamID.getSteamID64()})`);
		this.refreshToken = refreshToken;
		this.revoked = false;
		this.accessToken = void 0;
		this.emit("refreshToken", refreshToken);
		await this.getAccessToken();
	}
	async mint() {
		const refreshExpiresIn = secondsUntilExpiry(this.refreshToken);
		if (refreshExpiresIn <= 0) throw this.expire("refresh token has expired — re-authentication required");
		const renew = refreshExpiresIn < REFRESH_TOKEN_RENEW_THRESHOLD_SECONDS;
		let result;
		try {
			result = await mintAccessToken(this.refreshToken, renew, this.protoPost);
		} catch (err) {
			if (err instanceof AccessTokenError && isTerminalAuthFailure(err)) throw this.expire(`refresh token rejected by Steam: ${err.message}`);
			throw err;
		}
		this.accessToken = result.accessToken;
		if (result.refreshToken && result.refreshToken !== this.refreshToken) {
			this.refreshToken = result.refreshToken;
			this.emit("refreshToken", result.refreshToken);
		}
		await this.applyLoginCookie();
		this.emit("debug", `minted access token${renew ? " + renewed refresh token" : ""}, expires in ${Math.round(secondsUntilExpiry(result.accessToken))}s`);
		return result.accessToken;
	}
	expire(message) {
		const err = new SteamSessionExpiredError(message);
		this.emit("sessionExpired", err);
		return err;
	}
	async applyLoginCookie() {
		const value = encodeURIComponent(`${this.steamID.getSteamID64()}||${this.accessToken}`);
		await this.http.setCookie(`steamLoginSecure=${value}`);
	}
};
function isTerminalAuthFailure(err) {
	return isTerminalAuthEResult(err.eresult);
}
//#endregion
//#region src/community/userDetails.ts
async function fetchUserDetails(http, url, referer, myAccountId, partnerAccountId) {
	const res = await http.get(url, {
		responseType: "text",
		headers: { Referer: referer }
	});
	if (res.statusCode !== 200) throw httpError(res);
	const html = res.body;
	checkCommunityError(html);
	if (!html.includes("g_rgAppContextData")) throw tradePageError(html) ?? new SteamError("Failed to load the trade page for this user");
	return parseUserDetails(html, myAccountId, partnerAccountId);
}
function tradePageError(html) {
	const message = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/)?.[1];
	return message ? parseStrError(message.replace(/\s+/g, " ").trim()) : void 0;
}
function buildPartnerTradePageUrl(partnerAccountId, token) {
	return `${URLS.community}/tradeoffer/new/?partner=${partnerAccountId}${token ? `&token=${token}` : ""}`;
}
function parseUserDetails(html, myAccountId, partnerAccountId) {
	const myEscrowDays = matchInt(html, /var g_daysMyEscrow = (\d+);/);
	const theirEscrowDays = matchInt(html, /var g_daysTheirEscrow = (\d+);/);
	if (myEscrowDays === null || theirEscrowDays === null) throw new SteamError("Failed to parse escrow durations from the trade page");
	return {
		me: {
			personaName: matchJsString(html, "g_strYourPersonaName") ?? "",
			contexts: matchJson(html, /g_rgAppContextData\s*=\s*(\{.*?\});/),
			escrowDays: myEscrowDays,
			...matchAvatars(html, myAccountId)
		},
		them: {
			personaName: matchJsString(html, "g_strTradePartnerPersonaName") ?? "",
			contexts: matchJson(html, /g_rgPartnerAppContextData\s*=\s*(\{.*?\});/),
			escrowDays: theirEscrowDays,
			probation: /g_bTradePartnerProbation\s*=\s*(?:true|1)\b/.test(html),
			...matchAvatars(html, partnerAccountId)
		}
	};
}
function matchInt(html, re) {
	const m = html.match(re);
	return m?.[1] !== void 0 ? Number.parseInt(m[1], 10) : null;
}
function matchJson(html, re) {
	const m = html.match(re);
	if (!m?.[1]) return null;
	try {
		return JSON.parse(m[1]);
	} catch {
		return null;
	}
}
function matchJsString(html, varName) {
	const re = new RegExp(`var ${varName}\\s*=\\s*("(?:\\\\.|[^"\\\\])*");`);
	const m = html.match(re);
	if (!m?.[1]) return void 0;
	try {
		return JSON.parse(m[1]);
	} catch {
		return m[1].slice(1, -1);
	}
}
function matchAvatars(html, accountId) {
	const re = new RegExp(`<img src="([^"]+)"(?: alt="[^"]*")? data-miniprofile="${accountId}">`);
	const m = html.match(re);
	if (!m?.[1]) return {
		avatarIcon: void 0,
		avatarMedium: void 0,
		avatarFull: void 0
	};
	const icon = m[1];
	return {
		avatarIcon: icon,
		avatarMedium: icon.replace(/\.jpg$/, "_medium.jpg"),
		avatarFull: icon.replace(/\.jpg$/, "_full.jpg")
	};
}
//#endregion
//#region src/trade/exchange.ts
function parseTrade(trade, descriptions) {
	const toItem = (a) => buildItem(a, descriptions.get(`${a.appid}_${a.classid}_${a.instanceid ?? "0"}`), [], a.contextid);
	return {
		status: trade.status,
		tradeInitTime: /* @__PURE__ */ new Date(trade.time_init * 1e3),
		settlementTime: trade.time_settlement ? /* @__PURE__ */ new Date(trade.time_settlement * 1e3) : null,
		receivedItems: (trade.assets_received ?? []).map(toItem),
		sentItems: (trade.assets_given ?? []).map(toItem),
		usedInventoryFallback: false
	};
}
async function getTradeStatus(api, tradeId) {
	const body = await api.call({
		httpMethod: "GET",
		iface: "IEconService",
		method: "GetTradeStatus",
		retryAfterMs: RETRY_AFTER.GetTradeStatus,
		input: {
			tradeid: tradeId,
			get_descriptions: 1,
			...LANG
		}
	});
	const trades = body.response?.trades ?? [];
	const trade = trades.find((t) => t.tradeid === tradeId) ?? (trades.length === 1 ? trades[0] : void 0);
	if (!trade) throw new SteamError(`Trade ${tradeId} not found in GetTradeStatus response`);
	return parseTrade(trade, buildDescriptionMap(body.response?.descriptions));
}
async function getTradeHistory(api, opts = {}) {
	const resp = (await api.call({
		httpMethod: "GET",
		iface: "IEconService",
		method: "GetTradeHistory",
		retryAfterMs: RETRY_AFTER.GetTradeHistory,
		input: {
			max_trades: opts.maxTrades ?? 100,
			get_descriptions: 1,
			include_failed: opts.includeFailed ? 1 : 0,
			include_total: opts.includeTotal ? 1 : 0,
			...opts.startAfterTime !== void 0 ? { start_after_time: opts.startAfterTime } : {},
			...opts.startAfterTradeId !== void 0 ? { start_after_tradeid: opts.startAfterTradeId } : {},
			...opts.navigatingBack ? { navigating_back: 1 } : {},
			...LANG
		}
	})).response ?? {};
	const descriptions = buildDescriptionMap(resp.descriptions);
	return {
		trades: (resp.trades ?? []).map((t) => ({
			...parseTrade(t, descriptions),
			tradeId: t.tradeid,
			partnerSteamId: t.steamid_other
		})),
		more: resp.more ?? false,
		totalTrades: resp.total_trades
	};
}
async function getTradeOffersSummary(api) {
	const r = (await api.call({
		httpMethod: "GET",
		iface: "IEconService",
		method: "GetTradeOffersSummary",
		retryAfterMs: RETRY_AFTER.GetTradeOffersSummary,
		input: { time_last_visit: 0 }
	})).response ?? {};
	return {
		pending_received_count: r.pending_received_count ?? 0,
		new_received_count: r.new_received_count ?? 0,
		updated_received_count: r.updated_received_count ?? 0,
		historical_received_count: r.historical_received_count ?? 0,
		pending_sent_count: r.pending_sent_count ?? 0,
		newly_accepted_sent_count: r.newly_accepted_sent_count ?? 0,
		updated_sent_count: r.updated_sent_count ?? 0,
		historical_sent_count: r.historical_sent_count ?? 0,
		escrow_received_count: r.escrow_received_count ?? 0,
		escrow_sent_count: r.escrow_sent_count ?? 0
	};
}
//#endregion
//#region src/trade/polling.ts
const DEFAULT_POLL_INTERVAL = 1e4;
const DEFAULT_POLL_FULL_UPDATE_INTERVAL = 3e5;
const DEFAULT_POLL_MAX_AGE_MS = 2592e6;
const POLL_BACKDATING_BUFFER = 1800;
const MINIMUM_POLL_INTERVAL = 1e3;
const OFFER_MAX_LIFETIME_MS = 12096e5;
function emptyPollData() {
	return {
		offersSince: 0,
		sent: {},
		received: {},
		timestamps: {}
	};
}
var Poller = class {
	source;
	pollData;
	pollInterval;
	fullInterval;
	maxAgeMs;
	cancelTime;
	store;
	timer;
	running = false;
	stopped = true;
	loaded = false;
	constructor(source, options = {}) {
		this.source = source;
		this.pollInterval = Math.max(options.pollInterval ?? 1e4, MINIMUM_POLL_INTERVAL);
		this.fullInterval = options.pollFullUpdateInterval ?? 3e5;
		this.maxAgeMs = options.maxAgeMs ?? 2592e6;
		this.cancelTime = options.cancelTime;
		this.store = options.store;
		this.pollData = options.pollData ?? emptyPollData();
	}
	start() {
		this.stopped = false;
		this.schedule(0);
	}
	stop() {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = void 0;
	}
	async poll(forceFull = false) {
		if (this.running) return this.pollInterval;
		this.running = true;
		try {
			if (this.store && !this.loaded) await this.loadFromStore();
			let result;
			try {
				result = await this.runCycle(forceFull);
			} catch (err) {
				const error = err;
				this.source.emit("debug", `Trade offer poll failed: ${error.message}`);
				this.source.emit("pollFailure", error);
				return this.backoffDelay(error);
			}
			if (this.store && result.changed) await this.persist();
			return this.pollInterval;
		} finally {
			this.running = false;
		}
	}
	async pollOnce(forceFull = false) {
		if (this.store) await this.loadFromStore();
		const { changes, changed } = await this.runCycle(forceFull);
		if (this.store && changed) await this.persist();
		return {
			changes,
			pollData: this.pollData
		};
	}
	async loadFromStore() {
		const loaded = await this.store?.load();
		if (loaded) this.pollData = loaded;
		this.loaded = true;
	}
	async persist() {
		try {
			await this.store?.save(this.pollData);
		} catch (err) {
			this.source.emit("debug", `pollData store save failed: ${err.message}`);
		}
	}
	schedule(ms) {
		if (this.stopped) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.poll().then((delay) => this.schedule(delay));
		}, Math.max(0, ms));
	}
	backoffDelay(err) {
		if (err instanceof RateLimitError) {
			const wait = err.unlockAt - Date.now();
			if (wait > this.pollInterval) return Math.max(wait, MINIMUM_POLL_INTERVAL);
		}
		return this.pollInterval;
	}
	async runCycle(forceFull) {
		const before = JSON.stringify(this.pollData);
		const sinceBase = this.pollData.offersSince ? this.pollData.offersSince - POLL_BACKDATING_BUFFER : 0;
		let fullUpdate = forceFull;
		let cutoff = sinceBase;
		if (forceFull || Date.now() - (this.pollData.lastFullUpdate ?? 0) >= this.fullInterval) {
			fullUpdate = true;
			this.pollData.lastFullUpdate = Date.now();
			cutoff = this.sweepCutoffSeconds();
		}
		this.source.emit("debug", `Polling trade offers since ${cutoff}${fullUpdate ? " (full update)" : ""}`);
		const result = await this.source.getTradeOffers(fullUpdate ? 3 : 1, /* @__PURE__ */ new Date(cutoff * 1e3));
		const changes = this.process(result.sent, result.received, fullUpdate);
		if (this.cancelTime !== void 0) this.autoCancel(result.sent, this.cancelTime);
		this.prune(seenIds(result.sent, result.received));
		const changed = JSON.stringify(this.pollData) !== before;
		this.source.emit("pollSuccess");
		if (changed) this.source.emit("pollData", this.pollData);
		return {
			changes,
			changed
		};
	}
	autoCancel(sentList, cancelTime) {
		const now = Date.now();
		for (const offer of sentList) {
			if (offer.state !== 2 || !offer.updated) continue;
			if (now - offer.updated.getTime() < cancelTime) continue;
			offer.cancel().then(() => this.source.emit("sentOfferCanceled", offer, "cancelTime"), (err) => this.source.emit("debug", `Can't auto-cancel offer #${offer.id}: ${err.message}`));
		}
	}
	sweepCutoffSeconds() {
		return Math.max(1, Math.floor((Date.now() - this.maxAgeMs) / 1e3));
	}
	process(sentList, receivedList, fullUpdate) {
		const changes = [];
		const { sent, received, timestamps } = this.pollData;
		let hasGlitched = false;
		for (const offer of sentList) {
			if (!offer.id) continue;
			const known = sent[offer.id];
			if (known === void 0) this.record(changes, {
				type: "unknownOfferSent",
				offer
			});
			else if (offer.state !== known) {
				if (offer.glitched) {
					hasGlitched = true;
					continue;
				}
				this.record(changes, {
					type: "sentOfferChanged",
					offer,
					oldState: known
				});
			}
			sent[offer.id] = offer.state;
			this.stamp(timestamps, offer);
		}
		for (const offer of receivedList) {
			if (!offer.id) continue;
			if (offer.glitched) {
				hasGlitched = true;
				continue;
			}
			const known = received[offer.id];
			if (known === void 0 && offer.state === 2) this.record(changes, {
				type: "newOffer",
				offer
			});
			else if (known !== void 0 && offer.state !== known) this.record(changes, {
				type: "receivedOfferChanged",
				offer,
				oldState: known
			});
			received[offer.id] = offer.state;
			this.stamp(timestamps, offer);
		}
		if (!hasGlitched) {
			let latest = this.pollData.offersSince;
			for (const offer of [...sentList, ...receivedList]) {
				const updated = offer.updated ? Math.floor(offer.updated.getTime() / 1e3) : 0;
				if (updated > latest) latest = updated;
			}
			if (fullUpdate) latest = Math.max(latest, Math.floor(Date.now() / 1e3));
			this.pollData.offersSince = latest;
		}
		return changes;
	}
	record(changes, change) {
		changes.push(change);
		switch (change.type) {
			case "newOffer":
				this.source.emit("newOffer", change.offer);
				break;
			case "unknownOfferSent":
				this.source.emit("unknownOfferSent", change.offer);
				break;
			case "sentOfferChanged":
				this.source.emit("sentOfferChanged", change.offer, change.oldState);
				break;
			case "receivedOfferChanged": this.source.emit("receivedOfferChanged", change.offer, change.oldState);
		}
		const previousState = "oldState" in change ? change.oldState : void 0;
		this.source.emit("offerUpdate", {
			offer: change.offer,
			...previousState !== void 0 ? { previousState } : {}
		});
	}
	prune(seen) {
		const cutoff = Math.floor((Date.now() - this.maxAgeMs - OFFER_MAX_LIFETIME_MS) / 1e3);
		this.pruneMap(this.pollData.sent, seen, cutoff);
		this.pruneMap(this.pollData.received, seen, cutoff);
	}
	pruneMap(map, seen, cutoff) {
		for (const id of Object.keys(map)) {
			const state = map[id];
			const created = this.pollData.timestamps[id];
			if (!seen.has(id) && state !== void 0 && isTerminalState(state) && created !== void 0 && created > 0 && created < cutoff) {
				delete map[id];
				delete this.pollData.timestamps[id];
			}
		}
	}
	stamp(timestamps, offer) {
		if (offer.id && offer.created) timestamps[offer.id] = Math.floor(offer.created.getTime() / 1e3);
	}
};
function seenIds(sent, received) {
	const ids = /* @__PURE__ */ new Set();
	for (const offer of [...sent, ...received]) if (offer.id) ids.add(offer.id);
	return ids;
}
//#endregion
//#region src/trade/TradeOffer.ts
const TWO_WEEKS_MS = 12096e5;
var TradeOffer = class TradeOffer {
	deps;
	id;
	partner;
	token;
	message = "";
	state = 1;
	itemsToGive = [];
	itemsToReceive = [];
	isOurOffer = true;
	tradeID;
	confirmationMethod = 0;
	escrowEnds;
	settlementDate;
	delaySettlement = false;
	created;
	updated;
	expires;
	fromRealTimeTrade = false;
	glitched = false;
	countering;
	constructor(deps, init) {
		this.deps = deps;
		this.partner = init.partner;
		this.token = init.token;
		this.id = init.id;
	}
	static fromData(deps, raw, descriptions) {
		if (!raw.accountid_other) throw new SteamError(`Trade offer ${raw.tradeofferid} is missing a partner accountid`);
		const partner = SteamID.fromIndividualAccountID(raw.accountid_other);
		const offer = new TradeOffer(deps, {
			partner,
			id: raw.tradeofferid
		});
		offer.message = raw.message ?? "";
		offer.state = raw.trade_offer_state;
		offer.isOurOffer = raw.is_our_offer;
		offer.fromRealTimeTrade = raw.from_real_time_trade ?? false;
		const mapItem = (a) => descriptions ? buildItem(a, descriptions.get(`${a.appid}_${a.classid}_${a.instanceid}`), [], a.contextid) : toTradeItem(a);
		offer.itemsToGive = (raw.items_to_give ?? []).map(mapItem);
		offer.itemsToReceive = (raw.items_to_receive ?? []).map(mapItem);
		offer.confirmationMethod = raw.confirmation_method ?? 0;
		if (raw.tradeid) offer.tradeID = raw.tradeid;
		if (raw.escrow_end_date) offer.escrowEnds = /* @__PURE__ */ new Date(raw.escrow_end_date * 1e3);
		if (raw.settlement_date) offer.settlementDate = /* @__PURE__ */ new Date(raw.settlement_date * 1e3);
		offer.delaySettlement = raw.delay_settlement ?? false;
		if (raw.time_created) offer.created = /* @__PURE__ */ new Date(raw.time_created * 1e3);
		if (raw.time_updated) offer.updated = /* @__PURE__ */ new Date(raw.time_updated * 1e3);
		if (raw.expiration_time) offer.expires = /* @__PURE__ */ new Date(raw.expiration_time * 1e3);
		const allItems = [...offer.itemsToGive, ...offer.itemsToReceive];
		offer.glitched = !isTerminalState(offer.state) && (allItems.length === 0 || descriptions !== void 0 && allItems.some((i) => !i.name));
		return offer;
	}
	containsItem(item) {
		return [...this.itemsToGive, ...this.itemsToReceive].some((i) => i.appid === item.appid && i.contextid === item.contextid && i.assetid === item.assetid);
	}
	give(items) {
		this.itemsToGive.push(...items);
		return this;
	}
	receive(items) {
		this.itemsToReceive.push(...items);
		return this;
	}
	setMessage(message) {
		if (this.id) throw new SteamError("Cannot set a message on an already-sent offer");
		this.message = message.slice(0, 128);
		return this;
	}
	async send() {
		if (this.id) throw new SteamError("This offer has already been sent");
		if (this.itemsToGive.length + this.itemsToReceive.length === 0) throw new SteamError("Cannot send an empty trade offer");
		await this.deps.session.getAccessToken();
		const sessionid = await this.deps.http.getSessionId();
		await acknowledgeTradeProtection(this.deps.http).catch((err) => {
			if (err instanceof SteamSessionExpiredError) throw err;
		});
		const offerdata = {
			newversion: true,
			version: this.itemsToGive.length + this.itemsToReceive.length + 1,
			me: {
				assets: this.itemsToGive.map(toAsset),
				currency: [],
				ready: false
			},
			them: {
				assets: this.itemsToReceive.map(toAsset),
				currency: [],
				ready: false
			}
		};
		const createParams = {};
		if (this.token) createParams.trade_offer_access_token = this.token;
		const res = await this.deps.http.post(`${URLS.community}/tradeoffer/new/send`, {
			responseType: "json",
			referer: this.newOfferReferer(),
			form: {
				sessionid,
				serverid: 1,
				partner: this.partner.getSteamID64(),
				tradeoffermessage: this.message,
				json_tradeoffer: JSON.stringify(offerdata),
				captcha: "",
				trade_offer_create_params: JSON.stringify(createParams),
				...this.countering ? { tradeofferid_countered: this.countering } : {}
			}
		});
		if (res.statusCode === 401) throw new SteamSessionExpiredError();
		const body = res.body;
		if (body?.strError) throw parseStrError(body.strError);
		if (res.statusCode !== 200) throw httpError(res);
		if (!body) throw new SteamError("Malformed JSON response");
		if (body.tradeofferid) {
			this.id = body.tradeofferid;
			this.state = 2;
			this.created = /* @__PURE__ */ new Date();
			this.updated = /* @__PURE__ */ new Date();
			this.expires = new Date(Date.now() + TWO_WEEKS_MS);
		}
		this.confirmationMethod = 0;
		if (body.needs_email_confirmation) {
			this.state = 9;
			this.confirmationMethod = 1;
		}
		if (body.needs_mobile_confirmation) {
			this.state = 9;
			this.confirmationMethod = 2;
		}
		if (this.state === 9) return "needs_confirmation";
		if (body.tradeofferid) return "sent";
		throw new SteamError("Unknown response sending trade offer");
	}
	async accept() {
		if (!this.id) throw new SteamError("Cannot accept an unsent offer");
		if (this.state !== 2) throw new SteamError(`Offer #${this.id} is not active, so it may not be accepted`);
		if (this.isOurOffer) throw new SteamError(`Cannot accept our own offer #${this.id}`);
		await this.deps.session.getAccessToken();
		const sessionid = await this.deps.http.getSessionId();
		const res = await this.deps.http.post(`${URLS.community}/tradeoffer/${this.id}/accept`, {
			responseType: "json",
			referer: `${URLS.community}/tradeoffer/${this.id}/`,
			form: {
				sessionid,
				serverid: 1,
				tradeofferid: this.id,
				partner: this.partner.getSteamID64(),
				captcha: ""
			}
		});
		if (res.statusCode === 403) throw new SteamSessionExpiredError();
		const body = res.body;
		if (body?.strError) throw parseStrError(body.strError);
		if (res.statusCode !== 200) throw httpError(res);
		if (!body) throw new SteamError("Malformed JSON response");
		if (body.tradeid) this.tradeID = body.tradeid;
		if (body.needs_mobile_confirmation || body.needs_email_confirmation) {
			this.confirmationMethod = body.needs_mobile_confirmation ? 2 : 1;
			return "needs_confirmation";
		}
		this.state = 3;
		try {
			const refreshed = await this.deps.trade.getTradeOffer(this.id);
			this.state = refreshed.state;
			this.escrowEnds = refreshed.escrowEnds;
		} catch {}
		return this.state === 11 ? "escrow" : "accepted";
	}
	async cancel() {
		if (!this.id) throw new SteamError("Cannot cancel or decline an unsent offer");
		if (this.state !== 2 && this.state !== 9) throw new SteamError(`Offer #${this.id} is not active, so it may not be cancelled or declined`);
		await this.deps.session.getAccessToken();
		const sessionid = await this.deps.http.getSessionId();
		const action = this.isOurOffer ? "cancel" : "decline";
		const res = await this.deps.http.post(`${URLS.community}/tradeoffer/${this.id}/${action}`, {
			responseType: "json",
			referer: this.offerReferer(),
			form: { sessionid }
		});
		if (res.statusCode === 401) throw new SteamSessionExpiredError();
		const body = res.body;
		if (body?.strError) throw parseStrError(body.strError);
		if (res.statusCode !== 200) throw httpError(res);
		if (!body) throw new SteamError("Malformed JSON response");
		if (body.tradeofferid !== this.id) throw new SteamError("Wrong response cancelling offer");
		this.state = this.isOurOffer ? 6 : 7;
		this.updated = /* @__PURE__ */ new Date();
	}
	decline() {
		return this.cancel();
	}
	async confirm() {
		if (!this.id) throw new ConfirmationError("Cannot confirm an unsent offer");
		if (!this.deps.confirmations.hasIdentitySecret) throw new ConfirmationError("identitySecret is required to confirm trade offers — construct SteamMobile with { identitySecret }");
		await this.deps.confirmations.acceptConfirmationForObject(this.id);
	}
	counter() {
		if (!this.id) throw new SteamError("Cannot counter an unsent offer");
		if (this.state !== 2) throw new SteamError(`Offer #${this.id} is not active, so it may not be countered`);
		const next = new TradeOffer(this.deps, {
			partner: this.partner,
			...this.token ? { token: this.token } : {}
		});
		next.countering = this.id;
		next.isOurOffer = true;
		next.itemsToGive = this.itemsToGive.map((i) => ({ ...i }));
		next.itemsToReceive = this.itemsToReceive.map((i) => ({ ...i }));
		next.message = this.message;
		return next;
	}
	getTradeStatus() {
		if (!this.tradeID) throw new SteamError("No trade ID — getTradeStatus needs an accepted offer");
		return this.deps.trade.getTradeStatus({ tradeId: this.tradeID });
	}
	getPartnerInventory(appid, contextid, tradableOnly) {
		const target = this.partnerTarget();
		return this.deps.trade.getInventory(target, appid, contextid, tradableOnly !== void 0 ? { tradableOnly } : {});
	}
	async getUserDetails() {
		if (this.id && this.isOurOffer) throw new SteamError("Cannot get user details for an offer that we sent");
		if (this.id && this.state !== 2) throw new SteamError("Cannot get user details for an offer that is sent and not Active");
		await this.deps.session.getAccessToken();
		const url = this.id ? `${URLS.community}/tradeoffer/${this.id}/` : buildPartnerTradePageUrl(this.partner.accountid, this.token);
		const referer = `${URLS.community}/profiles/${this.partner.getSteamID64()}`;
		return fetchUserDetails(this.deps.http, url, referer, this.deps.session.steamID.accountid, this.partner.accountid);
	}
	partnerTarget() {
		const steamId = this.partner.getSteamID64();
		return this.token ? {
			steamId,
			token: this.token
		} : { steamId };
	}
	newOfferReferer() {
		const token = this.token ? `&token=${this.token}` : "";
		return `${URLS.community}/tradeoffer/${this.id ?? "new"}/?partner=${this.partner.accountid}${token}`;
	}
	offerReferer() {
		const token = this.token ? `&token=${this.token}` : "";
		return `${URLS.community}/tradeoffer/${this.id}/?partner=${this.partner.accountid}${token}`;
	}
};
function toAsset(item) {
	return {
		appid: item.appid,
		contextid: item.contextid,
		amount: item.amount && item.amount > 0 ? item.amount : 1,
		assetid: item.assetid
	};
}
function toTradeItem(raw) {
	return {
		appid: raw.appid,
		contextid: raw.contextid,
		assetid: raw.assetid,
		amount: Number(raw.amount) || 1
	};
}
//#endregion
//#region src/trade/TradeNamespace.ts
const FUTURE_CUTOFF_MS = 31536e6;
var TradeNamespace = class extends EventEmitter {
	api;
	http;
	session;
	confirmations;
	poller;
	constructor(api, http, session, confirmations) {
		super();
		this.api = api;
		this.http = http;
		this.session = session;
		this.confirmations = confirmations;
	}
	offerDeps() {
		return {
			http: this.http,
			session: this.session,
			confirmations: this.confirmations,
			trade: this
		};
	}
	createOffer(target) {
		const { steamId, token } = resolveTarget(target);
		return new TradeOffer(this.offerDeps(), {
			partner: new SteamID(steamId),
			...token ? { token } : {}
		});
	}
	async getTradeOffer(id) {
		const body = await this.api.call({
			httpMethod: "GET",
			iface: "IEconService",
			method: "GetTradeOffer",
			retryAfterMs: RETRY_AFTER.GetTradeOffer,
			input: {
				tradeofferid: id,
				get_descriptions: 1,
				...LANG
			}
		});
		const raw = body.response?.offer;
		if (!raw) throw new SteamError(`Trade offer ${id} not found`);
		return TradeOffer.fromData(this.offerDeps(), raw, buildDescriptionMap(body.response?.descriptions));
	}
	async getTradeOffers(filter = 1, historicalCutoff) {
		const cutoff = historicalCutoff ?? new Date(Date.now() + FUTURE_CUTOFF_MS);
		const sentRaw = [];
		const receivedRaw = [];
		const descriptions = [];
		let cursor = 0;
		do {
			const response = (await this.api.call({
				httpMethod: "GET",
				iface: "IEconService",
				method: "GetTradeOffers",
				retryAfterMs: RETRY_AFTER.GetTradeOffers,
				input: {
					get_sent_offers: 1,
					get_received_offers: 1,
					get_descriptions: 1,
					active_only: filter === 1 ? 1 : 0,
					historical_only: filter === 2 ? 1 : 0,
					time_historical_cutoff: Math.floor(cutoff.getTime() / 1e3),
					cursor,
					...LANG
				}
			})).response ?? {};
			sentRaw.push(...response.trade_offers_sent ?? []);
			receivedRaw.push(...response.trade_offers_received ?? []);
			descriptions.push(...response.descriptions ?? []);
			const next = response.next_cursor ?? 0;
			if (next !== 0 && next === cursor) break;
			cursor = next;
			if (cursor) this.emit("debug", `GetTradeOffers with cursor ${cursor}`);
		} while (cursor);
		const all = [...sentRaw, ...receivedRaw];
		if (all.length > 0 && (all.every(offerMalformed) || all.some(offerSuperMalformed))) throw new SteamError("Data temporarily unavailable");
		const descMap = buildDescriptionMap(descriptions);
		const build = (raw) => TradeOffer.fromData(this.offerDeps(), sanitizeRawOffer(raw), descMap);
		return {
			sent: sentRaw.map(build),
			received: receivedRaw.map(build)
		};
	}
	getTradeStatus(opts) {
		return getTradeStatus(this.api, opts.tradeId);
	}
	async getUserDetails(target) {
		await this.session.getAccessToken();
		const { steamId, token } = resolveTarget(target);
		const partnerAccountId = new SteamID(steamId).accountid;
		return fetchUserDetails(this.http, buildPartnerTradePageUrl(partnerAccountId, token), `${URLS.community}/profiles/${steamId}`, this.session.steamID.accountid, partnerAccountId);
	}
	async getEscrow(target) {
		const { steamId, token } = resolveTarget(target);
		const r = (await this.api.call({
			httpMethod: "GET",
			iface: "IEconService",
			method: "GetTradeHoldDurations",
			retryAfterMs: RETRY_AFTER.GetTradeHoldDurations,
			input: {
				steamid_target: steamId,
				...token ? { trade_offer_access_token: token } : {}
			}
		})).response ?? {};
		const zero = { escrow_end_duration_seconds: 0 };
		return {
			me: r.my_escrow ?? zero,
			them: r.their_escrow ?? zero,
			both: r.both_escrow ?? zero
		};
	}
	getTradeHistory(opts) {
		return getTradeHistory(this.api, opts);
	}
	getTradeOffersSummary() {
		return getTradeOffersSummary(this.api);
	}
	async reconcile(ids) {
		const results = await Promise.allSettled(ids.map((id) => this.getTradeOffer(id)));
		const map = /* @__PURE__ */ new Map();
		results.forEach((res, i) => {
			const id = ids[i];
			if (id !== void 0 && res.status === "fulfilled") map.set(id, res.value);
		});
		return map;
	}
	async getOffersContainingItems(items, includeInactive = false) {
		const { sent, received } = await this.getTradeOffers(includeInactive ? 3 : 1);
		return [...sent, ...received].filter((offer) => items.every((item) => offer.containsItem(item)));
	}
	startPolling(options = {}) {
		this.poller?.stop();
		this.poller = new Poller(this, options);
		this.poller.start();
	}
	stopPolling() {
		this.poller?.stop();
		this.poller = void 0;
	}
	async pollOnce(options = {}) {
		const { forceFull, ...pollOptions } = options;
		if (!this.poller) this.poller = new Poller(this, pollOptions);
		return this.poller.pollOnce(forceFull ?? false);
	}
	get pollData() {
		return this.poller?.pollData;
	}
	async getInventory(target, appid, contextid = "2", options = {}) {
		const tradableOnly = options.tradableOnly ?? false;
		await this.session.getAccessToken();
		const { steamId, token } = resolveTarget(target);
		const sessionid = await this.http.getSessionId();
		const accountId = new SteamID(steamId).accountid;
		const referer = `${URLS.community}/tradeoffer/new/?partner=${accountId}${token ? `&token=${token}` : ""}`;
		return paginate(async (start) => {
			const res = await this.http.get(`${URLS.community}/tradeoffer/new/partnerinventory/`, {
				responseType: "json",
				searchParams: {
					sessionid,
					partner: steamId,
					appid,
					contextid,
					...token ? { token } : {},
					...start !== void 0 ? { start } : {},
					l: LANG.l
				},
				headers: { Referer: referer }
			});
			const body = res.body;
			if (res.statusCode === 500 && body?.error) throw parseStrError(body.error);
			if (res.statusCode !== 200) throw httpError(res, RETRY_AFTER.partnerInventory);
			if (!body?.success) throw await inventoryFailureError(this.http, steamId, token, body?.error ?? body?.Error);
			const next = body.more && typeof body.more_start === "number" && body.more_start > (start ?? 0) ? body.more_start : void 0;
			return {
				items: parsePartnerInventory(body, contextid, tradableOnly),
				next
			};
		});
	}
};
function itemMalformed(item) {
	return !item.appid || !item.contextid || !item.assetid;
}
function offerSuperMalformed(offer) {
	return !offer.accountid_other;
}
function offerMalformed(offer) {
	return offerSuperMalformed(offer) || (offer.items_to_give ?? []).length === 0 && (offer.items_to_receive ?? []).length === 0 || (offer.items_to_give ?? []).some(itemMalformed) || (offer.items_to_receive ?? []).some(itemMalformed);
}
function sanitizeRawOffer(offer) {
	return {
		...offer,
		...offer.items_to_give ? { items_to_give: offer.items_to_give.filter((i) => !itemMalformed(i)) } : {},
		...offer.items_to_receive ? { items_to_receive: offer.items_to_receive.filter((i) => !itemMalformed(i)) } : {}
	};
}
//#endregion
//#region src/SteamMobile.ts
var SteamMobile = class extends EventEmitter {
	http;
	session;
	api;
	confirmations;
	trade;
	community;
	market;
	identitySecret;
	polling;
	proxy;
	profile;
	constructor(options) {
		super();
		const profile = resolveMobileProfile(options.mobileProfile);
		this.profile = profile;
		this.proxy = options.proxy;
		this.http = new HttpClient({
			...options.proxy ? { proxy: options.proxy } : {},
			profile
		});
		this.session = new SessionManager(this.http, options.refreshToken);
		this.identitySecret = options.identitySecret;
		this.polling = options.polling;
		this.api = new WebApiClient(this.http, () => this.session.getAccessToken());
		this.confirmations = new ConfirmationManager(this.http, this.session.steamID, options.identitySecret, profile);
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
	async login() {
		await this.session.getAccessToken();
		if (this.polling) this.trade.startPolling(this.polling === true ? {} : this.polling);
		return this;
	}
	async reauthenticate(credentials) {
		const result = await loginWithCredentials({
			...credentials,
			...this.proxy ? { proxy: this.proxy } : {},
			mobileProfile: this.profile
		});
		await this.session.setRefreshToken(result.refreshToken);
	}
	ensureApiKey(domain) {
		return this.community.ensureApiKey(domain);
	}
	openidLogin(options) {
		return this.community.openidLogin(options);
	}
	async request(method, url, opts) {
		await this.session.getAccessToken();
		return this.http.request(method, url, opts);
	}
	get(url, opts) {
		return this.request("GET", url, opts);
	}
	post(url, opts) {
		return this.request("POST", url, opts);
	}
	get steamID() {
		return this.session.steamID;
	}
	get accessToken() {
		return this.session.accessToken;
	}
	get refreshToken() {
		return this.session.refreshToken;
	}
	async shutdown() {
		this.trade.stopPolling();
		this.trade.removeAllListeners();
		this.removeAllListeners();
	}
};
//#endregion
export { ANDROID_PROFILE, AccessTokenError, AuthClient, CommunityNamespace, ConfirmationError, ConfirmationManager, CredentialSession, DEFAULT_CONTEXTID, DEFAULT_POLL_FULL_UPDATE_INTERVAL, DEFAULT_POLL_INTERVAL, DEFAULT_POLL_MAX_AGE_MS, DEFAULT_RATE_LIMIT_RETRY_MS, EAuthSessionGuardType, EAuthTokenPlatformType, EAuthTokenRevokeAction, EConfirmationMethod, EConfirmationType, EOfferFilter, EResult, ESessionPersistence, ETokenRenewalType, ETradeOfferState, ETradeStatus, EscrowError, FamilyViewError, HttpClient, HttpStatusError, IOS_PROFILE, ItemServerUnavailableError, LANG, LoginError, MarketBlockedError, MarketConfirmationLimitError, MarketNamespace, NewDeviceError, NoMobileAuthenticatorError, OfferLimitError, OpenIdError, Poller, PrivateInventoryError, ProxyError, RATE_LIMITS, RETRY_AFTER, RateLimitError, SessionManager, SteamError, SteamMobile, SteamSessionExpiredError, SteamWebApi, TERMINAL_AUTH_ERESULTS, TRANSIENT_ERESULTS, TargetCannotTradeError, ThrottledError, TradeBanError, TradeNamespace, TradeOffer, URLS, WalletBalanceLimitError, WebApiClient, confirmOpenid, decodeJwt, decodePreviewToken, encodePreviewToken, getPriceValueAsInt, getTradeHistory, getTradeOffersSummary, getTradeStatus, isTerminalAuthEResult, isTerminalState, isTransientEResult, loginWithCredentials, parseInventory, parseMarketHistory, parseOpenidForm, parsePartnerInventory, resolveMobileProfile, resolveTarget, secondsUntilExpiry, steamOpenidLogin };

//# sourceMappingURL=index.mjs.map