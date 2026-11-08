import { Client } from "@notionhq/client";
import { LocalStorage, OAuth, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { OAuthService } from "@raycast/utils";

export type NotionAuthType = "oauth" | "internal";
export type NotionAccountId = "account-1" | "account-2";
export type NotionAccount = { id: NotionAccountId; label: string };

const ACTIVE_ACCOUNT_KEY = "NOTION_ACTIVE_ACCOUNT";
const NOTION_CLIENT_ID = "c843219a-d93c-403c-8e4d-e8aa9a987494";
const NOTION_AUTHORIZE_URL = "https://notion.oauth.raycast.com/authorize";
const NOTION_TOKEN_URL = "https://notion.oauth.raycast.com/token";

const notionClients = new Map<string, { token: string; client: Client }>();
const notionOAuthServices = new Map<NotionAccountId, { label: string; service: OAuthService }>();
const authorizeInFlight = new Map<NotionAccountId, Promise<string>>();

function getAuthPreferences() {
  const preferences = getPreferenceValues<Preferences>();
  return {
    authType: (preferences.notion_auth_type || "oauth") as NotionAuthType,
    internalToken: preferences.notion_token?.trim(),
    account1Label: preferences.notion_account_1_label?.trim(),
    account2Label: preferences.notion_account_2_label?.trim(),
  };
}

function sanitizeAccountLabel(label: string) {
  return label
    .normalize("NFKC")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\p{Emoji_Modifier}/gu, "")
    .replace(/[\u200D\uFE0E\uFE0F\u20E3]/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[^\u0020-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAccountLabel(label: string | undefined, fallback: string) {
  return label && label.length > 0 ? label : fallback;
}

export function getNotionAccounts(): NotionAccount[] {
  const { authType, account1Label, account2Label } = getAuthPreferences();
  const accounts: NotionAccount[] = [{ id: "account-1", label: buildAccountLabel(account1Label, "Account 1") }];

  const hasSecondAccount =
    authType === "oauth" && !!account1Label && account1Label.length > 0 && !!account2Label && account2Label.length > 0;

  if (hasSecondAccount) {
    accounts.push({ id: "account-2", label: buildAccountLabel(account2Label, "Account 2") });
  }

  return accounts;
}

export function hasMultipleAccounts() {
  return getNotionAccounts().length > 1;
}

export function getNotionAccount(accountId?: NotionAccountId) {
  if (!accountId) return undefined;
  const account = getNotionAccounts().find((item) => item.id === accountId);
  if (account) return account;
  return { id: accountId, label: accountId === "account-1" ? "Account 1" : "Account 2" };
}

export function getNotionAccountLabel(accountId?: NotionAccountId) {
  if (!accountId) return undefined;
  return getNotionAccount(accountId)?.label;
}

export function resolveAccountIdFromLabel(label?: string): NotionAccountId | undefined {
  if (!label) return undefined;
  const trimmed = label.trim().toLowerCase();
  const sanitized = sanitizeAccountLabel(label).toLowerCase();
  const accounts = getNotionAccounts();
  const matched = accounts.find((account) => {
    const accountLabel = account.label.trim().toLowerCase();
    if (accountLabel === trimmed) return true;
    const accountSanitized = sanitizeAccountLabel(account.label).toLowerCase();
    return sanitized.length > 0 && accountSanitized === sanitized;
  });
  if (matched) return matched.id;
  if (trimmed === "account 1" || trimmed === "account1" || trimmed === "1" || sanitized === "account 1") return "account-1";
  if (trimmed === "account 2" || trimmed === "account2" || trimmed === "2" || sanitized === "account 2") return "account-2";
  return undefined;
}

export function resolveAccountIdForTool(accountLabel?: string): NotionAccountId {
  const accounts = getNotionAccounts();
  const accountId = resolveAccountIdFromLabel(accountLabel);

  if (accountLabel && !accountId) {
    throw new Error(`Unknown Notion account label: ${accountLabel}`);
  }

  if (accounts.length > 1 && !accountId) {
    throw new Error("Multiple Notion accounts are configured. Please specify which account to use.");
  }

  return accountId ?? accounts[0]?.id ?? "account-1";
}

export function getDefaultAccountId(): NotionAccountId {
  const accounts = getNotionAccounts();
  return accounts[0]?.id ?? "account-1";
}

export async function getActiveAccountId(): Promise<NotionAccountId> {
  const stored = await LocalStorage.getItem<string>(ACTIVE_ACCOUNT_KEY);
  const accounts = getNotionAccounts();
  const fallback = accounts[0]?.id ?? "account-1";
  if (stored && accounts.some((account) => account.id === stored)) return stored as NotionAccountId;
  return fallback;
}

export async function setActiveAccountId(accountId: NotionAccountId) {
  await LocalStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
}

function getCachedClient(cacheKey: string, token: string) {
  const cached = notionClients.get(cacheKey);
  if (cached && cached.token === token) return cached.client;
  const client = new Client({ auth: token });
  notionClients.set(cacheKey, { token, client });
  return client;
}

function oauthProviderName(account: NotionAccount) {
  const safeLabel = sanitizeAccountLabel(account.label);
  const label = safeLabel.length > 0 ? safeLabel : account.id === "account-2" ? "Account 2" : "Account 1";
  return `Notion (${label})`;
}

function createOAuthClient(account: NotionAccount) {
  return new OAuth.PKCEClient({
    redirectMethod: OAuth.RedirectMethod.Web,
    providerName: oauthProviderName(account),
    providerIcon: "notion-logo.png",
    providerId: `notion-${account.id}`,
    description: "Connect your Notion account",
  });
}

function createOAuthService(account: NotionAccount) {
  const client = createOAuthClient(account);
  return new OAuthService({
    client,
    clientId: NOTION_CLIENT_ID,
    scope: "",
    authorizeUrl: NOTION_AUTHORIZE_URL,
    tokenUrl: NOTION_TOKEN_URL,
    extraParameters: { owner: "user" },
  });
}

function getCachedOAuthService(account: NotionAccount) {
  const cached = notionOAuthServices.get(account.id);
  if (cached && cached.label === account.label) return cached.service;

  const service = createOAuthService(account);
  notionOAuthServices.set(account.id, { label: account.label, service });
  return service;
}

export async function getNotionClient(accountId?: NotionAccountId) {
  const { authType, internalToken } = getAuthPreferences();

  if (authType === "internal") {
    if (!internalToken) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Internal Integration Secret required",
        message: "Set Authentication Type to OAuth or add your Internal Integration Secret in settings.",
      });
      throw new Error("Internal Integration Secret is not configured");
    }
    return getCachedClient("internal", internalToken);
  }

  const resolvedAccountId = accountId ?? (await getActiveAccountId());
  const account = getNotionAccount(resolvedAccountId) ?? { id: "account-1", label: "Account 1" };
  const existingAuthorize = authorizeInFlight.get(account.id);
  const authorize =
    existingAuthorize ??
    getCachedOAuthService(account)
      .authorize()
      .finally(() => {
        authorizeInFlight.delete(account.id);
      });
  if (!existingAuthorize) {
    authorizeInFlight.set(account.id, authorize);
  }
  const token = await authorize;
  return getCachedClient(account.id, token);
}
