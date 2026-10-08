import { Buffer as Buffer$1 } from "node:buffer";
import { Message, MessageInitShape, MessageShape } from "@bufbuild/protobuf";
import { GenMessage } from "@bufbuild/protobuf/codegenv2";
import { EventEmitter } from "node:events";
import SteamID from "steamid";
import { CookieJar } from "tough-cookie";
//#region src/core/mobileProfile.d.ts
type MobilePlatform = "ios" | "android";
interface MobileProfile {
  mobileClient: MobilePlatform;
  mobileClientVersion: string;
  apiUserAgent: string;
  webUserAgent: string;
  deviceFriendlyName: string;
  osType: number;
  gamingDeviceType: number;
  appType?: number;
}
declare const IOS_PROFILE: MobileProfile;
declare const ANDROID_PROFILE: MobileProfile;
declare function resolveMobileProfile(input?: MobilePlatform | Partial<MobileProfile>): MobileProfile;
//#endregion
//#region src/http/HttpClient.d.ts
type Method = "GET" | "POST";
type ResponseType = "text" | "json" | "buffer";
type Scalar$1 = string | number | boolean;
interface HttpResponse<T = string> {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: T;
}
interface MultipartField {
  name: string;
  value: string;
}
interface RequestOptions {
  searchParams?: Record<string, Scalar$1 | undefined>;
  form?: Record<string, Scalar$1 | undefined>;
  multipart?: MultipartField[];
  json?: unknown;
  body?: string | Buffer;
  headers?: Record<string, string>;
  responseType?: ResponseType;
  referer?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
declare class HttpClient {
  readonly jar: CookieJar;
  private readonly webClient;
  private readonly nativeClient;
  private readonly browserClient;
  private readonly profile;
  private readonly proxy;
  constructor(opts: {
    proxy?: string;
    profile: MobileProfile;
  });
  request<T = string>(method: Method, url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  private perform;
  private wrapTransportError;
  get<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  post<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  setCookie(rawCookie: string): Promise<void>;
  getCookie(key: string, url?: string): Promise<string | undefined>;
  getSessionId(): Promise<string>;
}
//#endregion
//#region src/protobufs/steammessages_auth_pb.d.ts
/**
 * @generated from message CAuthentication_GetPasswordRSAPublicKey_Response
 */
type CAuthentication_GetPasswordRSAPublicKey_Response = Message<"CAuthentication_GetPasswordRSAPublicKey_Response"> & {
  /**
   * @generated from field: optional string publickey_mod = 1;
   */
  publickeyMod: string;
  /**
   * @generated from field: optional string publickey_exp = 2;
   */
  publickeyExp: string;
  /**
   * @generated from field: optional uint64 timestamp = 3;
   */
  timestamp: bigint;
};
/**
 * Describes the message CAuthentication_GetPasswordRSAPublicKey_Response.
 * Use `create(CAuthentication_GetPasswordRSAPublicKey_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_GetPasswordRSAPublicKey_ResponseSchema: GenMessage<CAuthentication_GetPasswordRSAPublicKey_Response>;
/**
 * @generated from message CAuthentication_DeviceDetails
 */
type CAuthentication_DeviceDetails = Message<"CAuthentication_DeviceDetails"> & {
  /**
   * @generated from field: optional string device_friendly_name = 1;
   */
  deviceFriendlyName: string;
  /**
   * @generated from field: optional EAuthTokenPlatformType platform_type = 2 [default = k_EAuthTokenPlatformType_Unknown];
   */
  platformType: EAuthTokenPlatformType$1;
  /**
   * @generated from field: optional int32 os_type = 3;
   */
  osType: number;
  /**
   * @generated from field: optional uint32 gaming_device_type = 4;
   */
  gamingDeviceType: number;
  /**
   * @generated from field: optional uint32 client_count = 5;
   */
  clientCount: number;
  /**
   * @generated from field: optional bytes machine_id = 6;
   */
  machineId: Uint8Array;
  /**
   * @generated from field: optional EAuthTokenAppType app_type = 7 [default = k_EAuthTokenAppType_Unknown];
   */
  appType: EAuthTokenAppType;
};
/**
 * @generated from message CAuthentication_AllowedConfirmation
 */
type CAuthentication_AllowedConfirmation = Message<"CAuthentication_AllowedConfirmation"> & {
  /**
   * @generated from field: optional EAuthSessionGuardType confirmation_type = 1 [default = k_EAuthSessionGuardType_Unknown];
   */
  confirmationType: EAuthSessionGuardType$1;
  /**
   * @generated from field: optional string associated_message = 2;
   */
  associatedMessage: string;
};
/**
 * @generated from message CAuthentication_BeginAuthSessionViaCredentials_Request
 */
type CAuthentication_BeginAuthSessionViaCredentials_Request = Message<"CAuthentication_BeginAuthSessionViaCredentials_Request"> & {
  /**
   * @generated from field: optional string device_friendly_name = 1;
   */
  deviceFriendlyName: string;
  /**
   * @generated from field: optional string account_name = 2;
   */
  accountName: string;
  /**
   * @generated from field: optional string encrypted_password = 3;
   */
  encryptedPassword: string;
  /**
   * @generated from field: optional uint64 encryption_timestamp = 4;
   */
  encryptionTimestamp: bigint;
  /**
   * @generated from field: optional bool remember_login = 5;
   */
  rememberLogin: boolean;
  /**
   * @generated from field: optional EAuthTokenPlatformType platform_type = 6 [default = k_EAuthTokenPlatformType_Unknown];
   */
  platformType: EAuthTokenPlatformType$1;
  /**
   * @generated from field: optional ESessionPersistence persistence = 7 [default = k_ESessionPersistence_Persistent];
   */
  persistence: ESessionPersistence$1;
  /**
   * @generated from field: optional string website_id = 8 [default = "Unknown"];
   */
  websiteId: string;
  /**
   * @generated from field: optional CAuthentication_DeviceDetails device_details = 9;
   */
  deviceDetails?: CAuthentication_DeviceDetails | undefined;
  /**
   * @generated from field: optional string guard_data = 10;
   */
  guardData: string;
  /**
   * @generated from field: optional uint32 language = 11;
   */
  language: number;
  /**
   * @generated from field: optional int32 qos_level = 12 [default = 2];
   */
  qosLevel: number;
};
/**
 * Describes the message CAuthentication_BeginAuthSessionViaCredentials_Request.
 * Use `create(CAuthentication_BeginAuthSessionViaCredentials_RequestSchema)` to create a new message.
 */
declare const CAuthentication_BeginAuthSessionViaCredentials_RequestSchema: GenMessage<CAuthentication_BeginAuthSessionViaCredentials_Request>;
/**
 * @generated from message CAuthentication_BeginAuthSessionViaCredentials_Response
 */
type CAuthentication_BeginAuthSessionViaCredentials_Response = Message<"CAuthentication_BeginAuthSessionViaCredentials_Response"> & {
  /**
   * @generated from field: optional uint64 client_id = 1;
   */
  clientId: bigint;
  /**
   * @generated from field: optional bytes request_id = 2;
   */
  requestId: Uint8Array;
  /**
   * @generated from field: optional float interval = 3;
   */
  interval: number;
  /**
   * @generated from field: repeated CAuthentication_AllowedConfirmation allowed_confirmations = 4;
   */
  allowedConfirmations: CAuthentication_AllowedConfirmation[];
  /**
   * @generated from field: optional uint64 steamid = 5;
   */
  steamid: bigint;
  /**
   * @generated from field: optional string weak_token = 6;
   */
  weakToken: string;
  /**
   * @generated from field: optional string agreement_session_url = 7;
   */
  agreementSessionUrl: string;
  /**
   * @generated from field: optional string extended_error_message = 8;
   */
  extendedErrorMessage: string;
};
/**
 * Describes the message CAuthentication_BeginAuthSessionViaCredentials_Response.
 * Use `create(CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema: GenMessage<CAuthentication_BeginAuthSessionViaCredentials_Response>;
/**
 * @generated from message CAuthentication_PollAuthSessionStatus_Response
 */
type CAuthentication_PollAuthSessionStatus_Response = Message<"CAuthentication_PollAuthSessionStatus_Response"> & {
  /**
   * @generated from field: optional uint64 new_client_id = 1;
   */
  newClientId: bigint;
  /**
   * @generated from field: optional string new_challenge_url = 2;
   */
  newChallengeUrl: string;
  /**
   * @generated from field: optional string refresh_token = 3;
   */
  refreshToken: string;
  /**
   * @generated from field: optional string access_token = 4;
   */
  accessToken: string;
  /**
   * @generated from field: optional bool had_remote_interaction = 5;
   */
  hadRemoteInteraction: boolean;
  /**
   * @generated from field: optional string account_name = 6;
   */
  accountName: string;
  /**
   * @generated from field: optional string new_guard_data = 7;
   */
  newGuardData: string;
  /**
   * @generated from field: optional string agreement_session_url = 8;
   */
  agreementSessionUrl: string;
};
/**
 * Describes the message CAuthentication_PollAuthSessionStatus_Response.
 * Use `create(CAuthentication_PollAuthSessionStatus_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_PollAuthSessionStatus_ResponseSchema: GenMessage<CAuthentication_PollAuthSessionStatus_Response>;
/**
 * @generated from message CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response
 */
type CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response = Message<"CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response"> & {
  /**
   * @generated from field: optional string agreement_session_url = 7;
   */
  agreementSessionUrl: string;
};
/**
 * Describes the message CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response.
 * Use `create(CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema: GenMessage<CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response>;
/**
 * @generated from message CAuthentication_GetAuthSessionsForAccount_Response
 */
type CAuthentication_GetAuthSessionsForAccount_Response = Message<"CAuthentication_GetAuthSessionsForAccount_Response"> & {
  /**
   * @generated from field: repeated uint64 client_ids = 1;
   */
  clientIds: bigint[];
};
/**
 * Describes the message CAuthentication_GetAuthSessionsForAccount_Response.
 * Use `create(CAuthentication_GetAuthSessionsForAccount_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_GetAuthSessionsForAccount_ResponseSchema: GenMessage<CAuthentication_GetAuthSessionsForAccount_Response>;
/**
 * @generated from message CAuthentication_RefreshToken_Revoke_Response
 */
type CAuthentication_RefreshToken_Revoke_Response = Message<"CAuthentication_RefreshToken_Revoke_Response"> & {};
/**
 * Describes the message CAuthentication_RefreshToken_Revoke_Response.
 * Use `create(CAuthentication_RefreshToken_Revoke_ResponseSchema)` to create a new message.
 */
declare const CAuthentication_RefreshToken_Revoke_ResponseSchema: GenMessage<CAuthentication_RefreshToken_Revoke_Response>;
/**
 * @generated from enum EAuthTokenPlatformType
 */
declare enum EAuthTokenPlatformType$1 {
  /**
   * @generated from enum value: k_EAuthTokenPlatformType_Unknown = 0;
   */
  k_EAuthTokenPlatformType_Unknown = 0,
  /**
   * @generated from enum value: k_EAuthTokenPlatformType_SteamClient = 1;
   */
  k_EAuthTokenPlatformType_SteamClient = 1,
  /**
   * @generated from enum value: k_EAuthTokenPlatformType_WebBrowser = 2;
   */
  k_EAuthTokenPlatformType_WebBrowser = 2,
  /**
   * @generated from enum value: k_EAuthTokenPlatformType_MobileApp = 3;
   */
  k_EAuthTokenPlatformType_MobileApp = 3
}
/**
 * @generated from enum EAuthTokenAppType
 */
declare enum EAuthTokenAppType {
  /**
   * @generated from enum value: k_EAuthTokenAppType_Unknown = 0;
   */
  k_EAuthTokenAppType_Unknown = 0,
  /**
   * @generated from enum value: k_EAuthTokenAppType_Mobile_SteamApp = 1;
   */
  k_EAuthTokenAppType_Mobile_SteamApp = 1,
  /**
   * @generated from enum value: k_EAuthTokenAppType_Mobile_ChatApp = 2;
   */
  k_EAuthTokenAppType_Mobile_ChatApp = 2
}
/**
 * @generated from enum EAuthSessionGuardType
 */
declare enum EAuthSessionGuardType$1 {
  /**
   * @generated from enum value: k_EAuthSessionGuardType_Unknown = 0;
   */
  k_EAuthSessionGuardType_Unknown = 0,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_None = 1;
   */
  k_EAuthSessionGuardType_None = 1,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_EmailCode = 2;
   */
  k_EAuthSessionGuardType_EmailCode = 2,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_DeviceCode = 3;
   */
  k_EAuthSessionGuardType_DeviceCode = 3,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_DeviceConfirmation = 4;
   */
  k_EAuthSessionGuardType_DeviceConfirmation = 4,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_EmailConfirmation = 5;
   */
  k_EAuthSessionGuardType_EmailConfirmation = 5,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_MachineToken = 6;
   */
  k_EAuthSessionGuardType_MachineToken = 6,
  /**
   * @generated from enum value: k_EAuthSessionGuardType_LegacyMachineAuth = 7;
   */
  k_EAuthSessionGuardType_LegacyMachineAuth = 7
}
/**
 * @generated from enum ESessionPersistence
 */
declare enum ESessionPersistence$1 {
  /**
   * @generated from enum value: k_ESessionPersistence_Invalid = -1;
   */
  k_ESessionPersistence_Invalid = -1,
  /**
   * @generated from enum value: k_ESessionPersistence_Ephemeral = 0;
   */
  k_ESessionPersistence_Ephemeral = 0,
  /**
   * @generated from enum value: k_ESessionPersistence_Persistent = 1;
   */
  k_ESessionPersistence_Persistent = 1
}
//#endregion
//#region src/auth/AuthClient.d.ts
type BeginRequest = MessageInitShape<typeof CAuthentication_BeginAuthSessionViaCredentials_RequestSchema>;
declare class AuthClient {
  private readonly transport;
  constructor(http: HttpClient);
  getPasswordRSAPublicKey(accountName: string): Promise<MessageShape<typeof CAuthentication_GetPasswordRSAPublicKey_ResponseSchema>>;
  beginAuthSessionViaCredentials(req: BeginRequest): Promise<MessageShape<typeof CAuthentication_BeginAuthSessionViaCredentials_ResponseSchema>>;
  pollAuthSessionStatus(clientId: bigint, requestId: Uint8Array): Promise<MessageShape<typeof CAuthentication_PollAuthSessionStatus_ResponseSchema>>;
  updateAuthSessionWithSteamGuardCode(clientId: bigint, steamid: bigint, code: string, codeType: number): Promise<MessageShape<typeof CAuthentication_UpdateAuthSessionWithSteamGuardCode_ResponseSchema>>;
  getAuthSessionsForAccount(accessToken: string): Promise<MessageShape<typeof CAuthentication_GetAuthSessionsForAccount_ResponseSchema>>;
  revokeRefreshToken(accessToken: string, revokeAction: number): Promise<MessageShape<typeof CAuthentication_RefreshToken_Revoke_ResponseSchema>>;
  private send;
}
//#endregion
//#region src/core/enums.d.ts
declare enum ETradeOfferState {
  Invalid = 1,
  Active = 2,
  Accepted = 3,
  Countered = 4,
  Expired = 5,
  Canceled = 6,
  Declined = 7,
  InvalidItems = 8,
  CreatedNeedsConfirmation = 9,
  CanceledBySecondFactor = 10,
  InEscrow = 11,
  /** Trade was reverted by the user (Trade protection update 2025) */
  Reverted = 12
}
declare enum ETradeStatus {
  Init = 0,
  PreCommitted = 1,
  Committed = 2,
  Complete = 3,
  Failed = 4,
  PartialSupportRollback = 5,
  FullSupportRollback = 6,
  SupportRollback_Selective = 7,
  RollbackFailed = 8,
  RollbackAbandoned = 9,
  InEscrow = 10,
  EscrowRollback = 11,
  /** Trade was reverted by the user (Trade protection update 2025) */
  Reverted = 12
}
declare enum EConfirmationMethod {
  None = 0,
  Email = 1,
  MobileApp = 2
}
declare enum EConfirmationType {
  Invalid = 0,
  Generic = 1,
  Trade = 2,
  MarketListing = 3,
  FeatureOptOut = 4,
  PhoneNumberChange = 5,
  AccountRecovery = 6,
  BuyOrder = 12
}
declare enum EOfferFilter {
  ActiveOnly = 1,
  HistoricalOnly = 2,
  All = 3
}
declare enum EAuthTokenPlatformType {
  Unknown = 0,
  SteamClient = 1,
  WebBrowser = 2,
  MobileApp = 3
}
declare enum ESessionPersistence {
  Invalid = -1,
  Ephemeral = 0,
  Persistent = 1
}
declare enum EAuthSessionGuardType {
  Unknown = 0,
  None = 1,
  EmailCode = 2,
  DeviceCode = 3,
  DeviceConfirmation = 4,
  EmailConfirmation = 5,
  MachineToken = 6,
  LegacyMachineAuth = 7
}
declare enum EAuthTokenRevokeAction {
  Logout = 0,
  Permanent = 1,
  Replaced = 2,
  Support = 3,
  Consume = 4,
  NonRememberedLogout = 5,
  NonRememberedPermanent = 6,
  Automatic = 7
}
declare enum ETokenRenewalType {
  None = 0,
  Allow = 1
}
declare enum EResult {
  Invalid = 0,
  OK = 1,
  Fail = 2,
  NoConnection = 3,
  InvalidPassword = 5,
  LoggedInElsewhere = 6,
  InvalidProtocolVer = 7,
  InvalidParam = 8,
  FileNotFound = 9,
  Busy = 10,
  InvalidState = 11,
  InvalidName = 12,
  InvalidEmail = 13,
  DuplicateName = 14,
  AccessDenied = 15,
  Timeout = 16,
  Banned = 17,
  AccountNotFound = 18,
  InvalidSteamID = 19,
  ServiceUnavailable = 20,
  NotLoggedOn = 21,
  Pending = 22,
  EncryptionFailure = 23,
  InsufficientPrivilege = 24,
  LimitExceeded = 25,
  Revoked = 26,
  Expired = 27,
  AlreadyRedeemed = 28,
  DuplicateRequest = 29,
  AlreadyOwned = 30,
  IPNotFound = 31,
  PersistFailed = 32,
  LockingFailed = 33,
  LogonSessionReplaced = 34,
  ConnectFailed = 35,
  HandshakeFailed = 36,
  IOFailure = 37,
  RemoteDisconnect = 38,
  ShoppingCartNotFound = 39,
  Blocked = 40,
  Ignored = 41,
  NoMatch = 42,
  AccountDisabled = 43,
  ServiceReadOnly = 44,
  AccountNotFeatured = 45,
  AdministratorOK = 46,
  ContentVersion = 47,
  TryAnotherCM = 48,
  PasswordRequiredToKickSession = 49,
  AlreadyLoggedInElsewhere = 50,
  Suspended = 51,
  Cancelled = 52,
  DataCorruption = 53,
  DiskFull = 54,
  RemoteCallFailed = 55,
  PasswordUnset = 56,
  ExternalAccountUnlinked = 57,
  PSNTicketInvalid = 58,
  ExternalAccountAlreadyLinked = 59,
  RemoteFileConflict = 60,
  IllegalPassword = 61,
  SameAsPreviousValue = 62,
  AccountLogonDenied = 63,
  CannotUseOldPassword = 64,
  InvalidLoginAuthCode = 65,
  AccountLogonDeniedNoMail = 66,
  HardwareNotCapableOfIPT = 67,
  IPTInitError = 68,
  ParentalControlRestricted = 69,
  FacebookQueryError = 70,
  ExpiredLoginAuthCode = 71,
  IPLoginRestrictionFailed = 72,
  AccountLockedDown = 73,
  AccountLogonDeniedVerifiedEmailRequired = 74,
  NoMatchingURL = 75,
  BadResponse = 76,
  RequirePasswordReEntry = 77,
  ValueOutOfRange = 78,
  UnexpectedError = 79,
  Disabled = 80,
  InvalidCEGSubmission = 81,
  RestrictedDevice = 82,
  RegionLocked = 83,
  RateLimitExceeded = 84,
  AccountLoginDeniedNeedTwoFactor = 85,
  ItemDeleted = 86,
  AccountLoginDeniedThrottle = 87,
  TwoFactorCodeMismatch = 88,
  TwoFactorActivationCodeMismatch = 89,
  AccountAssociatedToMultiplePartners = 90,
  NotModified = 91,
  NoMobileDevice = 92,
  TimeNotSynced = 93,
  SMSCodeFailed = 94,
  AccountLimitExceeded = 95,
  AccountActivityLimitExceeded = 96,
  PhoneActivityLimitExceeded = 97,
  RefundToWallet = 98,
  EmailSendFailure = 99,
  NotSettled = 100,
  NeedCaptcha = 101,
  GSLTDenied = 102,
  GSOwnerDenied = 103,
  InvalidItemType = 104,
  IPBanned = 105,
  GSLTExpired = 106,
  InsufficientFunds = 107,
  TooManyPending = 108,
  NoSiteLicensesFound = 109,
  WGNetworkSendExceeded = 110,
  AccountNotFriends = 111,
  LimitedUserAccount = 112
}
//#endregion
//#region src/auth/CredentialSession.d.ts
interface CredentialSessionEvents {
  debug: [message: string];
  authenticated: [];
  timeout: [];
  error: [error: Error];
  steamGuardRequired: [info: {
    type: EAuthSessionGuardType;
    message: string;
  }];
  remoteInteraction: [];
}
interface CredentialStartOptions {
  username: string;
  password: string;
  sharedSecret?: string;
  steamGuardCode?: string;
}
declare class CredentialSession extends EventEmitter<CredentialSessionEvents> {
  private readonly profile;
  private readonly pollTimeoutMs;
  private readonly auth;
  private clientId;
  private requestId;
  private pollIntervalMs;
  private allowedConfirmations;
  private deadline;
  private pollTimer;
  private settled;
  private remoteInteractionEmitted;
  steamID: SteamID | undefined;
  username: string;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  constructor(http: HttpClient, profile: MobileProfile, pollTimeoutMs?: number);
  start(opts: CredentialStartOptions): Promise<void>;
  submitSteamGuardCode(code: string): Promise<void>;
  stop(): void;
  private answerConfirmations;
  private submitCode;
  private schedulePoll;
  private poll;
  private emitRemoteInteraction;
  private fail;
}
//#endregion
//#region src/auth/loginWithCredentials.d.ts
interface LoginWithCredentialsOptions {
  username: string;
  password: string;
  sharedSecret?: string;
  steamGuardCode?: string;
  proxy?: string;
  mobileProfile?: MobilePlatform | Partial<MobileProfile>;
  signal?: AbortSignal;
  onSteamGuardRequired?: (info: {
    type: number;
    message: string;
  }) => Promise<string> | string;
}
interface LoginResult {
  refreshToken: string;
  accessToken: string | undefined;
  steamId: string;
  username: string;
}
declare function loginWithCredentials(opts: LoginWithCredentialsOptions): Promise<LoginResult>;
//#endregion
//#region src/models/EconItem.d.ts
interface SteamTag {
  category: string;
  internal_name: string;
  localized_category_name?: string;
  category_name?: string;
  localized_tag_name?: string;
  name?: string;
  color?: string;
}
interface SteamDescriptionLine {
  type: string;
  value: string;
  color?: string;
  name?: string;
}
interface SteamAction {
  link: string;
  name: string;
  type?: string;
}
interface AssetProperty {
  propertyid: number;
  int_value?: string;
  float_value?: string;
  string_value?: string;
}
interface RawInventoryAsset {
  appid?: number | string;
  contextid?: string;
  assetid?: string;
  id?: string;
  classid: string;
  instanceid?: string;
  amount: string;
  currencyid?: string;
  pos?: number;
  [key: string]: unknown;
}
interface RawDescription {
  appid?: number | string;
  classid: string;
  instanceid?: string;
  icon_url?: string;
  name?: string;
  type?: string;
  market_name?: string;
  market_hash_name?: string;
  tradable?: number | boolean;
  marketable?: number | boolean;
  commodity?: number | boolean;
  market_tradable_restriction?: number | string;
  market_marketable_restriction?: number | string;
  descriptions?: SteamDescriptionLine[];
  owner_descriptions?: SteamDescriptionLine[];
  actions?: SteamAction[];
  market_actions?: SteamAction[];
  fraudwarnings?: string[];
  tags?: SteamTag[];
  [key: string]: unknown;
}
interface RawAssetPropertyEntry {
  appid: number;
  contextid: string;
  assetid: string;
  asset_properties: AssetProperty[];
}
interface RawInventoryResponse {
  assets?: RawInventoryAsset[];
  descriptions?: RawDescription[];
  asset_properties?: RawAssetPropertyEntry[];
  more_items?: number;
  last_assetid?: string;
  total_inventory_count?: number;
  success?: number;
  error?: string;
  Error?: string;
}
interface RawPartnerInventoryResponse {
  success?: boolean;
  error?: string;
  Error?: string;
  rgInventory?: Record<string, RawInventoryAsset> | unknown[];
  rgDescriptions?: Record<string, RawDescription> | unknown[];
  rgAssetProperties?: Record<string, AssetProperty[]> | unknown[];
  more?: boolean;
  more_start?: number | boolean;
}
interface EconItem {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: number;
  currencyid?: string;
  name: string;
  market_name: string;
  market_hash_name: string;
  type: string;
  name_color?: string;
  background_color?: string;
  icon_url: string;
  icon_url_large?: string;
  tradable: boolean;
  marketable: boolean;
  commodity: boolean;
  market_tradable_restriction: number;
  market_marketable_restriction: number;
  descriptions: SteamDescriptionLine[];
  owner_descriptions: SteamDescriptionLine[];
  actions: SteamAction[];
  market_actions: SteamAction[];
  fraudwarnings: string[];
  tags: SteamTag[];
  asset_properties: AssetProperty[];
  [key: string]: unknown;
}
declare function parseInventory(body: RawInventoryResponse, contextid: string, tradableOnly?: boolean): EconItem[];
declare function parsePartnerInventory(body: RawPartnerInventoryResponse, contextid: string, tradableOnly?: boolean): EconItem[];
//#endregion
//#region src/core/types.d.ts
type OfferTarget = {
  tradeUrl: string;
  steamId?: never;
  token?: never;
} | {
  steamId: string;
  token?: string;
  tradeUrl?: never;
};
interface TradeItem {
  appid: number;
  contextid: string;
  assetid: string;
  amount?: number;
}
interface RawAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  missing?: boolean;
  est_usd?: string;
  [key: string]: unknown;
}
interface RawCEconTradeOffer {
  tradeofferid: string;
  accountid_other: number;
  message?: string;
  expiration_time: number;
  trade_offer_state: number;
  items_to_give?: RawAsset[];
  items_to_receive?: RawAsset[];
  is_our_offer: boolean;
  time_created: number;
  time_updated: number;
  tradeid?: string;
  from_real_time_trade: boolean;
  escrow_end_date: number;
  confirmation_method: number;
  eresult?: number;
  delay_settlement?: boolean;
  settlement_date?: number;
  [key: string]: unknown;
}
interface RawGetTradeOffersResponse {
  trade_offers_sent?: RawCEconTradeOffer[];
  trade_offers_received?: RawCEconTradeOffer[];
  descriptions?: RawDescription[];
  next_cursor?: number;
}
interface RawExchangeAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  new_assetid?: string;
  new_contextid?: string;
  rollback_new_assetid?: string;
  rollback_new_contextid?: string;
  currencyid?: string;
  [key: string]: unknown;
}
interface RawTradeStatus {
  tradeid: string;
  steamid_other?: string;
  time_init: number;
  time_settlement?: number;
  status: number;
  assets_received?: RawExchangeAsset[];
  assets_given?: RawExchangeAsset[];
  time_mod?: number;
  [key: string]: unknown;
}
interface RawGetTradeStatusResponse {
  trades?: RawTradeStatus[];
  descriptions?: RawDescription[];
}
interface WebTradeEligibility {
  allowed: number;
  reason: number;
  allowed_at_time: number;
  steamguard_required_days: number;
  new_device_cooldown_days: number;
  expiration: number;
  time_checked: number;
  [key: string]: unknown;
}
interface RawMarketListing {
  listingid: string;
  price: number;
  fee: number;
  asset?: RawMarketListingAsset;
  [key: string]: unknown;
}
interface RawMarketListingAsset {
  appid: number;
  id: string;
  amount: string;
  market_hash_name: string;
  [key: string]: unknown;
}
interface RawMarketBuyOrder {
  buy_orderid: string;
  appid: number;
  hash_name: string;
  price: number | string;
  quantity: number | string;
  quantity_remaining: number | string;
  description?: RawDescription;
  [key: string]: unknown;
}
interface RawMyListingsResponse {
  success?: boolean | number;
  num_active_listings?: number;
  listings?: RawMarketListing[];
  results?: {
    listings?: RawMarketListing[];
    [key: string]: unknown;
  };
  listings_to_confirm?: RawMarketListing[];
  buy_orders?: RawMarketBuyOrder[];
  [key: string]: unknown;
}
interface RawMarketHistoryAsset {
  classid?: string;
  instanceid?: string;
  unowned_contextid?: string;
  unowned_id?: string;
  market_hash_name?: string;
  [key: string]: unknown;
}
interface RawMarketHistoryResponse {
  success?: boolean | number;
  total_count?: number;
  results_html?: string;
  hovers?: string;
  assets?: Record<string, Record<string, Record<string, RawMarketHistoryAsset>>>;
  [key: string]: unknown;
}
interface RawOrderbookData {
  eCurrency: number;
  amtMinSellOrder?: number | null;
  amtMaxBuyOrder?: number | null;
  rgCompactSellOrders?: number[];
  rgCompactBuyOrders?: number[];
  [key: string]: unknown;
}
type RawPriceHistoryPoint = [date: string, price: number, volume: string];
interface RawPriceHistoryResponse {
  success?: boolean | number;
  prices?: RawPriceHistoryPoint[];
  [key: string]: unknown;
}
interface RawMarketSearchResult {
  hash_name: string;
  sell_listings: number;
  asset_description: RawDescription;
  [key: string]: unknown;
}
interface RawMarketSearchResponse {
  results?: RawMarketSearchResult[];
  [key: string]: unknown;
}
interface RawSellItemResponse {
  success?: boolean | number;
  message?: string;
  [key: string]: unknown;
}
interface RawCreateBuyOrderResponse {
  success?: boolean | number;
  buy_orderid?: string | number;
  message?: string;
  need_confirmation?: boolean;
  confirmation?: {
    confirmation_id?: string | number;
    [key: string]: unknown;
  };
  wallet_info?: {
    success?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
interface RawCancelBuyOrderResponse {
  success?: boolean | number;
  [key: string]: unknown;
}
interface RawWalletDetails {
  has_wallet?: boolean;
  user_country_code?: string;
  wallet_country_code?: string;
  wallet_state?: string;
  balance?: string;
  delayed_balance?: string;
  currency_code?: number;
  time_most_recent_txn?: number;
  most_recent_txnid?: string;
  balance_in_usd?: string;
  delayed_balance_in_usd?: string;
  has_wallet_in_other_regions?: boolean;
  other_regions?: number[];
  formatted_balance?: string;
  [key: string]: unknown;
}
//#endregion
//#region src/http/webApi.d.ts
type Scalar = string | number | boolean;
interface ApiCallParams {
  httpMethod: "GET" | "POST";
  iface: string;
  method: string;
  version?: number;
  input?: Record<string, Scalar | undefined>;
  retryAfterMs?: number | null;
}
type ApiBody = {
  response?: Record<string, unknown>;
} & Record<string, unknown>;
declare class WebApiClient {
  private readonly http;
  private readonly getAccessToken;
  constructor(http: HttpClient, getAccessToken: () => Promise<string>);
  call<T = ApiBody>(params: ApiCallParams): Promise<T>;
}
//#endregion
//#region src/session/SessionManager.d.ts
interface SessionManagerEvents {
  refreshToken: [token: string];
  sessionExpired: [error: Error];
  debug: [message: string];
}
declare class SessionManager extends EventEmitter<SessionManagerEvents> {
  refreshToken: string;
  accessToken: string | undefined;
  readonly steamID: SteamID;
  private readonly http;
  private readonly protoPost;
  private minting;
  private revoked;
  constructor(http: HttpClient, refreshToken: string);
  getAccessToken(): Promise<string>;
  listSessions(): Promise<bigint[]>;
  logout(action?: EAuthTokenRevokeAction): Promise<void>;
  setRefreshToken(refreshToken: string): Promise<void>;
  private mint;
  private expire;
  private applyLoginCookie;
}
//#endregion
//#region src/community/confirmations.d.ts
interface Confirmation {
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
type ConfKey = string | {
  tag: string;
  key: string;
};
declare class ConfirmationManager {
  private readonly http;
  private readonly steamID;
  private readonly identitySecret;
  private readonly profile;
  private timeOffset;
  private timeOffsetAt;
  private readonly usedConfTimes;
  constructor(http: HttpClient, steamID: SteamID, identitySecret: string | undefined, profile: MobileProfile);
  get hasIdentitySecret(): boolean;
  private deviceId;
  getConfirmations(time: number, key: ConfKey): Promise<Confirmation[]>;
  respondToConfirmation(confID: string | string[], confKey: string | string[], time: number, key: ConfKey, accept: boolean): Promise<void>;
  getPending(): Promise<Confirmation[]>;
  acceptConfirmation(confID: string, nonce: string): Promise<void>;
  rejectConfirmation(confID: string, nonce: string): Promise<void>;
  acceptConfirmations(confs: Pick<Confirmation, "id" | "key">[]): Promise<void>;
  rejectConfirmations(confs: Pick<Confirmation, "id" | "key">[]): Promise<void>;
  acceptAll(): Promise<Confirmation[]>;
  acceptConfirmationForObject(objectID: string): Promise<void>;
  private actOnConfirmations;
  private requireSecret;
  private nextConfTime;
  private getTimeOffset;
  private confParams;
  private getlist;
}
//#endregion
//#region src/community/openid.d.ts
interface OpenidConfirmation {
  location: string;
  params: Record<string, string>;
  steamId: string;
}
interface OpenidCookie {
  name: string;
  value: string;
}
interface OpenidLoginResult {
  steamId: string;
  finalUrl: string;
  cookies: OpenidCookie[];
}
interface OpenidLoginOptions {
  initiateUrl: string;
  cookieHost?: string;
  maxRedirects?: number;
}
declare function parseOpenidForm(html: string): {
  action: string;
  fields: MultipartField[];
} | null;
declare function confirmOpenid(http: HttpClient, interstitialHtml: string, referer?: string): Promise<OpenidConfirmation>;
declare function steamOpenidLogin(http: HttpClient, options: OpenidLoginOptions): Promise<OpenidLoginResult>;
//#endregion
//#region src/community/CommunityNamespace.d.ts
interface GetInventoryOptions {
  steamId?: string;
  tradableOnly?: boolean;
}
interface SteamProfile {
  steamId: string;
  personaName: string;
  avatar: string;
  accountCreated: Date | null;
  tradeBanState: string;
  isLimited: boolean;
  vacBanned: boolean;
  privacyState: string;
}
declare class CommunityNamespace {
  private readonly http;
  private readonly session;
  private readonly confirmations;
  private readonly api;
  constructor(http: HttpClient, session: SessionManager, confirmations: ConfirmationManager, api: WebApiClient);
  acknowledgeTradeProtection(): Promise<void>;
  getTradeURL(): Promise<{
    url: string;
    token: string;
  }>;
  changeTradeURL(): Promise<{
    url: string;
    token: string;
  }>;
  getProfile(steamId?: string): Promise<SteamProfile>;
  getWebTradeEligibility(): Promise<WebTradeEligibility>;
  openidLogin(options: OpenidLoginOptions): Promise<OpenidLoginResult>;
  getSteamLevel(steamId?: string): Promise<number>;
  ensureApiKey(domain?: string): Promise<string | null>;
  private requestApiKey;
  getInventory(appid: number, contextid?: string, options?: GetInventoryOptions): Promise<EconItem[]>;
  private getOwnInventoryItems;
  private getTheirInventory;
}
//#endregion
//#region src/core/errors.d.ts
declare const DEFAULT_RATE_LIMIT_RETRY_MS = 60000;
declare class SteamError extends Error {
  readonly eresult?: number;
  readonly body?: unknown;
  constructor(message: string, options?: {
    eresult?: number;
    body?: unknown;
    cause?: unknown;
  });
}
declare class ProxyError extends SteamError {
  constructor(message: string, options?: {
    cause?: unknown;
  });
}
declare class HttpStatusError extends SteamError {
  readonly statusCode: number;
  constructor(statusCode: number, message?: string, body?: unknown);
}
declare class SteamSessionExpiredError extends SteamError {
  constructor(message?: string);
}
declare class OpenIdError extends SteamError {
  constructor(message: string);
}
declare class RateLimitError extends SteamError {
  readonly statusCode: number | undefined;
  readonly retryAfterMs: number;
  readonly unlockAt: number;
  constructor(options?: {
    message?: string;
    body?: unknown;
    retryAfterMs?: number;
    eresult?: number;
    statusCode?: number;
  });
}
declare class ThrottledError extends SteamError {
  readonly statusCode = 403;
  constructor(message?: string, options?: {
    body?: unknown;
  });
}
declare class EscrowError extends SteamError {
  readonly escrowDays: number;
  constructor(escrowDays: number, message?: string);
}
declare class TradeBanError extends SteamError {
  constructor(message?: string);
}
declare class OfferLimitError extends SteamError {
  constructor(message?: string);
}
declare class NewDeviceError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
  });
}
declare class TargetCannotTradeError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
  });
}
declare class ItemServerUnavailableError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
  });
}
declare class ConfirmationError extends SteamError {
  constructor(message: string);
}
declare class FamilyViewError extends SteamError {
  constructor(message?: string);
}
declare class PrivateInventoryError extends SteamError {
  constructor(message?: string);
}
declare class MarketConfirmationLimitError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
    body?: unknown;
  });
}
declare class WalletBalanceLimitError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
    body?: unknown;
  });
}
declare class MarketBlockedError extends SteamError {
  constructor(message?: string, options?: {
    eresult?: number;
    body?: unknown;
  });
}
declare class LoginError extends SteamError {
  readonly extendedErrorMessage: string | undefined;
  readonly isTransient: boolean;
  constructor(message: string, options?: {
    eresult?: number;
    body?: unknown;
    extendedErrorMessage?: string;
  });
}
declare class NoMobileAuthenticatorError extends LoginError {
  constructor(message?: string);
}
//#endregion
//#region src/community/userDetails.d.ts
interface UserSideDetails {
  personaName: string;
  contexts: Record<string, unknown> | null;
  escrowDays: number;
  avatarIcon: string | undefined;
  avatarMedium: string | undefined;
  avatarFull: string | undefined;
}
interface UserPartnerDetails extends UserSideDetails {
  probation: boolean;
}
interface UserDetails {
  me: UserSideDetails;
  them: UserPartnerDetails;
}
//#endregion
//#region src/core/constants.d.ts
declare const LANG: {
  readonly l: "english";
  readonly language: "en";
};
declare const URLS: {
  readonly community: "https://steamcommunity.com";
  readonly store: "https://store.steampowered.com";
  readonly help: "https://help.steampowered.com";
  readonly api: "https://api.steampowered.com";
};
declare const DEFAULT_CONTEXTID = "2";
//#endregion
//#region src/core/eresults.d.ts
declare const TRANSIENT_ERESULTS: ReadonlySet<number>;
declare function isTransientEResult(eresult: number | undefined): boolean;
declare const TERMINAL_AUTH_ERESULTS: ReadonlySet<number>;
declare function isTerminalAuthEResult(eresult: number | undefined): boolean;
//#endregion
//#region src/core/offerState.d.ts
declare function isTerminalState(state: ETradeOfferState): boolean;
//#endregion
//#region src/core/rateLimits.d.ts
type RateLimit = {
  type: "window";
  windowMs: number;
  max: number;
} | {
  type: "bucket";
  capacity: number;
  refillMs: number;
};
declare const RATE_LIMITS: {
  readonly partnerInventory: {
    readonly type: "window";
    readonly windowMs: 120000;
    readonly max: 30;
  };
  readonly inventory: null;
  readonly GetTradeHistory: {
    readonly type: "bucket";
    readonly capacity: 25;
    readonly refillMs: 15000;
  };
  readonly GetTradeHoldDurations: {
    readonly type: "bucket";
    readonly capacity: 3750;
    readonly refillMs: 5;
  };
  readonly GetTradeOffer: {
    readonly type: "bucket";
    readonly capacity: 3750;
    readonly refillMs: 5;
  };
  readonly GetTradeOffers: {
    readonly type: "bucket";
    readonly capacity: 85;
    readonly refillMs: 125;
  };
  readonly GetTradeOffersSummary: {
    readonly type: "bucket";
    readonly capacity: 85;
    readonly refillMs: 125;
  };
  readonly GetTradeStatus: {
    readonly type: "bucket";
    readonly capacity: 25;
    readonly refillMs: 2000;
  };
};
type RateLimitedEndpoint = keyof typeof RATE_LIMITS;
declare const RETRY_AFTER: Record<RateLimitedEndpoint, number | null>;
//#endregion
//#region src/core/target.d.ts
interface ResolvedTarget {
  steamId: string;
  token: string | undefined;
}
declare function resolveTarget(target: OfferTarget): ResolvedTarget;
//#endregion
//#region src/keyApi/SteamWebApi.d.ts
interface SteamWebApiOptions {
  apiKey: string;
  proxy?: string;
  http?: HttpClient;
}
interface PlayerBans {
  SteamId: string;
  CommunityBanned: boolean;
  VACBanned: boolean;
  NumberOfVACBans: number;
  DaysSinceLastBan: number;
  NumberOfGameBans: number;
  EconomyBan: string;
  [key: string]: unknown;
}
interface PlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  personastate: number;
  communityvisibilitystate: number;
  profilestate?: number;
  lastlogoff?: number;
  commentpermission?: number;
  realname?: string;
  primaryclanid?: string;
  timecreated?: number;
  personastateflags?: number;
  gameid?: string;
  gameserverip?: string;
  gameextrainfo?: string;
  loccountrycode?: string;
  locstatecode?: string;
  loccityid?: number;
  [key: string]: unknown;
}
interface Badge {
  badgeid: number;
  level: number;
  completion_time: number;
  xp: number;
  scarcity: number;
  appid?: number;
  communityitemid?: string;
  border_color?: number;
  [key: string]: unknown;
}
interface PlayerBadges {
  badges: Badge[];
  player_xp: number;
  player_level: number;
  player_xp_needed_to_level_up: number;
  player_xp_needed_current_level: number;
  [key: string]: unknown;
}
declare class SteamWebApi {
  private readonly http;
  private readonly apiKey;
  constructor(options: SteamWebApiOptions);
  getPlayerBans(steamIds: readonly string[]): Promise<PlayerBans[]>;
  getPlayerSummaries(steamIds: readonly string[]): Promise<PlayerSummary[]>;
  getBadges(steamId: string): Promise<PlayerBadges>;
}
//#endregion
//#region src/market/history.d.ts
type MarketHistoryEventType = "sale" | "purchase" | "listing_event";
interface MarketHistoryEvent {
  historyId: string;
  listingid: string;
  eventid: string;
  itemName: string;
  gameName: string;
  listedOn: string;
  actedOn: string;
  displayPrice: string;
  priceInCents: number;
  type: MarketHistoryEventType;
  marketName: string | null;
  appID: number | null;
  contextID: string | null;
  assetID: string | null;
  classID: string | null;
  instanceID: string | null;
  unOwnedContextID: string | null;
  unOwnedID: string | null;
}
interface MarketSale extends MarketHistoryEvent {
  type: "sale";
  receivedAmount: number;
}
interface MarketPurchase extends MarketHistoryEvent {
  type: "purchase";
  paidAmount: number;
}
interface MarketListingEvent extends MarketHistoryEvent {
  type: "listing_event";
}
type MarketHistoryRow = MarketSale | MarketPurchase | MarketListingEvent;
interface MarketHistory {
  events: MarketHistoryRow[];
  sales: MarketSale[];
  purchases: MarketPurchase[];
  listingEvents: MarketListingEvent[];
  totalCount: number | undefined;
}
declare function parseMarketHistory(body: RawMarketHistoryResponse): MarketHistory;
//#endregion
//#region src/market/MarketNamespace.d.ts
interface MyListings {
  listings: RawMarketListing[];
  listings_to_confirm: RawMarketListing[];
  buy_orders: RawMarketBuyOrder[];
  num_active_listings: number;
}
interface SellItemOptions {
  appid: number;
  contextid?: string;
  assetid: string;
  amount?: number;
  price: number;
}
interface CreateBuyOrderOptions {
  appid: number;
  marketHashName: string;
  priceTotal: number;
  quantity: number;
  currency: number;
}
interface ConfirmListingsResult {
  confirmed: Confirmation[];
  skipped: Confirmation[];
}
declare class MarketNamespace {
  private readonly http;
  private readonly session;
  private readonly confirmations;
  private readonly api;
  constructor(http: HttpClient, session: SessionManager, confirmations: ConfirmationManager, api: WebApiClient);
  getWalletDetails(): Promise<RawWalletDetails>;
  getMyListings(options?: {
    currency?: number;
  }): Promise<MyListings>;
  getMyHistory(options?: {
    count?: number;
    start?: number;
  }): Promise<MarketHistory>;
  getOrderbook(appid: number, marketHashName: string, options?: {
    expectedCurrency?: number;
  }): Promise<RawOrderbookData>;
  getPriceHistory(appid: number, marketHashName: string): Promise<RawPriceHistoryPoint[]>;
  getMarketItemDetails(appid: number, marketHashName: string): Promise<RawMarketSearchResult | null>;
  sellItem(options: SellItemOptions): Promise<RawSellItemResponse>;
  cancelListing(listingId: string): Promise<void>;
  createBuyOrder(options: CreateBuyOrderOptions): Promise<string>;
  cancelBuyOrder(buyOrderId: string): Promise<RawCancelBuyOrderResponse>;
  confirmListings(expected: Record<string, number>): Promise<ConfirmListingsResult>;
  rejectListings(types?: EConfirmationType[]): Promise<Confirmation[]>;
  private postBuyOrder;
}
//#endregion
//#region src/market/prices.d.ts
declare function getPriceValueAsInt(strAmount: string | null | undefined): number;
//#endregion
//#region src/models/inspect.d.ts
/**
 * Decode a CS2 masked preview token — the asset_properties propertyid-6
 * "certificate" hex — into a plain JSON object (uint64 ids as strings, camelCase
 * fields, only set fields present). Layout is `[xorKey][protobuf][crc32]`: every
 * byte after the key is XOR'd with it and the trailing 4-byte crc32 dropped.
 * `paintwear` is returned as the float wear (0..1), not its raw uint32 bits.
 * Returns `null` for non-hex input.
 */
declare function decodePreviewToken(hex: string | null | undefined): Record<string, unknown> | null;
/**
 * Encode JSON back into a masked preview token — the inverse of
 * {@link decodePreviewToken}, accepting the same shape it returns. `paintwear` is read as
 * the float wear (0..1) and re-packed into its uint32 bits. `xorKey` 0 leaves the payload
 * readable; any other byte masks it the way CS2's own links do. The checksum is unkeyed
 * crc32, so this is an integrity code and not a signature. Returns `null` if the input is
 * not a valid CEconItemPreviewDataBlock.
 */
declare function encodePreviewToken(data: Record<string, unknown>, xorKey?: number): string | null;
//#endregion
//#region src/trade/exchange.d.ts
interface ExchangeItem extends EconItem {
  new_assetid?: string;
  new_contextid?: string;
  rollback_new_assetid?: string;
  rollback_new_contextid?: string;
}
interface ExchangeDetails {
  status: ETradeStatus;
  tradeInitTime: Date;
  settlementTime: Date | null;
  receivedItems: ExchangeItem[];
  sentItems: ExchangeItem[];
  usedInventoryFallback: boolean;
}
interface TradeHistoryEntry extends ExchangeDetails {
  tradeId: string;
  partnerSteamId: string | undefined;
}
interface TradeHistory {
  trades: TradeHistoryEntry[];
  more: boolean;
  totalTrades: number | undefined;
}
interface TradeHistoryOptions {
  maxTrades?: number;
  startAfterTime?: number;
  startAfterTradeId?: string;
  navigatingBack?: boolean;
  includeFailed?: boolean;
  includeTotal?: boolean;
}
interface TradeOffersSummary {
  pending_received_count: number;
  new_received_count: number;
  updated_received_count: number;
  historical_received_count: number;
  pending_sent_count: number;
  newly_accepted_sent_count: number;
  updated_sent_count: number;
  historical_sent_count: number;
  escrow_received_count: number;
  escrow_sent_count: number;
}
declare function getTradeStatus(api: WebApiClient, tradeId: string): Promise<ExchangeDetails>;
declare function getTradeHistory(api: WebApiClient, opts?: TradeHistoryOptions): Promise<TradeHistory>;
declare function getTradeOffersSummary(api: WebApiClient): Promise<TradeOffersSummary>;
//#endregion
//#region src/trade/TradeNamespace.d.ts
interface EscrowSide {
  escrow_end_duration_seconds: number;
}
interface EscrowHold {
  me: EscrowSide;
  them: EscrowSide;
  both: EscrowSide;
}
declare class TradeNamespace extends EventEmitter<TradeEvents> {
  private readonly api;
  private readonly http;
  private readonly session;
  private readonly confirmations;
  private poller;
  constructor(api: WebApiClient, http: HttpClient, session: SessionManager, confirmations: ConfirmationManager);
  private offerDeps;
  createOffer(target: OfferTarget): TradeOffer;
  getTradeOffer(id: string): Promise<TradeOffer>;
  getTradeOffers(filter?: EOfferFilter, historicalCutoff?: Date): Promise<{
    sent: TradeOffer[];
    received: TradeOffer[];
  }>;
  getTradeStatus(opts: {
    tradeId: string;
  }): Promise<ExchangeDetails>;
  getUserDetails(target: OfferTarget): Promise<UserDetails>;
  getEscrow(target: OfferTarget): Promise<EscrowHold>;
  getTradeHistory(opts?: TradeHistoryOptions): Promise<TradeHistory>;
  getTradeOffersSummary(): Promise<TradeOffersSummary>;
  reconcile(ids: string[]): Promise<Map<string, TradeOffer>>;
  getOffersContainingItems(items: {
    appid: number;
    contextid: string;
    assetid: string;
  }[], includeInactive?: boolean): Promise<TradeOffer[]>;
  startPolling(options?: PollOptions): void;
  stopPolling(): void;
  pollOnce(options?: PollOptions & {
    forceFull?: boolean;
  }): Promise<{
    changes: PollChange[];
    pollData: PollData;
  }>;
  get pollData(): PollData | undefined;
  getInventory(target: OfferTarget, appid: number, contextid?: string, options?: {
    tradableOnly?: boolean;
  }): Promise<EconItem[]>;
}
//#endregion
//#region src/trade/TradeOffer.d.ts
type SendResult = "sent" | "needs_confirmation";
type AcceptResult = "accepted" | "escrow" | "needs_confirmation";
interface TradeOfferDeps {
  http: HttpClient;
  session: SessionManager;
  confirmations: ConfirmationManager;
  trade: TradeNamespace;
}
declare class TradeOffer {
  private readonly deps;
  id: string | undefined;
  readonly partner: SteamID;
  token: string | undefined;
  message: string;
  state: ETradeOfferState;
  itemsToGive: TradeItem[];
  itemsToReceive: TradeItem[];
  isOurOffer: boolean;
  tradeID: string | undefined;
  confirmationMethod: EConfirmationMethod;
  escrowEnds: Date | undefined;
  settlementDate: Date | undefined;
  delaySettlement: boolean;
  created: Date | undefined;
  updated: Date | undefined;
  expires: Date | undefined;
  fromRealTimeTrade: boolean;
  glitched: boolean;
  private countering;
  constructor(deps: TradeOfferDeps, init: {
    partner: SteamID;
    token?: string;
    id?: string;
  });
  static fromData(deps: TradeOfferDeps, raw: RawCEconTradeOffer, descriptions?: Map<string, RawDescription>): TradeOffer;
  containsItem(item: {
    appid: number;
    contextid: string;
    assetid: string;
  }): boolean;
  give(items: TradeItem[]): this;
  receive(items: TradeItem[]): this;
  setMessage(message: string): this;
  send(): Promise<SendResult>;
  accept(): Promise<AcceptResult>;
  cancel(): Promise<void>;
  decline(): Promise<void>;
  confirm(): Promise<void>;
  counter(): TradeOffer;
  getTradeStatus(): Promise<ExchangeDetails>;
  getPartnerInventory(appid: number, contextid?: string, tradableOnly?: boolean): Promise<EconItem[]>;
  getUserDetails(): Promise<UserDetails>;
  private partnerTarget;
  private newOfferReferer;
  private offerReferer;
}
//#endregion
//#region src/trade/pollTypes.d.ts
interface PollData {
  offersSince: number;
  sent: Record<string, ETradeOfferState>;
  received: Record<string, ETradeOfferState>;
  timestamps: Record<string, number>;
  lastFullUpdate?: number;
}
interface PollDataStore {
  load(): Promise<PollData | undefined>;
  save(pollData: PollData): Promise<void>;
}
type PollChange = {
  type: "newOffer";
  offer: TradeOffer;
} | {
  type: "sentOfferChanged";
  offer: TradeOffer;
  oldState: ETradeOfferState;
} | {
  type: "receivedOfferChanged";
  offer: TradeOffer;
  oldState: ETradeOfferState;
} | {
  type: "unknownOfferSent";
  offer: TradeOffer;
};
interface TradeOfferUpdate {
  offer: TradeOffer;
  previousState?: ETradeOfferState;
}
interface PollOptions {
  pollInterval?: number;
  pollFullUpdateInterval?: number;
  pollData?: PollData;
  store?: PollDataStore;
  maxAgeMs?: number;
  cancelTime?: number;
}
interface TradeEvents {
  newOffer: [offer: TradeOffer];
  sentOfferChanged: [offer: TradeOffer, oldState: ETradeOfferState];
  receivedOfferChanged: [offer: TradeOffer, oldState: ETradeOfferState];
  unknownOfferSent: [offer: TradeOffer];
  sentOfferCanceled: [offer: TradeOffer, reason: string];
  offerUpdate: [update: TradeOfferUpdate];
  pollData: [data: PollData];
  pollSuccess: [];
  pollFailure: [error: Error];
  debug: [message: string];
}
//#endregion
//#region src/SteamMobile.d.ts
interface SteamMobileEvents extends TradeEvents {
  refreshToken: [token: string];
  sessionExpired: [error: Error];
}
interface SteamMobileOptions {
  refreshToken: string;
  identitySecret?: string;
  proxy?: string;
  mobileProfile?: MobilePlatform | Partial<MobileProfile>;
  polling?: boolean | PollOptions;
}
type ReauthenticateOptions = Omit<LoginWithCredentialsOptions, "proxy" | "mobileProfile">;
declare class SteamMobile extends EventEmitter<SteamMobileEvents> {
  readonly http: HttpClient;
  readonly session: SessionManager;
  readonly api: WebApiClient;
  readonly confirmations: ConfirmationManager;
  readonly trade: TradeNamespace;
  readonly community: CommunityNamespace;
  readonly market: MarketNamespace;
  readonly identitySecret: string | undefined;
  private readonly polling;
  private readonly proxy;
  private readonly profile;
  constructor(options: SteamMobileOptions);
  login(): Promise<this>;
  reauthenticate(credentials: ReauthenticateOptions): Promise<void>;
  ensureApiKey(domain?: string): Promise<string | null>;
  openidLogin(options: OpenidLoginOptions): Promise<OpenidLoginResult>;
  request<T = string>(method: "GET" | "POST", url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  get<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  post<T = string>(url: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  get steamID(): SteamID;
  get accessToken(): string | undefined;
  get refreshToken(): string;
  shutdown(): Promise<void>;
}
//#endregion
//#region src/session/tokens.d.ts
interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string[];
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}
declare class AccessTokenError extends Error {
  readonly eresult?: number | undefined;
  constructor(message: string, eresult?: number | undefined);
}
declare function decodeJwt(token: string): JwtPayload | null;
declare function secondsUntilExpiry(token: string): number;
//#endregion
//#region src/trade/polling.d.ts
declare const DEFAULT_POLL_INTERVAL = 10000;
declare const DEFAULT_POLL_FULL_UPDATE_INTERVAL = 300000;
declare const DEFAULT_POLL_MAX_AGE_MS = 2592000000;
interface PollSource {
  getTradeOffers(filter: EOfferFilter, historicalCutoff: Date): Promise<{
    sent: TradeOffer[];
    received: TradeOffer[];
  }>;
  emit<K extends keyof TradeEvents>(event: K, ...args: TradeEvents[K]): void;
}
declare class Poller {
  private readonly source;
  pollData: PollData;
  private readonly pollInterval;
  private readonly fullInterval;
  private readonly maxAgeMs;
  private readonly cancelTime;
  private readonly store;
  private timer;
  private running;
  private stopped;
  private loaded;
  constructor(source: PollSource, options?: PollOptions);
  start(): void;
  stop(): void;
  poll(forceFull?: boolean): Promise<number>;
  pollOnce(forceFull?: boolean): Promise<{
    changes: PollChange[];
    pollData: PollData;
  }>;
  private loadFromStore;
  private persist;
  private schedule;
  private backoffDelay;
  private runCycle;
  private autoCancel;
  private sweepCutoffSeconds;
  private process;
  private record;
  private prune;
  private pruneMap;
  private stamp;
}
//#endregion
export { ANDROID_PROFILE, type AcceptResult, AccessTokenError, type ApiCallParams, type AssetProperty, AuthClient, type Badge, CommunityNamespace, type ConfirmListingsResult, type Confirmation, ConfirmationError, ConfirmationManager, type CreateBuyOrderOptions, CredentialSession, type CredentialSessionEvents, type CredentialStartOptions, DEFAULT_CONTEXTID, DEFAULT_POLL_FULL_UPDATE_INTERVAL, DEFAULT_POLL_INTERVAL, DEFAULT_POLL_MAX_AGE_MS, DEFAULT_RATE_LIMIT_RETRY_MS, EAuthSessionGuardType, EAuthTokenPlatformType, EAuthTokenRevokeAction, EConfirmationMethod, EConfirmationType, EOfferFilter, EResult, ESessionPersistence, ETokenRenewalType, ETradeOfferState, ETradeStatus, type EconItem, EscrowError, type EscrowHold, type EscrowSide, type ExchangeDetails, type ExchangeItem, FamilyViewError, type GetInventoryOptions, HttpClient, type HttpResponse, HttpStatusError, IOS_PROFILE, ItemServerUnavailableError, type JwtPayload, LANG, LoginError, type LoginResult, type LoginWithCredentialsOptions, MarketBlockedError, MarketConfirmationLimitError, type MarketHistory, type MarketHistoryEvent, type MarketHistoryEventType, type MarketHistoryRow, type MarketListingEvent, MarketNamespace, type MarketPurchase, type MarketSale, type MobilePlatform, type MobileProfile, type MyListings, NewDeviceError, NoMobileAuthenticatorError, OfferLimitError, OfferTarget, OpenIdError, type OpenidConfirmation, type OpenidCookie, type OpenidLoginOptions, type OpenidLoginResult, type PlayerBadges, type PlayerBans, type PlayerSummary, type PollChange, type PollData, type PollDataStore, type PollOptions, type PollSource, Poller, PrivateInventoryError, ProxyError, RATE_LIMITS, RETRY_AFTER, type RateLimit, RateLimitError, type RateLimitedEndpoint, RawAsset, type RawAssetPropertyEntry, RawCEconTradeOffer, RawCancelBuyOrderResponse, RawCreateBuyOrderResponse, type RawDescription, RawExchangeAsset, RawGetTradeOffersResponse, RawGetTradeStatusResponse, type RawInventoryAsset, type RawInventoryResponse, RawMarketBuyOrder, RawMarketHistoryAsset, RawMarketHistoryResponse, RawMarketListing, RawMarketListingAsset, RawMarketSearchResponse, RawMarketSearchResult, RawMyListingsResponse, RawOrderbookData, type RawPartnerInventoryResponse, RawPriceHistoryPoint, RawPriceHistoryResponse, RawSellItemResponse, RawTradeStatus, RawWalletDetails, type ReauthenticateOptions, type RequestOptions, type ResolvedTarget, type SellItemOptions, type SendResult, SessionManager, type SessionManagerEvents, type SteamAction, type SteamDescriptionLine, SteamError, SteamMobile, type SteamMobileEvents, type SteamMobileOptions, type SteamProfile, SteamSessionExpiredError, type SteamTag, SteamWebApi, type SteamWebApiOptions, TERMINAL_AUTH_ERESULTS, TRANSIENT_ERESULTS, TargetCannotTradeError, ThrottledError, TradeBanError, type TradeEvents, type TradeHistory, type TradeHistoryEntry, type TradeHistoryOptions, TradeItem, TradeNamespace, TradeOffer, type TradeOfferDeps, type TradeOfferUpdate, type TradeOffersSummary, URLS, type UserDetails, type UserPartnerDetails, type UserSideDetails, WalletBalanceLimitError, WebApiClient, WebTradeEligibility, confirmOpenid, decodeJwt, decodePreviewToken, encodePreviewToken, getPriceValueAsInt, getTradeHistory, getTradeOffersSummary, getTradeStatus, isTerminalAuthEResult, isTerminalState, isTransientEResult, loginWithCredentials, parseInventory, parseMarketHistory, parseOpenidForm, parsePartnerInventory, resolveMobileProfile, resolveTarget, secondsUntilExpiry, steamOpenidLogin };
//# sourceMappingURL=index.d.mts.map