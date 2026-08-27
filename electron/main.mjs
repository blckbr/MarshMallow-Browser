import {
  app,
  BrowserWindow,
  WebContentsView,
  Menu,
  clipboard,
  dialog,
  ipcMain,
  net,
  nativeImage,
  session,
  shell,
  webContents as electronWebContents,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import QRCode from "qrcode";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeContentBounds } from "./lib/geometry.mjs";
import { buildHistoryMenu } from "./lib/navigation-history.mjs";
import { GAME_MODE_DEFAULT, hostnameKey, resolveGameMode, resolveWindowBackgroundPolicy, sanitizeGameDomainSetting } from "./lib/game-mode.mjs";
import { classifyMediaObservation, groupMediaObservations, selectMergePair } from "./lib/media-detection.mjs";
import { compareVersions, sha256File, validateReleaseMetadata } from "./lib/update-verifier.mjs";
import { buildExternalManagerProtocolUrl, normalizeDownloadRecord, trimDownloadHistory, validateDownloaderManagerManifest } from "./lib/download-manager.mjs";
import { isPdfMime, isPdfUrl, shouldInterceptPdfResponse } from "./lib/pdf-routing.mjs";
import { appIconFilename, cleanUserAgentPlatform, defaultNativeBrowser, linuxDefaultBrowserCommands, nativeBrowserCandidatesForPlatform, nativeSystemBrowserLabel, updatePolicyForPlatform } from "./lib/platform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DEV_URL = process.env.MARSHMALLOW_DEV_URL || "http://127.0.0.1:1421";
const TAB_PARTITION = "persist:marshmallow";
const PRIVATE_PARTITION = "mm-private-session";
const DEFAULT_HOME_URL = "marshmallow://newtab";
const LEGACY_DEFAULT_HOME_URL = "https://www.google.com/";
const VERSION = "5.0.2";
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, appIconFilename(process.platform))
  : path.join(ROOT, "build", appIconFilename(process.platform));

// 4.0.10: somente uma instância do MarshMallow pode usar o perfil persistente.
// Isso evita duas instâncias disputando Cache/GPUCache/Service Worker e gerando
// erros "Acesso negado (0x5)" no Windows.
const HAS_SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock();
if (!HAS_SINGLE_INSTANCE_LOCK) {
  app.quit();
}

const CHROME_VERSION = process.versions.chrome || "150.0.0.0";
// Preserve Electron/Chromium's real runtime UA for Google compatibility tests.
// For ordinary sites MarshMallow still omits the Electron token, but Google gets
// the runtime's honest UA so User-Agent and Chromium Client Hints do not claim
// conflicting browser identities.
const NATIVE_RUNTIME_USER_AGENT = app.userAgentFallback;
const CLEAN_USER_AGENT =
  `Mozilla/5.0 (${cleanUserAgentPlatform(process.platform)}) ` +
  `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

const DEFAULT_ACCEPT_LANGUAGES = "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7";

const SEARCH_ENGINES = {
  brave: "https://search.brave.com/search?q=",
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  ecosia: "https://www.ecosia.org/search?q=",
};

const INTERNAL_PAGES = {
  newtab: { title: "Nova aba", url: "marshmallow://newtab" },
  library: { title: "Favoritos e histórico", url: "marshmallow://library" },
  themes: { title: "Temas", url: "marshmallow://themes" },
  settings: { title: "Configurações", url: "marshmallow://settings" },
  extensions: { title: "Extensões", url: "marshmallow://extensions" },
  performance: { title: "Desempenho", url: "marshmallow://performance" },
  support: { title: "Apoie o MarshMallow", url: "marshmallow://support" },
  pdf: { title: "PDF Reader", url: "marshmallow://pdf" },
};

function internalPageMeta(page) {
  return INTERNAL_PAGES[String(page || "")] || null;
}

const BROWSER_PREFERENCES_DEFAULTS = {
  startupMode: "continue",
  startupPages: [],
  homePage: DEFAULT_HOME_URL,
  newTabPage: DEFAULT_HOME_URL,
  searchEngine: "brave",
  addressSuggestionsEnabled: true,
  showHomeButton: false,
  defaultPageZoom: 100,
  defaultFontSize: 16,
  minimumFontSize: 0,
  popupMode: "smart",
  trustedPopupSites: [],
  downloadsAskWhere: true,
  downloadPath: "",
  downloadManagerMode: "builtin",
  doNotTrack: false,
  globalPrivacyControl: false,
  clearBrowsingDataOnExit: false,
  thirdPartyCookieAccess: "allow",
  spellcheckEnabled: true,
  spellcheckLanguages: ["pt-BR"],
  acceptLanguages: DEFAULT_ACCEPT_LANGUAGES,
  autoplayPolicy: "allow",
  backgroundThrottling: true,
  deferBackgroundMediaUntilActivated: true,
  hardwareAcceleration: true,
  proxyMode: "system",
  proxyRules: "",
  webrtcPolicy: "default",
  imageAnimationPolicy: "animate",
  nativeAuthMode: "off",
  nativeBrowser: defaultNativeBrowser(process.platform),
  gameModeByDomain: {},
  permissionDefaults: {
    camera: "ask",
    microphone: "ask",
    location: "ask",
    notifications: "ask",
    clipboard: "ask",
    midi: "ask",
    fullscreen: "allow",
  },
};
const MARSHMALLOW_API_ORIGIN = "https://marshmallow-gateway.marshmallow-browser-br.workers.dev";

const FIRST_PARTY_BACKEND_PATHS = [
  /^\/health(?:\?.*)?$/,
  /^\/api\/auth\/(?:ping|register|login|recover|session|logout)(?:\?.*)?$/,
];

function normalizeBackendPath(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "";
  if (!FIRST_PARTY_BACKEND_PATHS.some((pattern) => pattern.test(raw))) return "";
  return raw;
}

async function requestFirstPartyBackend(input = {}) {
  const route = normalizeBackendPath(input?.path);
  if (!route) return { ok: false, status: 0, body: "", error: "Rota de backend não permitida." };

  const method = String(input?.method || "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    return { ok: false, status: 0, body: "", error: "Método de backend não permitido." };
  }

  const headers = new Headers();
  const incomingHeaders = input?.headers && typeof input.headers === "object" ? input.headers : {};
  if (incomingHeaders.authorization) headers.set("authorization", String(incomingHeaders.authorization).slice(0, 4096));
  if (incomingHeaders["content-type"]) headers.set("content-type", String(incomingHeaders["content-type"]).slice(0, 200));
  headers.set("accept", "application/json");
  headers.set("cache-control", "no-cache");

  let body;
  if (method === "POST" && input?.body != null) {
    body = String(input.body);
    if (Buffer.byteLength(body, "utf8") > 128 * 1024) {
      return { ok: false, status: 0, body: "", error: "Requisição de backend muito grande." };
    }
  }

  try {
    const response = await net.fetch(`${MARSHMALLOW_API_ORIGIN}${route}`, {
      method,
      headers,
      body,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body: text.slice(0, 512 * 1024),
      contentType: response.headers.get("content-type") || "",
      url: response.url || `${MARSHMALLOW_API_ORIGIN}${route}`,
    };
  } catch (error) {
    const message = String(error?.message || error || "Falha de rede");
    console.error(`[Backend] ${method} ${route}: ${message}`);
    return { ok: false, status: 0, body: "", error: message };
  }
}

// 4.0.2: não fazemos mais spoof global do User-Agent. Google usa o UA real
// do Chromium/Electron; outros sites podem receber o UA limpo por WebContents.
// Isto é compatibilidade, não uma tentativa de contornar CAPTCHA/antiabuso.

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function sanitizeBrowserPage(value, fallback = DEFAULT_HOME_URL) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw === "marshmallow://newtab") return raw;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = safeHttpUrl(withScheme);
  return url?.href || fallback;
}

function normalizeTrustedPopupSite(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.hostname.replace(/^www\./i, "").replace(/\.$/, "").slice(0, 253);
  } catch {
    return "";
  }
}

function sanitizeTrustedPopupSites(values) {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map(normalizeTrustedPopupSite).filter(Boolean))].slice(0, 200);
}

function sanitizePreferences(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const permissions = source.permissionDefaults && typeof source.permissionDefaults === "object" ? source.permissionDefaults : {};
  const mode = (value, allowed, fallback) => allowed.includes(String(value)) ? String(value) : fallback;
  const pages = Array.isArray(source.startupPages) ? source.startupPages : [];
  return {
    startupMode: mode(source.startupMode, ["continue", "newtab", "home", "custom"], BROWSER_PREFERENCES_DEFAULTS.startupMode),
    startupPages: pages.map((item) => String(item || "").trim().slice(0, 2048)).filter(Boolean).slice(0, 12),
    homePage: String(!source.homePage || String(source.homePage).trim() === LEGACY_DEFAULT_HOME_URL ? BROWSER_PREFERENCES_DEFAULTS.homePage : source.homePage).trim().slice(0, 2048) || BROWSER_PREFERENCES_DEFAULTS.homePage,
    newTabPage: String(!source.newTabPage || String(source.newTabPage).trim() === LEGACY_DEFAULT_HOME_URL ? BROWSER_PREFERENCES_DEFAULTS.newTabPage : source.newTabPage).trim().slice(0, 2048) || BROWSER_PREFERENCES_DEFAULTS.newTabPage,
    searchEngine: mode(source.searchEngine, Object.keys(SEARCH_ENGINES), BROWSER_PREFERENCES_DEFAULTS.searchEngine),
    addressSuggestionsEnabled: source.addressSuggestionsEnabled !== false,
    showHomeButton: Boolean(source.showHomeButton),
    defaultPageZoom: Math.round(clampNumber(source.defaultPageZoom, 50, 200, BROWSER_PREFERENCES_DEFAULTS.defaultPageZoom)),
    defaultFontSize: Math.round(clampNumber(source.defaultFontSize, 10, 28, BROWSER_PREFERENCES_DEFAULTS.defaultFontSize)),
    minimumFontSize: Math.round(clampNumber(source.minimumFontSize, 0, 24, BROWSER_PREFERENCES_DEFAULTS.minimumFontSize)),
    popupMode: mode(source.popupMode, ["smart", "block", "allow"], BROWSER_PREFERENCES_DEFAULTS.popupMode),
    trustedPopupSites: sanitizeTrustedPopupSites(source.trustedPopupSites),
    downloadsAskWhere: source.downloadsAskWhere !== false,
    downloadPath: String(source.downloadPath || "").trim().slice(0, 500),
    downloadManagerMode: mode(source.downloadManagerMode, ["builtin", "external"], BROWSER_PREFERENCES_DEFAULTS.downloadManagerMode),
    doNotTrack: Boolean(source.doNotTrack),
    globalPrivacyControl: Boolean(source.globalPrivacyControl),
    clearBrowsingDataOnExit: Boolean(source.clearBrowsingDataOnExit),
    thirdPartyCookieAccess: mode(source.thirdPartyCookieAccess, ["allow", "block"], BROWSER_PREFERENCES_DEFAULTS.thirdPartyCookieAccess),
    spellcheckEnabled: source.spellcheckEnabled !== false,
    spellcheckLanguages: (Array.isArray(source.spellcheckLanguages) ? source.spellcheckLanguages : BROWSER_PREFERENCES_DEFAULTS.spellcheckLanguages).map(String).slice(0, 8),
    acceptLanguages: String(source.acceptLanguages || BROWSER_PREFERENCES_DEFAULTS.acceptLanguages).trim().slice(0, 300) || DEFAULT_ACCEPT_LANGUAGES,
    autoplayPolicy: mode(source.autoplayPolicy, ["allow", "user-gesture"], BROWSER_PREFERENCES_DEFAULTS.autoplayPolicy),
    backgroundThrottling: source.backgroundThrottling !== false,
    deferBackgroundMediaUntilActivated: source.deferBackgroundMediaUntilActivated !== false,
    hardwareAcceleration: source.hardwareAcceleration !== false,
    proxyMode: mode(source.proxyMode, ["system", "direct", "custom"], BROWSER_PREFERENCES_DEFAULTS.proxyMode),
    proxyRules: String(source.proxyRules || "").trim().slice(0, 500),
    webrtcPolicy: mode(source.webrtcPolicy, ["default", "default_public_interface_only", "disable_non_proxied_udp"], BROWSER_PREFERENCES_DEFAULTS.webrtcPolicy),
    imageAnimationPolicy: mode(source.imageAnimationPolicy, ["animate", "animateOnce", "noAnimation"], BROWSER_PREFERENCES_DEFAULTS.imageAnimationPolicy),
    // 4.0.2: logins iniciados dentro de sites permanecem no MarshMallow.
    // Mantemos o campo apenas por compatibilidade com preferências antigas, mas
    // desativamos qualquer interceptação automática para navegador externo.
    nativeAuthMode: "off",
    nativeBrowser: mode(source.nativeBrowser, ["edge", "chrome", "system"], BROWSER_PREFERENCES_DEFAULTS.nativeBrowser),
    gameModeByDomain: Object.fromEntries(Object.entries(source.gameModeByDomain && typeof source.gameModeByDomain === "object" ? source.gameModeByDomain : {}).slice(0, 500).map(([host, value]) => [String(host).toLowerCase().replace(/^www\./, "").slice(0, 253), sanitizeGameDomainSetting(value)]).filter(([host]) => host && /^[a-z0-9.-]+$/.test(host))),
    permissionDefaults: {
      camera: mode(permissions.camera, ["ask", "allow", "block"], "ask"),
      microphone: mode(permissions.microphone, ["ask", "allow", "block"], "ask"),
      location: mode(permissions.location, ["ask", "allow", "block"], "ask"),
      notifications: mode(permissions.notifications, ["ask", "allow", "block"], "ask"),
      clipboard: mode(permissions.clipboard, ["ask", "allow", "block"], "ask"),
      midi: mode(permissions.midi, ["ask", "allow", "block"], "ask"),
      fullscreen: mode(permissions.fullscreen, ["ask", "allow", "block"], "allow"),
    },
  };
}

const browserPreferencesFile = () => path.join(app.getPath("userData"), "browser-preferences.json");

function loadBrowserPreferences() {
  try {
    const raw = JSON.parse(fs.readFileSync(browserPreferencesFile(), "utf8"));
    return sanitizePreferences({ ...BROWSER_PREFERENCES_DEFAULTS, ...raw, permissionDefaults: { ...BROWSER_PREFERENCES_DEFAULTS.permissionDefaults, ...(raw?.permissionDefaults || {}) } });
  } catch {
    return sanitizePreferences(BROWSER_PREFERENCES_DEFAULTS);
  }
}

let browserPreferences = loadBrowserPreferences();

function saveBrowserPreferences() {
  try {
    fs.mkdirSync(path.dirname(browserPreferencesFile()), { recursive: true });
    fs.writeFileSync(browserPreferencesFile(), JSON.stringify(browserPreferences, null, 2), "utf8");
  } catch (error) {
    console.warn("[Preferences] Falha ao salvar:", error);
  }
}

if (!browserPreferences.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

function currentSearchUrl(query) {
  const base = SEARCH_ENGINES[browserPreferences.searchEngine] || SEARCH_ENGINES.brave;
  return `${base}${encodeURIComponent(String(query || ""))}`;
}

function currentNewTabUrl() {
  return sanitizeBrowserPage(browserPreferences.newTabPage, DEFAULT_HOME_URL);
}

function currentHomeUrl() {
  return sanitizeBrowserPage(browserPreferences.homePage, DEFAULT_HOME_URL);
}

const STRICT_MEDIA_SITE_SUFFIXES = [
  "animefire.io",
  "animefire.net",
  "animefire.plus",
  "animesonlinecc.to",
  "animesonline.cc",
  "goyabu.io",
  "anroll.plus",
  "sushianimes.com.br",
  "donghuanosekai.com",
];

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (url.protocol === "http:" || url.protocol === "https:") ? url : null;
  } catch {
    return null;
  }
}

function isGoogleWebUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return host === "google.com" || host.endsWith(".google.com") ||
    host === "google.com.br" || host.endsWith(".google.com.br") ||
    host === "googleusercontent.com" || host.endsWith(".googleusercontent.com") ||
    host === "gstatic.com" || host.endsWith(".gstatic.com") ||
    host === "youtube.com" || host.endsWith(".youtube.com") ||
    host === "youtu.be" || host.endsWith(".youtu.be") ||
    host === "ytimg.com" || host.endsWith(".ytimg.com") ||
    host === "googlevideo.com" || host.endsWith(".googlevideo.com");
}

function userAgentForUrl(value) {
  return isGoogleWebUrl(value) ? NATIVE_RUNTIME_USER_AGENT : CLEAN_USER_AGENT;
}

function applyCompatibleUserAgent(webContents, value) {
  try { webContents?.setUserAgent(userAgentForUrl(value)); } catch {}
}

// MarshMallow 4.0: Google bloqueia fluxos de autenticação executados dentro
// de navegadores incorporados. Em vez de mascarar o User-Agent ou automatizar
// o login, abrimos somente os endpoints de autenticação em um navegador de
// desktop real (Edge/Chrome), controlado diretamente pelo usuário.
const NATIVE_AUTH_HOSTS = new Set([
  "accounts.google.com",
  "signin.aws.amazon.com",
  "appleid.apple.com",
  "login.live.com",
  "login.microsoftonline.com",
]);

function isNativeAuthUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  if (NATIVE_AUTH_HOSTS.has(host)) return true;
  if (host.endsWith(".google.com") && /\/(?:o\/oauth2|oauth|signin|account)/i.test(url.pathname)) return true;
  return false;
}

function isGoogleFamilyUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return host === "google.com" || host.endsWith(".google.com") ||
    host === "google.com.br" || host.endsWith(".google.com.br") ||
    host === "youtube.com" || host.endsWith(".youtube.com") ||
    host === "youtu.be" || host.endsWith(".youtu.be");
}

function shouldKeepGoogleAuthInCurrentTab(openerUrl, targetUrl) {
  return isGoogleFamilyUrl(openerUrl) && isNativeAuthUrl(targetUrl);
}

function nativeBrowserCandidates() {
  return nativeBrowserCandidatesForPlatform(process.platform, process.env);
}

function findNativeBrowser(kind) {
  const candidates = nativeBrowserCandidates();
  for (const value of candidates[kind] || []) {
    if (value && fs.existsSync(value)) return value;
  }
  return "";
}

function nativeEngineInfo() {
  return {
    preferred: browserPreferences.nativeBrowser,
    available: [
      { id: "edge", name: "Microsoft Edge", available: Boolean(findNativeBrowser("edge")) },
      { id: "chrome", name: "Google Chrome", available: Boolean(findNativeBrowser("chrome")) },
      { id: "system", name: nativeSystemBrowserLabel(process.platform), available: true },
    ],
  };
}

function runSystemCommand(command, args = [], options = {}) {
  const config = typeof options === "number" ? { timeoutMs: options } : (options || {});
  const timeoutMs = Math.max(1000, Number(config.timeoutMs || 8000));
  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: config.cwd || undefined,
      env: config.env ? { ...process.env, ...config.env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr: result.error || stderr.trim() });
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, code: -1, error: `${command} excedeu o tempo limite.` });
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => { if (stdout.length < 2_000_000) stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { if (stderr.length < 200_000) stderr += String(chunk); });
    child.on("error", (error) => finish({ ok: false, code: -1, error: String(error?.message || error) }));
    child.on("close", (code) => finish({ ok: code === 0, code: Number(code ?? -1) }));
  });
}

async function makeDefaultBrowser() {
  if (process.platform === "win32") {
    await shell.openExternal("ms-settings:defaultapps");
    return { ok: true, requiresSettings: true, message: "As configurações de aplicativos padrão do Windows foram abertas." };
  }
  if (process.platform !== "linux") {
    return { ok: false, error: "Configuração automática de navegador padrão indisponível nesta plataforma." };
  }
  for (const [command, args] of linuxDefaultBrowserCommands("marshmallow-browser.desktop")) {
    const result = await runSystemCommand(command, args);
    if (!result.ok) {
      return { ok: false, error: `${command} falhou: ${result.error || `código ${result.code}`}` };
    }
  }
  return { ok: true, requiresSettings: false, message: "MarshMallow definido como navegador padrão para links web suportados." };
}

async function openNativeBrowserUrl(value, { reason = "manual", context = mainBrowserContext } = {}) {
  const url = safeHttpUrl(value);
  if (!url) return { ok: false, error: "URL inválida para o modo nativo." };

  const preferred = browserPreferences.nativeBrowser || defaultNativeBrowser(process.platform);
  const order = preferred === "chrome" ? ["chrome", "edge"] : ["edge", "chrome"];

  if (preferred !== "system") {
    for (const engine of order) {
      const executable = findNativeBrowser(engine);
      if (!executable) continue;
      try {
        const child = spawn(executable, ["--new-window", url.href], {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        });
        child.unref();
        const name = engine === "edge" ? "Microsoft Edge" : "Google Chrome";
        sendToContextShell(context, "ui:native-auth-opened", { url: url.href, engine: name, reason });
        return { ok: true, engine: name };
      } catch (error) {
        console.warn(`[Native browser] ${engine} falhou:`, error);
      }
    }
  }

  try {
    await shell.openExternal(url.href);
    sendToContextShell(context, "ui:native-auth-opened", { url: url.href, engine: "Navegador padrão", reason });
    return { ok: true, engine: "Navegador padrão" };
  } catch (error) {
    return { ok: false, error: String(error?.message || error || "Não foi possível abrir o navegador nativo.") };
  }
}

async function interceptNativeAuth(context, tab, targetUrl, reason) {
  if (browserPreferences.nativeAuthMode !== "auto" || !isNativeAuthUrl(targetUrl)) return false;
  const result = await openNativeBrowserUrl(targetUrl, { reason, context });
  if (!result.ok) {
    sendToContextShell(context, "browser:popup-blocked", {
      tabId: tab?.id,
      url: targetUrl,
      openerUrl: tab?.url || "",
    });
  }
  return true;
}

function googleVerificationInfo(value) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const isGoogleHost =
    host === "google.com" || host.endsWith(".google.com") ||
    host === "google.com.br" || host.endsWith(".google.com.br");
  if (!isGoogleHost || !url.pathname.startsWith("/sorry/")) return null;

  const continued = safeHttpUrl(url.searchParams.get("continue") || "");
  const query = String(continued?.searchParams.get("q") || "").trim();
  return {
    url: url.href,
    continueUrl: continued?.href || "",
    query,
  };
}

function safeClosedTabUrl(value) {
  const info = googleVerificationInfo(value);
  if (!info) return value;
  // Nunca reabrimos a própria página /sorry. Se existir uma pesquisa original,
  // preservamos apenas o destino que o usuário havia pedido.
  return info.continueUrl || currentNewTabUrl();
}

async function handleGoogleVerification(tab, value) {
  const info = googleVerificationInfo(value);
  if (!info) {
    tab.googleVerificationPrompted = "";
    return;
  }

  // O /sorry/ pertence ao próprio Google. O MarshMallow não tenta contornar,
  // automatizar ou substituir o reCAPTCHA e também não interrompe a página com
  // uma caixa de diálogo própria. O usuário vê e resolve a verificação exatamente
  // como o Google a entregou.
  //
  // Mantemos somente a proteção de sessão/histórico em safeClosedTabUrl(), para
  // que uma página temporária de verificação não seja restaurada como se fosse a
  // navegação normal do usuário.
  tab.googleVerificationPrompted = info.url;
}

function hostMatchesSuffix(hostname, suffix) {
  const host = String(hostname || "").toLowerCase();
  const normalized = String(suffix || "").toLowerCase();
  return host === normalized || host.endsWith(`.${normalized}`);
}

function isStrictMediaSite(urlValue) {
  const url = safeHttpUrl(urlValue);
  if (!url) return false;
  return STRICT_MEDIA_SITE_SUFFIXES.some((suffix) =>
    hostMatchesSuffix(url.hostname, suffix)
  );
}

function sameWebOrigin(aValue, bValue) {
  const a = safeHttpUrl(aValue);
  const b = safeHttpUrl(bValue);
  if (!a || !b) return false;
  return a.origin === b.origin;
}

function isAllowedMediaFamilyTarget(urlValue) {
  const url = safeHttpUrl(urlValue);
  if (!url) return false;
  return STRICT_MEDIA_SITE_SUFFIXES.some((suffix) =>
    hostMatchesSuffix(url.hostname, suffix)
  );
}

function isGoogleSearchResultsUrl(urlValue) {
  const url = safeHttpUrl(urlValue);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const googleHost = host === "google.com" || host.endsWith(".google.com") ||
    host === "google.com.br" || host.endsWith(".google.com.br");
  return googleHost && url.pathname === "/search";
}

function isTrustedPopupOpener(openerUrl, trustedSites = browserPreferences.trustedPopupSites) {
  const opener = safeHttpUrl(openerUrl);
  if (!opener) return false;
  const host = normalizeTrustedPopupSite(opener.hostname);
  if (!host) return false;
  return sanitizeTrustedPopupSites(trustedSites).some((site) => host === site || host.endsWith(`.${site}`));
}

function shouldOpenAsRequestedTab(openerUrl, targetUrl, disposition) {
  const target = safeHttpUrl(targetUrl);
  if (!target) return false;

  const explicitTabGesture = [
    "foreground-tab",
    "background-tab",
    "new-window",
  ].includes(String(disposition || ""));

  if (!isStrictMediaSite(openerUrl)) {
    if (explicitTabGesture) return true;
    // Google Search can route a normal result click through window.open with
    // Chromium disposition "default". Denying that request makes the result
    // appear to refresh/stay on Google instead of navigating. Keep the smart
    // popup guard for ordinary sites, but honor this browser-like search flow.
    if (String(disposition || "") === "default" && isGoogleSearchResultsUrl(openerUrl)) return true;
    return sameWebOrigin(openerUrl, targetUrl);
  }

  if (explicitTabGesture) {
    return sameWebOrigin(openerUrl, targetUrl) ||
      isAllowedMediaFamilyTarget(targetUrl);
  }

  return sameWebOrigin(openerUrl, targetUrl);
}

let mainWindow = null;
let shuttingDown = false;
let preparingToQuit = false;
const pendingUiTimers = new Set();

function canUseMainWindow() {
  try {
    return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed());
  } catch {
    return false;
  }
}

function sendToShell(channel, ...args) {
  if (shuttingDown || !canUseMainWindow()) return false;
  try {
    mainWindow.webContents.send(channel, ...args);
    return true;
  } catch {
    return false;
  }
}

function sendToContextShell(context, channel, ...args) {
  if (shuttingDown || !context?.window) return false;

  const targetWindow = context.window;

  if (
    targetWindow.isDestroyed() ||
    targetWindow.webContents.isDestroyed()
  ) {
    return false;
  }

  try {
    targetWindow.webContents.send(
      channel,
      ...args
    );
    return true;
  } catch {
    return false;
  }
}

function scheduleUiWork(callback, delay = 0) {
  if (shuttingDown) return null;
  const timer = setTimeout(() => {
    pendingUiTimers.delete(timer);
    if (shuttingDown) return;
    try { callback(); } catch (error) { console.warn('[UI timer]', error); }
  }, delay);
  pendingUiTimers.add(timer);
  return timer;
}

function cancelPendingUiWork() {
  for (const timer of pendingUiTimers) clearTimeout(timer);
  pendingUiTimers.clear();
  for (const timer of mediaNotifyTimers.values()) clearTimeout(timer);
  mediaNotifyTimers.clear();
  if (sessionSaveTimer) { clearTimeout(sessionSaveTimer); sessionSaveTimer = null; }
}

if (HAS_SINGLE_INSTANCE_LOCK) {
  app.on("second-instance", (_event, argv = []) => {
    // O instalador inicia uma segunda instância com este argumento para pedir
    // ao processo principal que salve a sessão e encerre pelo fluxo normal.
    // Isso evita que o NSIS precise matar o navegador antes que cookies, abas
    // e armazenamento persistente sejam descarregados.
    if (Array.isArray(argv) && argv.includes("--prepare-update")) {
      app.quit();
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}
let chatBubbleView = null;
let toolbarOverflowWindow = null;
let chatBubbleState = { visible: false, unread: 0 };
const faviconByUrl = new Map();
let dockState = { mode: "none", width: 0 };
let lastComputedPageBounds = { x: 72, y: 92, width: 1000, height: 700 };
const gameSignalsByTab = new Map();
const drmProtectedTabs = new Set();
// O shell inicia bloqueado para garantir que a tela de cadastro/login nunca
// fique escondida atrás dos WebContentsView restaurados. O renderer libera
// as páginas somente depois de validar uma sessão MarshMallow.
let shellOnly = true;
// Quando uma pagina entra em Fullscreen pela API HTML (videos, players etc.),
// o WebContentsView precisa ocupar TODA a area de conteudo da janela. Sem isso,
// ele conserva os bounds normais da pagina e a interface do MarshMallow (barra
// de endereco/abas) invade o video.
let htmlFullscreenTabId = null;
let tabArea = { x: 72, y: 92, width: 1000, height: 700 };
let activeTabId = null;
let idCounter = 0;

const tabs = new Map();
const closedTabs = [];
let sessionSaveTimer = null;

const browserContexts = new Map();
let mainBrowserContext = null;

let privateSessionConfigured = false;

function hasPrivateSurfaces() {
  for (const context of browserContexts.values()) {
    if (!context) continue;

    const windowAlive =
      context.window &&
      !context.window.isDestroyed();

    if (!windowAlive) continue;

    // Uma janela privada continua sendo uma superfície privada
    // mesmo durante transições em que momentaneamente não possua abas.
    if (context.privateMode) {
      return true;
    }

    for (const tab of context.tabs.values()) {
      if (tab?.private) {
        return true;
      }
    }
  }

  return false;
}

function ensurePrivateSessionConfigured() {
  const privateSession =
    session.fromPartition(PRIVATE_PARTITION);

  if (privateSessionConfigured) return privateSession;

  try {
    privateSession.setUserAgent(
      privateSession.getUserAgent(),
      browserPreferences.acceptLanguages
    );
  } catch {}

  configureSessionPermissions(privateSession);

  configureDownloads(
    privateSession,
    { privateMode: true }
  );

  configurePrivacyHeaders(privateSession);
  configureMediaDetection(privateSession);

  void applySessionPreferences(privateSession);

  privateSessionConfigured = true;

  return privateSession;
}

async function clearPrivateSessionIfUnused() {
  if (hasPrivateSurfaces()) {
    return false;
  }

  const privateSession =
    session.fromPartition(PRIVATE_PARTITION);

  try {
    // Cookies, localStorage, IndexedDB, service workers etc.
    await privateSession.clearStorageData();

    // O cache HTTP/Chromium é limpo separadamente.
    await privateSession.clearCache();

    try {
      await privateSession.closeAllConnections();
    } catch {}

    return true;
  } catch (error) {
    console.warn(
      "[Private] Falha ao limpar sessão privada temporária:",
      error
    );

    return false;
  }
}

function createBrowserContext(window, {
  privateMode = false,
  isMain = false,
} = {}) {
  if (!window) return null;

  const context = {
    window,
    privateMode: Boolean(privateMode),
    isMain: Boolean(isMain),

    tabs: new Map(),
    closedTabs: [],
    activeTabId: null,

    tabArea: {
      x: 72,
      y: 92,
      width: 1000,
      height: 700,
    },

    dockState: {
      mode: "none",
      width: 0,
    },

    htmlFullscreenTabId: null,
    shellOnly: true,

    chatBubbleView: null,
    chatBubbleState: {
      visible: false,
      unread: 0,
    },

    toolbarOverflowWindow: null,

    watchPublisherWindow: null,
    watchPublisherReadyResolver: null,
    watchPublisherSession: null,
    activeCaptureFrame: null,
    currentWatchSession: null,

    lastComputedPageBounds: {
      x: 72,
      y: 92,
      width: 1000,
      height: 700,
    },
  };

  // Durante a migração arquitetural, o contexto principal compartilha
  // os Maps já usados pelo navegador existente. Janelas adicionais
  // continuarão recebendo Maps independentes.
  if (isMain) {
    context.tabs = tabs;
    context.closedTabs = closedTabs;
    context.activeTabId = activeTabId;
  }

  browserContexts.set(window.id, context);

  return context;
}

function contextForWindow(window) {
  if (!window || window.isDestroyed()) return null;

  return browserContexts.get(window.id) || null;
}

function hasOtherLiveBrowserContext(excludedContext) {
  for (const context of browserContexts.values()) {
    if (!context || context === excludedContext) continue;
    const window = context.window;
    if (window && !window.isDestroyed()) return true;
  }
  return false;
}

function contextForWebContents(contents) {
  if (!contents) return null;

  for (const context of browserContexts.values()) {
    if (context.chatBubbleView?.webContents === contents) return context;
  }

  const window = BrowserWindow.fromWebContents(contents);
  if (!window) return null;

  const directContext = contextForWindow(window);
  if (directContext) return directContext;

  // Child BrowserWindows, como o menu "...", pertencem ao contexto pai.
  const parentWindow = window.getParentWindow?.();
  return contextForWindow(parentWindow);
}

// 4.1.0 — extensões e mídia são mantidas no processo principal. Extensões
// carregadas pertencem somente ao perfil persistente normal; abas privadas usam
// sessões temporárias e não herdam extensões.
const mediaCandidatesByTab = new Map();
const mediaNotifyTimers = new Map();
const pendingDownloadNames = new Map();
const activeDownloadItems = new Map();
const downloadRecords = new Map();
const externalManagerBypassOnce = new Set();
let downloadHistoryLoaded = false;
let downloadCounter = 0;
let downloaderManagerManifestCache = { ok:true, available:false, version:"0.0.0", url:"", protocol:"marshmallow-downloader" };
let extensionRegistry = null;
const loadedExtensionIds = new Map();


const userDataFile = () => path.join(app.getPath("userData"), "browser-session.json");

function makeId(prefix = "tab") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return currentNewTabUrl();
  if (/^view-source:https?:\/\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw)) return raw;
  if (/^marshmallow:\/\//i.test(raw)) return raw;
  if (/^about:blank$/i.test(raw)) return "about:blank";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(raw)) return `http://${raw}`;
  // Esquemas arbitrários (javascript:, chrome-extension:, data:, etc.) não são
  // aceitos pela omnibox. Isso evita transformar texto digitado em uma origem
  // privilegiada ou executável dentro do navegador.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return currentSearchUrl(raw);
  if (!/\s/.test(raw) && (raw.includes(".") || raw.startsWith("localhost"))) return `https://${raw}`;
  return currentSearchUrl(raw);
}

function faviconFor(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function tabSnapshot(tab) {
  if (tab.internalPage) {
    return {
      id: tab.id,
      title: tab.title || "MarshMallow",
      url: tab.url || "",
      favicon: "",
      loading: false,
      audible: false,
      muted: false,
      canGoBack: false,
      canGoForward: false,
      active: tab.id === activeTabId,
      private: Boolean(tab.private),
      lastActiveAt: Number(tab.lastActiveAt || 0),
      internalPage: tab.internalPage,
      ...(tab.internalPage === "pdf" && tab.pdfSource ? { pdfSource: { ...tab.pdfSource } } : {}),
    };
  }
  const wc = liveTabWebContents(tab);
  const sleeping = Boolean(tab.sleeping);
  if (!wc) {
    return {
      id: tab.id,
      title: tab.title || "Nova aba",
      url: tab.url || "",
      favicon: tab.favicon || faviconFor(tab.url),
      loading: false,
      audible: false,
      muted: Boolean(tab.userMuted),
      canGoBack: false,
      canGoForward: false,
      active: tab.id === activeTabId,
      private: Boolean(tab.private),
      sleeping,
      lastActiveAt: Number(tab.lastActiveAt || 0),
      gameMode: currentGameModeForTab(tab),
    };
  }
  const history = wc.navigationHistory;
  return {
    id: tab.id,
    title: tab.title || "Nova aba",
    url: tab.url || "",
    favicon: tab.favicon || faviconFor(tab.url),
    loading: sleeping ? false : tab.loading,
    audible: sleeping ? false : wc.isCurrentlyAudible(),
    muted: Boolean(tab.userMuted),
    canGoBack: sleeping ? false : history.canGoBack(),
    canGoForward: sleeping ? false : history.canGoForward(),
    active: tab.id === activeTabId,
    private: Boolean(tab.private),
    sleeping,
    lastActiveAt: Number(tab.lastActiveAt || 0),
    gameMode: currentGameModeForTab(tab),
  };
}

function allTabsState(context = null) {
  const targetContext =
    context && context.tabs instanceof Map
      ? context
      : mainBrowserContext;

  if (targetContext) {
    return {
      version: VERSION,
      platform: process.platform,
      activeTabId: contextActiveTabId(targetContext),
      tabs: [...targetContext.tabs.values()].map(tabSnapshot),
    };
  }

  // Compatibilidade durante a inicialização, antes do contexto principal existir.
  return {
    version: VERSION,
    platform: process.platform,
    activeTabId,
    tabs: [...tabs.values()].map(tabSnapshot),
  };
}

function emitState() {
  if (shuttingDown) return;
  if (!sendToShell("browser:state", allTabsState())) return;
  scheduleSaveSession();
}

function chatBubbleHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;font-family:Segoe UI,Arial,sans-serif}
    body{display:grid;place-items:center}
    button{position:relative;width:46px;height:46px;border:1px solid rgba(255,255,255,.22);border-radius:15px;background:linear-gradient(180deg,rgba(26,27,34,.98),rgba(9,10,14,.98));color:#fff;box-shadow:0 12px 34px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.08);cursor:pointer;padding:0;display:grid;place-items:center}
    button:hover{background:linear-gradient(180deg,rgba(38,39,48,.99),rgba(13,14,19,.99));border-color:rgba(255,255,255,.32)}
    .icon{font-size:19px;line-height:1}.count{position:absolute;right:-4px;top:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#d45764;color:#fff;font-size:8px;font-weight:800;display:none;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.4)}
  </style></head><body><button id="b" title="Chat do Watch Together"><span class="icon">💬</span><span class="count" id="c"></span></button><script>
    const b=document.getElementById('b'),c=document.getElementById('c');
    b.addEventListener('click',()=>window.marshmallowBubble.open());
    b.addEventListener('contextmenu',(e)=>{e.preventDefault();window.marshmallowBubble.hideUntilNew();});
    window.marshmallowBubble.onUpdate((state)=>{const n=Math.max(0,Number(state.unread||0));c.textContent=n>99?'99+':String(n);c.style.display=n>0?'grid':'none';});
  </script></body></html>`;
}

function ensureChatBubbleView(context = mainBrowserContext) {
  if (
    shuttingDown ||
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return null;
  }

  const existing = context.chatBubbleView;
  if (
    existing &&
    !existing.webContents.isDestroyed()
  ) {
    return existing;
  }

  const bubble = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "chat-bubble-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  context.chatBubbleView = bubble;

  // Compatibilidade temporária enquanto o encerramento da janela principal
  // ainda mantém estes aliases globais.
  if (context.isMain) {
    chatBubbleView = bubble;
  }

  try { bubble.setBackgroundColor("#00000000"); } catch {}
  context.window.contentView.addChildView(bubble);

  bubble.webContents
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(chatBubbleHtml())}`)
    .catch(() => {});

  bubble.webContents.on("did-finish-load", () => {
    try {
      bubble.webContents.send(
        "chat-bubble:update",
        context.chatBubbleState
      );
    } catch {}
  });

  return bubble;
}

function applyChatBubble(context = mainBrowserContext) {
  if (
    shuttingDown ||
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return;
  }

  const bubble = ensureChatBubbleView(context);
  if (!bubble) return;

  const activeId = contextActiveTabId(context);

  // Nada do shell pode ficar por cima de um vídeo em HTML fullscreen.
  if (
    context.shellOnly ||
    context.htmlFullscreenTabId ||
    !context.chatBubbleState.visible ||
    !activeId
  ) {
    bubble.setVisible(false);
    return;
  }

  const size = 58;
  const pad = 9;
  const area = context.tabArea;

  bubble.setBounds({
    x: Math.max(
      0,
      Math.round(area.x + area.width - size - pad)
    ),
    y: Math.max(
      0,
      Math.round(area.y + area.height - size - pad)
    ),
    width: size,
    height: size,
  });

  // Child views adicionadas depois podem cobrir overlays anteriores. Reanexa
  // somente à BrowserWindow proprietária deste BrowserContext.
  try {
    context.window.contentView.removeChildView(bubble);
    context.window.contentView.addChildView(bubble);
  } catch {}

  bubble.setVisible(true);

  try {
    bubble.webContents.send(
      "chat-bubble:update",
      context.chatBubbleState
    );
  } catch {}
}

function toolbarOverflowHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    font-family: "Segoe UI", Arial, sans-serif;
  }

  body {
    padding: 6px;
  }

  .menu {
    width: 100%;
    padding: 6px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    background:
      linear-gradient(
        180deg,
        rgba(35,36,41,.985),
        rgba(19,20,24,.99)
      );
    box-shadow:
      0 18px 45px rgba(0,0,0,.58),
      inset 0 1px rgba(255,255,255,.045);
  }

  button {
    width: 100%;
    height: 31px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    background: transparent;
    color: #f0f0f2;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: default;
  }

  button:hover,
  button:focus-visible {
    outline: none;
    background: rgba(255,255,255,.085);
  }
</style>
</head>
<body>
  <div class="menu">
    <button data-action="new-tab">＋ Nova aba</button>
    <button data-action="new-private-tab">◐ Nova aba privada</button>
    <button data-action="library">★ Favoritos e histórico</button>
    <button data-action="performance">⚡ Desempenho</button>
    <button data-action="settings">⚙ Configurações</button>
    <button data-action="devtools">⌘ DevTools</button>
  </div>
</body>
</html>`;
}


function emitToolbarOverflowState(context, open) {
  if (!context) return false;

  return sendToContextShell(
    context,
    "browser:toolbar-overflow-state",
    Boolean(open)
  );
}

function hideToolbarOverflow(context = mainBrowserContext) {
  if (!context) return false;

  const win = context.toolbarOverflowWindow;

  if (
    win &&
    !win.isDestroyed() &&
    win.isVisible()
  ) {
    try {
      win.hide();
    } catch {}
  }

  emitToolbarOverflowState(context, false);
  return false;
}

function ensureToolbarOverflowWindow(context = mainBrowserContext) {
  if (
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return null;
  }

  if (
    context.toolbarOverflowWindow &&
    !context.toolbarOverflowWindow.isDestroyed()
  ) {
    return context.toolbarOverflowWindow;
  }

  const parentWindow = context.window;

  const win = new BrowserWindow({
    width: 226,
    height: 220,
    parent: parentWindow,
    modal: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(
        __dirname,
        "toolbar-overflow-preload.cjs"
      ),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  context.toolbarOverflowWindow = win;

  if (context.isMain) {
    toolbarOverflowWindow = win;
  }

  try {
    win.setMenuBarVisibility(false);
  } catch {}

  win.on("blur", () => {
    setTimeout(() => {
      if (
        context.toolbarOverflowWindow === win &&
        !win.isDestroyed() &&
        !win.isFocused()
      ) {
        hideToolbarOverflow(context);
      }
    }, 140);
  });

  win.on("closed", () => {
    if (context.toolbarOverflowWindow === win) {
      context.toolbarOverflowWindow = null;
    }

    if (
      context.isMain &&
      toolbarOverflowWindow === win
    ) {
      toolbarOverflowWindow = null;
    }

    emitToolbarOverflowState(
      context,
      false
    );
  });

  win.webContents.on("did-finish-load", () => {
    if (
      context.toolbarOverflowWindow === win &&
      !win.isDestroyed() &&
      win.isVisible()
    ) {
      emitToolbarOverflowState(
        context,
        true
      );
    }
  });

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      toolbarOverflowHtml()
    )}`
  ).catch(() => {});

  return win;
}

function setToolbarOverflow(context, payload = {}) {
  if (
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return false;
  }

  const shouldOpen =
    Boolean(payload?.open);

  const contextShellOnly =
    context.isMain
      ? shellOnly
      : Boolean(context.shellOnly);

  const contextFullscreen =
    context.isMain
      ? htmlFullscreenTabId
      : context.htmlFullscreenTabId;

  if (
    !shouldOpen ||
    contextShellOnly ||
    contextFullscreen
  ) {
    return hideToolbarOverflow(context);
  }

  const win =
    ensureToolbarOverflowWindow(context);

  if (!win) return false;

  const parentBounds =
    context.window.getContentBounds();

  const anchor =
    payload?.anchor || {};

  const width = 226;
  const height = 220;
  const pad = 8;
  const gap = 4;

  const contextTabArea =
    context.isMain
      ? tabArea
      : context.tabArea;

  const anchorRight =
    Number.isFinite(Number(anchor.right))
      ? Number(anchor.right)
      : parentBounds.width - pad;

  const anchorBottom =
    Number.isFinite(Number(anchor.bottom))
      ? Number(anchor.bottom)
      : Number(contextTabArea?.y || 0);

  let x =
    parentBounds.x +
    Math.round(anchorRight - width);

  let y =
    parentBounds.y +
    Math.round(anchorBottom + gap);

  const minX =
    parentBounds.x + pad;

  const maxX =
    Math.max(
      minX,
      parentBounds.x +
        parentBounds.width -
        width -
        pad
    );

  const minY =
    parentBounds.y + pad;

  const maxY =
    Math.max(
      minY,
      parentBounds.y +
        parentBounds.height -
        height -
        pad
    );

  x = Math.max(
    minX,
    Math.min(maxX, x)
  );

  y = Math.max(
    minY,
    Math.min(maxY, y)
  );

  try {
    win.setBounds({
      x,
      y,
      width,
      height,
    });

    win.show();
    win.focus();

    emitToolbarOverflowState(
      context,
      true
    );

    return true;
  } catch {
    return hideToolbarOverflow(context);
  }
}

function setChatBubbleState(context, payload) {
  if (!isBrowserContext(context)) {
    return { visible: false, unread: 0 };
  }

  context.chatBubbleState = {
    visible: Boolean(payload?.visible),
    unread: Math.max(
      0,
      Math.min(999, Number(payload?.unread || 0))
    ),
  };

  if (context.isMain) {
    chatBubbleState = context.chatBubbleState;
  }

  applyChatBubble(context);
  return context.chatBubbleState;
}


function fullscreenContentBounds(context = mainBrowserContext) {
  if (
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const area = context.window.getContentBounds();

  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(area.width)),
    height: Math.max(1, Math.round(area.height)),
  };
}
function applyTabArea(context = mainBrowserContext) {
  if (
    shuttingDown ||
    !context?.window ||
    context.window.isDestroyed()
  ) {
    return;
  }

  const contextTabs = context.tabs;
  const contextTabArea = context.tabArea;
  const contextDockState = context.dockState;
  const contextShellOnly = Boolean(context.shellOnly);
  const fullscreenId = context.htmlFullscreenTabId;

  // HTML fullscreen cobre toda a área da BrowserWindow daquele contexto.
  if (
    fullscreenId &&
    contextTabs.has(fullscreenId) &&
    !contextShellOnly
  ) {
    const fullBounds = fullscreenContentBounds(context);

    for (const [id, tab] of context.tabs.entries()) {
      if (!tab.view) continue;

      if (id === context.htmlFullscreenTabId) {
        tab.view.setBounds(fullBounds);
        tab.view.setVisible(true);
      } else {
        tab.view.setVisible(false);
      }
    }

    context.lastComputedPageBounds = { ...fullBounds };
    applyChatBubble(context);

    if (context.isMain) {
      lastComputedPageBounds = { ...fullBounds };
    }

    return;
  }

  const area =
    context.window.getContentBounds?.() ||
    {
      width: contextTabArea.x + contextTabArea.width,
      height: contextTabArea.y + contextTabArea.height,
    };

  const computed = computeContentBounds({
    windowWidth: area.width,
    windowHeight: area.height,
    shell: true,
    sidebarWidth: Math.max(
      0,
      Math.round(contextTabArea.x)
    ),
    toolbarHeight: Math.max(
      0,
      Math.round(contextTabArea.y)
    ),
    dock: contextDockState,
  });

  const bounds = {
    x: Math.max(0, Math.round(computed.page.x)),
    y: Math.max(0, Math.round(computed.page.y)),
    width: Math.max(120, Math.round(computed.page.width)),
    height: Math.max(120, Math.round(computed.page.height)),
  };

  context.lastComputedPageBounds = { ...bounds };

  if (context.isMain) {
    lastComputedPageBounds = { ...bounds };
  }

  for (const tab of context.tabs.values()) {
    if (tab.view) {
      tab.view.setBounds(bounds);
    }
  }

  applyChatBubble(context);
}
function enterHtmlFullscreen(context, tab) {
  if (
    !isBrowserContext(context) ||
    !context.window ||
    context.window.isDestroyed() ||
    !tab ||
    !context.tabs.has(tab.id)
  ) {
    return;
  }

  context.htmlFullscreenTabId = tab.id;

  // Compatibilidade temporária do contexto principal.
  if (context.isMain) {
    htmlFullscreenTabId = tab.id;
  }

  setContextActiveTabId(context, tab.id);
  setVisibleTab(context, tab.id);
  applyTabArea(context);

  // Durante a transição fullscreen a BrowserWindow pode mudar
  // de tamanho em mais de uma etapa. Os callbacks preservam
  // explicitamente o BrowserContext que originou o evento.
  scheduleUiWork(() => applyTabArea(context), 0);
  scheduleUiWork(() => applyTabArea(context), 80);
  scheduleUiWork(() => applyTabArea(context), 260);
}
function leaveHtmlFullscreen(context, tabId = null) {
  if (!isBrowserContext(context)) return;

  if (!context.htmlFullscreenTabId) return;

  if (
    tabId &&
    context.htmlFullscreenTabId !== tabId
  ) {
    return;
  }

  context.htmlFullscreenTabId = null;

  if (context.isMain) {
    htmlFullscreenTabId = null;
  }

  setVisibleTab(
    context,
    contextActiveTabId(context)
  );

  applyTabArea(context);
  scheduleUiWork(() => applyTabArea(context), 0);
  scheduleUiWork(() => applyTabArea(context), 120);
}
function setVisibleTab(context, id) {
  if (!isBrowserContext(context)) return;

  for (const tab of context.tabs.values()) {
    if (!tab.view) continue;

    tab.view.setVisible(
      !context.shellOnly &&
      tab.id === id
    );
  }
}
function setShellOnly(context, value) {
  if (!isBrowserContext(context)) {
    value = context;
    context = mainBrowserContext;
  }

  if (!context) return true;

  context.shellOnly = Boolean(value);

  if (context.isMain) {
    shellOnly = context.shellOnly;
  }

  const id = contextActiveTabId(context);

  for (const tab of context.tabs.values()) {
    if (!tab?.view || tab.view.webContents.isDestroyed()) continue;

    try {
      tab.view.setVisible(
        !context.shellOnly && tab.id === id
      );
    } catch {}
  }

  applyChatBubble(context);

  return context.shellOnly;
}


function sanitizeDock(payload = {}) {
  const mode = ["ai", "watch", "media", "game", "organizer", "none"].includes(String(payload?.mode)) ? String(payload.mode) : "none";
  const width = mode === "none" ? 0 : Math.max(320, Math.min(520, Math.round(Number(payload?.width || 386))));
  return { mode, width };
}

function setDockState(context, payload = {}) {
  if (!isBrowserContext(context)) {
    payload =
      context && typeof context === "object"
        ? context
        : {};

    context = mainBrowserContext;
  }

  if (!context) {
    return {
      mode: "none",
      width: 0,
      pageBounds: null,
    };
  }

  const nextDock =
    sanitizeDock(payload);

  context.dockState = nextDock;

  if (context.isMain) {
    dockState = nextDock;

    applyTabArea(context);

    context.lastComputedPageBounds = {
      ...lastComputedPageBounds,
    };
  } else {
    const base =
      context.tabArea || {
        x: 72,
        y: 92,
        width: 1000,
        height: 700,
      };

    const nextBounds = {
      x: Math.max(
        0,
        Math.round(Number(base.x || 0))
      ),

      y: Math.max(
        0,
        Math.round(Number(base.y || 0))
      ),

      width: Math.max(
        1,
        Math.round(
          Number(base.width || 1) -
          Number(nextDock.width || 0)
        )
      ),

      height: Math.max(
        1,
        Math.round(Number(base.height || 1))
      ),
    };

    context.lastComputedPageBounds =
      nextBounds;

    for (const tab of context.tabs.values()) {
      if (
        tab?.view &&
        !tab.view.webContents.isDestroyed()
      ) {
        try {
          tab.view.setBounds(nextBounds);
        } catch {}
      }
    }
  }

  return {
    ...context.dockState,
    pageBounds: {
      ...context.lastComputedPageBounds,
    },
  };
}

function gameSettingForUrl(url) {
  const host = hostnameKey(url);
  return { host, setting: sanitizeGameDomainSetting(browserPreferences.gameModeByDomain?.[host] || GAME_MODE_DEFAULT) };
}
function currentGameModeForTab(tab) {
  if (!tab?.view || tab.internalPage || !/^https?:/i.test(tab.url || "")) return { host:"", setting:GAME_MODE_DEFAULT, active:false, score:0, reasons:[] };
  const { host, setting } = gameSettingForUrl(tab.url);
  const signals = gameSignalsByTab.get(tab.id) || {};
  return { host, setting, ...resolveGameMode({ preference:setting.mode, signals }) };
}
function liveTabWebContents(tab) {
  try {
    const wc = tab?.view?.webContents;
    return wc && !wc.isDestroyed() ? wc : null;
  } catch {
    return null;
  }
}
function applyGameScheduler(context = mainBrowserContext) {
  if (shuttingDown || !context) return resolveWindowBackgroundPolicy([]);
  const input = [];
  const liveTabs = [];
  for (const tab of context.tabs.values()) {
    const wc = liveTabWebContents(tab);
    if (!wc) continue;
    const resolved = currentGameModeForTab(tab);
    input.push({ id:tab.id, gameActive:resolved.active, saveResourcesInBackground:resolved.setting.saveResourcesInBackground });
    liveTabs.push(wc);
  }
  const policy = resolveWindowBackgroundPolicy(input);
  for (const wc of liveTabs) {
    try { wc.setBackgroundThrottling(policy.continuous ? false : browserPreferences.backgroundThrottling); } catch {}
  }
  return policy;
}
async function probeGameSignals(context, tab) {
  if (!context) return currentGameModeForTab(tab);
  if (shuttingDown) return currentGameModeForTab(tab);
  if (!tab?.view || tab.view.webContents.isDestroyed() || !/^https?:/i.test(tab.url || "")) return currentGameModeForTab(tab);
  try {
    const signals = await tab.view.webContents.executeJavaScript(`(async () => {
      const canvases=[...document.querySelectorAll('canvas')];
      const largeCanvas=canvases.some(c=>{const r=c.getBoundingClientRect();return r.width>=480&&r.height>=270&&r.width*r.height>=180000;});
      let gamepad=false; try{gamepad=Array.from(navigator.getGamepads?.()||[]).some(Boolean);}catch{}
      let rafRate=0;
      if(largeCanvas && !document.hidden){
        try{
          const started=performance.now(); let frames=0;
          await new Promise((resolve)=>{
            const tick=()=>{ frames+=1; if(performance.now()-started>=350 || frames>=30) resolve(); else requestAnimationFrame(tick); };
            requestAnimationFrame(tick);
            setTimeout(resolve,500);
          });
          const elapsed=Math.max(1,performance.now()-started); rafRate=Math.round(frames*1000/elapsed);
        }catch{}
      }
      // Nunca chame getContext() num canvas do site apenas para detectar WebGL:
      // a primeira chamada pode definir o tipo do canvas e quebrar o jogo.
      const interactive=!!document.pointerLockElement||!!document.fullscreenElement;
      const webgl=largeCanvas && interactive && (typeof WebGLRenderingContext!=='undefined'||typeof WebGL2RenderingContext!=='undefined');
      return {largeCanvas,webgl,pointerLock:!!document.pointerLockElement,fullscreen:!!document.fullscreenElement,keyboardLock:false,gamepad,rafRate};
    })()`, false);
    gameSignalsByTab.set(tab.id, signals && typeof signals === "object" ? signals : {});
  } catch {}
  const resolved = currentGameModeForTab(tab);
  tab.gameMode = resolved;
  applyGameScheduler(context);
  if (tab.id === contextActiveTabId(context)) emitContextState(context);
  return resolved;
}
function getActiveGameMode(context = mainBrowserContext) {
  const tab = activeTab(context);
  if (!tab) return { host:"", setting:GAME_MODE_DEFAULT, active:false, score:0, reasons:[], backgroundPolicy:applyGameScheduler(context) };
  const resolved = currentGameModeForTab(tab);
  return { ...resolved, backgroundPolicy:applyGameScheduler(context) };
}
async function setActiveGameMode(context, input = {}) {
  if (!context) return getActiveGameMode(mainBrowserContext);
  const tab = activeTab(context); if (!tab?.view) return getActiveGameMode(context);
  const host = hostnameKey(tab.url); if (!host) return getActiveGameMode(context);
  const next = sanitizeGameDomainSetting(input);
  browserPreferences.gameModeByDomain = { ...(browserPreferences.gameModeByDomain || {}), [host]: next };
  saveBrowserPreferences();
  await probeGameSignals(context, tab);
  return getActiveGameMode(context);
}
async function performanceDiagnostics(context = mainBrowserContext) {
  let gpuInfo = {}, featureStatus = {}, gamepadAvailable = false;
  try { gpuInfo = await app.getGPUInfo("basic"); } catch {}
  try { featureStatus = app.getGPUFeatureStatus(); } catch {}
  try {
    const tab=activeTab(context);
    if(tab?.view && !tab.view.webContents.isDestroyed()) gamepadAvailable = Boolean(await tab.view.webContents.executeJavaScript(`typeof navigator.getGamepads === 'function'`, false));
  } catch {}
  const gameMode = getActiveGameMode(context);
  return { version:VERSION, gpuInfo, featureStatus, gameMode, backgroundPolicy:applyGameScheduler(context), gamepadAvailable };
}
const SUPPORT_URLS = new Set([
  "https://apoia.se/marshmallow-browser",
  "https://ko-fi.com/marshmallowbrowser",
  "https://buymeacoffee.com/marshmallowbrowser",
]);
async function openSupportUrl(value) {
  const url=String(value||"").replace(/\/$/,"");
  const match=[...SUPPORT_URLS].find((x)=>x.replace(/\/$/,"")===url);
  if(!match) return {ok:false,error:"Link de apoio não permitido."};
  await shell.openExternal(match); return {ok:true};
}
const RELEASE_METADATA_URL = "https://marshmallow-browser-br.pages.dev/download/release.json";
async function checkForUpdate() {
  const updatePolicy = updatePolicyForPlatform(process.platform);
  if (!updatePolicy.canDownloadInstaller) {
    return {
      ok: true,
      currentVersion: VERSION,
      available: false,
      updateMode: updatePolicy.mode,
      message: "No Linux, atualizações são instaladas por um novo RPM/AppImage oficial; nenhum instalador Windows será baixado.",
    };
  }
  try {
    const response = await net.fetch(`${RELEASE_METADATA_URL}?t=${Date.now()}`, { headers:{"cache-control":"no-cache"} });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const validated = validateReleaseMetadata(await response.json());
    if(!validated.ok) return {ok:false,error:`Metadados inválidos: ${validated.error}`};
    return {ok:true,currentVersion:VERSION,available:compareVersions(validated.version,VERSION)>0,...validated};
  } catch(error) { return {ok:false,currentVersion:VERSION,available:false,error:String(error?.message||error)}; }
}
async function downloadVerifiedUpdate() {
  const updatePolicy = updatePolicyForPlatform(process.platform);
  if (!updatePolicy.canDownloadInstaller) {
    return { ok: false, currentVersion: VERSION, available: false, updateMode: updatePolicy.mode, error: "Atualizações Linux usam RPM/AppImage; o MarshMallow não baixa instaladores .exe nesta plataforma." };
  }
  const update = await checkForUpdate();
  if (!update.ok || !update.available) return update;
  if (!mainWindow) return { ok:false, error:"Janela indisponível." };
  const out = await dialog.showSaveDialog(mainWindow, {
    title:`Baixar MarshMallow ${update.version}`,
    defaultPath:path.join(app.getPath("downloads"), `MarshMallow-Setup-${update.version}.exe`),
    filters:[{name:"Instalador MarshMallow",extensions:["exe"]}],
  });
  if (out.canceled || !out.filePath) return {ok:false,canceled:true};
  try {
    const r = await net.fetch(update.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const declared = Number(r.headers.get("content-length") || 0);
    const expected = Number(update.size || 0);
    if (declared > 1024 * 1024 * 1024) throw new Error("Instalador excede o limite de segurança de 1 GB.");
    if (expected > 0 && declared > 0 && declared !== expected) throw new Error("Tamanho do instalador difere dos metadados oficiais.");
    if (!r.body) throw new Error("O servidor não forneceu o corpo do instalador.");
    await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(out.filePath, { flags:"w" }));
    const actualSize = fs.statSync(out.filePath).size;
    if (expected > 0 && actualSize !== expected) throw new Error("Tamanho final do instalador difere dos metadados oficiais.");
    const hash = await sha256File(out.filePath);
    if (hash !== update.sha256) {
      fs.rmSync(out.filePath, {force:true});
      return {ok:false,error:"SHA-256 do instalador não confere; download removido."};
    }
    return {ok:true,verified:true,path:out.filePath,sha256:hash,version:update.version,size:actualSize};
  } catch (error) {
    try { if (out.filePath && fs.existsSync(out.filePath)) fs.rmSync(out.filePath,{force:true}); } catch {}
    return {ok:false,error:String(error?.message||error)};
  }
}

function safeFilename(value, fallback = "pagina") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (cleaned || fallback).slice(0, 120);
}


function sanitizeWallpaperName(value) {
  return safeFilename(String(value || "MarshMallow Wallpaper"), "MarshMallow Wallpaper").slice(0, 80);
}

const MAX_WALLPAPER_BYTES = 40 * 1024 * 1024;

function detectImageMime(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return "";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.subarray(0, 6).toString("ascii").startsWith("GIF8")) return "image/gif";
  if (bytes.subarray(0, 2).toString("ascii") === "BM") return "image/bmp";
  if (bytes.subarray(4, 12).toString("ascii").includes("ftyp") && /avif|avis/.test(bytes.subarray(8, 20).toString("ascii"))) return "image/avif";
  return "";
}

function assertWallpaperSize(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error("A imagem está vazia.");
  if (bytes.length > MAX_WALLPAPER_BYTES) throw new Error("Wallpaper excede o limite de 40 MB.");
  return bytes;
}

async function wallpaperSourceBuffer(source) {
  const raw = String(source || "").trim();
  if (!raw) throw new Error("Wallpaper não informado.");

  if (/^data:image\//i.test(raw)) {
    const comma = raw.indexOf(",");
    if (comma < 0) throw new Error("Imagem personalizada inválida.");
    const encoded = raw.slice(comma + 1);
    const bytes = raw.slice(0, comma).includes(";base64")
      ? Buffer.from(encoded, "base64")
      : Buffer.from(decodeURIComponent(encoded), "utf8");
    return assertWallpaperSize(bytes);
  }

  if (/^file:\/\//i.test(raw)) {
    return assertWallpaperSize(fs.readFileSync(fileURLToPath(raw)));
  }

  if (/^https?:\/\//i.test(raw)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await net.fetch(raw, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": CLEAN_USER_AGENT, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
      });
      if (!response.ok) throw new Error(`Falha ao obter wallpaper (HTTP ${response.status}).`);
      if (!/^https?:\/\//i.test(String(response.url || raw))) throw new Error("Redirecionamento de wallpaper não permitido.");
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_WALLPAPER_BYTES) throw new Error("Wallpaper excede o limite de 40 MB.");
      const bytes = assertWallpaperSize(Buffer.from(await response.arrayBuffer()));
      const type = String(response.headers.get("content-type") || "").toLowerCase();
      if (!type.startsWith("image/") && !detectImageMime(bytes)) throw new Error("O endereço não retornou uma imagem válida.");
      return bytes;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (path.isAbsolute(raw) && fs.existsSync(raw)) return assertWallpaperSize(fs.readFileSync(raw));
  throw new Error("Origem de wallpaper não suportada.");
}

async function convertImageWithRenderer(input) {
  const mime = detectImageMime(input);
  if (!mime) throw new Error("Formato de imagem não reconhecido.");
  const ext = ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif","image/gif":"gif","image/bmp":"bmp"})[mime] || "img";
  const dir = path.join(app.getPath("temp"), `MarshMallow-wallpaper-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  const imagePath = path.join(dir, `source.${ext}`);
  const htmlPath = path.join(dir, "convert.html");
  fs.writeFileSync(imagePath, input);
  fs.writeFileSync(htmlPath, "<!doctype html><meta charset=utf-8><title>MarshMallow image converter</title>", "utf8");
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  try {
    await win.loadURL(pathToFileURL(htmlPath).href);
    const relative = `./${path.basename(imagePath).replace(/'/g, "")}`;
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{const pixels=img.naturalWidth*img.naturalHeight;if(!img.naturalWidth||!img.naturalHeight||pixels>100000000)throw new Error('Dimensões da imagem não suportadas.');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{alpha:false});x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0);resolve(c.toDataURL('image/jpeg',0.94));}catch(e){reject(e)}};img.onerror=()=>reject(new Error('O Chromium não conseguiu decodificar a imagem.'));img.src=${JSON.stringify(relative)};})`, true);
    const encoded = String(dataUrl || "").split(",", 2)[1] || "";
    if (!encoded) throw new Error("Falha ao converter a imagem para JPEG.");
    return Buffer.from(encoded, "base64");
  } finally {
    try { win.destroy(); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function wallpaperJpegBuffer(source) {
  const input = await wallpaperSourceBuffer(source);
  const image = nativeImage.createFromBuffer(input);
  if (!image.isEmpty()) {
    const jpeg = image.toJPEG(94);
    if (jpeg?.length) return jpeg;
  }
  // nativeImage não decodifica todos os formatos que uma página Chromium
  // consegue exibir (principalmente alguns WebP/AVIF). O fallback usa um
  // renderer isolado + canvas, sem depender de software externo.
  return convertImageWithRenderer(input);
}

function ensureWallpaperStore() {
  const dir = path.join(app.getPath("userData"), "Wallpapers");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function materializeWallpaperForWindows(source, label, target) {
  const bytes = await wallpaperJpegBuffer(source);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(ensureWallpaperStore(), `${sanitizeWallpaperName(label).replace(/\s+/g, "-")}-${target}-${stamp}.jpg`);
  fs.writeFileSync(file, bytes);
  return file;
}

function runPowerShellScript(script, extraEnv = {}, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(String(script || ""), "utf16le").toString("base64");
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, Math.max(1000, Number(timeoutMs || 30000)));
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => { clearTimeout(timer); resolve({ ok: false, code: -1, stdout, stderr: String(error?.message || error) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, code: Number(code ?? -1), stdout, stderr }); });
  });
}


// ------------------------------------------------------------------
// 4.1.0 — Extensões Chromium e Modo Desenvolvedor
// ------------------------------------------------------------------

const EXTENSION_ARCHIVE_LIMIT = 100 * 1024 * 1024;
const EXTENSION_EXTRACT_LIMIT = 250 * 1024 * 1024;
const EXTENSION_ENTRY_LIMIT = 12000;
const EXTENSION_SUPPORTED_MANIFEST_KEYS = new Set([
  "name", "version", "author", "permissions", "content_scripts", "default_locale",
  "devtools_page", "short_name", "host_permissions", "manifest_version", "background",
  "minimum_chrome_version",
]);
const EXTENSION_SUPPORTED_APIS = ["devtools.inspectedWindow", "devtools.network", "devtools.panels", "extension", "management", "runtime", "scripting", "storage.local", "tabs (parcial)", "webRequest"];

function extensionsRoot() {
  const dir = path.join(app.getPath("userData"), "Extensions");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function extensionsRegistryFile() { return path.join(extensionsRoot(), "registry.json"); }
function defaultExtensionRegistry() { return { version: 1, developerMode: false, allowExternalSources: false, items: [] }; }
function sanitizeExtensionRegistry(raw) {
  const base = defaultExtensionRegistry();
  if (!raw || typeof raw !== "object") return base;
  const items = Array.isArray(raw.items) ? raw.items.slice(0, 200).map((item) => ({
    installId: String(item?.installId || makeId("ext")),
    path: String(item?.path || "").slice(0, 2000),
    source: String(item?.source || "unknown").slice(0, 2000),
    installType: ["managed", "unpacked"].includes(String(item?.installType)) ? String(item.installType) : "managed",
    enabled: item?.enabled !== false,
    allowFileAccess: item?.allowFileAccess === true,
    runtimeId: String(item?.runtimeId || "").slice(0, 128),
    lastError: String(item?.lastError || "").slice(0, 1000),
  })).filter((item) => item.path) : [];
  return { version: 1, developerMode: raw.developerMode === true, allowExternalSources: raw.allowExternalSources === true, items };
}
function getExtensionRegistry() {
  if (extensionRegistry) return extensionRegistry;
  try { extensionRegistry = sanitizeExtensionRegistry(JSON.parse(fs.readFileSync(extensionsRegistryFile(), "utf8"))); }
  catch { extensionRegistry = defaultExtensionRegistry(); }
  return extensionRegistry;
}
function saveExtensionRegistry() {
  const registry = getExtensionRegistry();
  const temp = `${extensionsRegistryFile()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(registry, null, 2), "utf8");
  fs.renameSync(temp, extensionsRegistryFile());
}
function readExtensionManifest(extensionPath) {
  const manifestPath = path.join(extensionPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("manifest.json não encontrado.");
  const stat = fs.statSync(manifestPath);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("manifest.json inválido ou grande demais.");
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { throw new Error("manifest.json contém JSON inválido."); }
  if (![2, 3].includes(Number(manifest?.manifest_version))) throw new Error("A extensão precisa usar Manifest V2 ou V3.");
  if (!String(manifest?.name || "").trim() || !String(manifest?.version || "").trim()) throw new Error("A extensão não informa nome/versão no manifest.json.");
  return manifest;
}
function extensionCompatibility(manifest) {
  const issues = [];
  const warnings = [];
  const keys = Object.keys(manifest || {});
  const unknownKeys = keys.filter((key) => !EXTENSION_SUPPORTED_MANIFEST_KEYS.has(key));
  if (unknownKeys.length) warnings.push(`Chaves não garantidas pelo Electron: ${unknownKeys.slice(0, 12).join(", ")}`);
  const permissions = [...(Array.isArray(manifest?.permissions) ? manifest.permissions : []), ...(Array.isArray(manifest?.optional_permissions) ? manifest.optional_permissions : [])].map(String);
  const known = ["storage", "tabs", "scripting", "webRequest", "management"];
  const unknownPermissions = permissions.filter((p) => !known.some((k) => p === k || p.startsWith("http://") || p.startsWith("https://") || p === "<all_urls>"));
  if (unknownPermissions.length) warnings.push(`Permissões sem garantia de compatibilidade: ${unknownPermissions.slice(0, 12).join(", ")}`);
  if (Number(manifest?.manifest_version) === 3 && manifest?.background?.service_worker) warnings.push("Service worker MV3 depende do suporte disponível na versão atual do Electron.");
  return { level: issues.length ? "incompatible" : (warnings.length ? "partial" : "good"), issues, warnings, supportedApis: EXTENSION_SUPPORTED_APIS };
}
function extensionPublicRecord(record) {
  let manifest = {};
  let compatibility = { level: "incompatible", issues: ["Extensão indisponível."], warnings: [], supportedApis: EXTENSION_SUPPORTED_APIS };
  try { manifest = readExtensionManifest(record.path); compatibility = extensionCompatibility(manifest); } catch (error) { compatibility.issues = [String(error?.message || error)]; }
  return {
    installId: record.installId,
    runtimeId: record.runtimeId || "",
    name: String(manifest?.name || path.basename(record.path)),
    version: String(manifest?.version || ""),
    description: String(manifest?.description || "").slice(0, 800),
    manifestVersion: Number(manifest?.manifest_version || 0),
    permissions: Array.isArray(manifest?.permissions) ? manifest.permissions.map(String).slice(0, 100) : [],
    hostPermissions: Array.isArray(manifest?.host_permissions) ? manifest.host_permissions.map(String).slice(0, 100) : [],
    enabled: record.enabled !== false,
    allowFileAccess: record.allowFileAccess === true,
    installType: record.installType,
    source: record.source,
    path: record.path,
    lastError: record.lastError || "",
    compatibility,
  };
}
async function unloadExtensionRecord(record) {
  const ses = normalTabSession();
  const id = record.runtimeId || loadedExtensionIds.get(record.installId);
  if (id) { try { ses.extensions.removeExtension(id); } catch {} }
  loadedExtensionIds.delete(record.installId);
  record.runtimeId = "";
}
async function loadExtensionRecord(record) {
  await unloadExtensionRecord(record);
  if (record.enabled === false) return null;
  try {
    readExtensionManifest(record.path);
    const extension = await normalTabSession().extensions.loadExtension(record.path, { allowFileAccess: record.allowFileAccess === true });
    record.runtimeId = String(extension?.id || "");
    record.lastError = "";
    if (record.runtimeId) loadedExtensionIds.set(record.installId, record.runtimeId);
    return extension;
  } catch (error) {
    record.lastError = String(error?.message || error).slice(0, 1000);
    return null;
  } finally { saveExtensionRegistry(); }
}
async function restoreInstalledExtensions() {
  const registry = getExtensionRegistry();
  for (const record of registry.items) if (record.enabled !== false) await loadExtensionRecord(record);
}
function extensionManagerState() {
  const registry = getExtensionRegistry();
  return { developerMode: registry.developerMode, allowExternalSources: registry.allowExternalSources, electronApiNotice: "Electron oferece compatibilidade parcial com extensões Chromium; APIs não implementadas pelo Electron podem limitar uma extensão.", supportedApis: EXTENSION_SUPPORTED_APIS, items: registry.items.map(extensionPublicRecord) };
}
function isPathInside(parent, child) {
  const p = path.resolve(parent) + path.sep;
  const c = path.resolve(child);
  return c === path.resolve(parent) || c.startsWith(p);
}
function findExtensionRoot(dir, maxDepth = 4) {
  const queue = [{ dir, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (fs.existsSync(path.join(current.dir, "manifest.json"))) return current.dir;
    if (current.depth >= maxDepth) continue;
    for (const entry of fs.readdirSync(current.dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
    }
  }
  throw new Error("O pacote não contém manifest.json em uma pasta válida.");
}
function crxZipPayload(buffer) {
  if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "Cr24") return buffer;
  if (buffer.length < 16) throw new Error("Arquivo CRX incompleto.");
  const version = buffer.readUInt32LE(4);
  let offset = 0;
  if (version === 2) {
    const publicKeyLength = buffer.readUInt32LE(8);
    const signatureLength = buffer.readUInt32LE(12);
    offset = 16 + publicKeyLength + signatureLength;
  } else if (version === 3) {
    const headerLength = buffer.readUInt32LE(8);
    offset = 12 + headerLength;
  } else throw new Error(`Versão CRX ${version} não suportada.`);
  if (offset < 0 || offset >= buffer.length - 4) throw new Error("Cabeçalho CRX inválido.");
  const zip = buffer.subarray(offset);
  if (zip.subarray(0, 2).toString("ascii") !== "PK") throw new Error("O CRX não contém um ZIP válido.");
  return zip;
}
function validateArchiveEntryName(name, destination) {
  const raw = String(name || "").replace(/\\/g, "/");
  if (!raw.trim()) return;
  if (raw.includes("\u0000") || raw.startsWith("/") || /^[A-Za-z]:\//.test(raw)) throw new Error("Caminho inseguro dentro do ZIP.");
  const parts = raw.split("/").filter((part) => part && part !== ".");
  if (parts.includes("..")) throw new Error("Caminho inseguro dentro do ZIP.");
  const target = path.resolve(destination, ...parts);
  if (!isPathInside(destination, target)) throw new Error("Tentativa de sair da pasta de extensão.");
}

async function safeExtractZipOnLinux(zipPath, destination) {
  const namesResult = await runSystemCommand("unzip", ["-Z1", zipPath], { timeoutMs: 30000 });
  if (!namesResult.ok) throw new Error(namesResult.stderr || "Não foi possível listar o ZIP. Instale o pacote unzip.");
  const entries = namesResult.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (entries.length > EXTENSION_ENTRY_LIMIT) throw new Error("Pacote possui arquivos demais.");
  for (const name of entries) validateArchiveEntryName(name, destination);

  const detailsResult = await runSystemCommand("unzip", ["-Z", "-l", zipPath], { timeoutMs: 30000 });
  if (!detailsResult.ok) throw new Error(detailsResult.stderr || "Não foi possível validar os metadados do ZIP.");
  for (const line of detailsResult.stdout.split(/\r?\n/)) {
    if (/^l[rwx-]{9}\s/.test(line.trim())) throw new Error("Links simbólicos não são permitidos em pacotes de extensão.");
  }

  const listResult = await runSystemCommand("unzip", ["-l", zipPath], { timeoutMs: 30000 });
  if (!listResult.ok) throw new Error(listResult.stderr || "Não foi possível medir o conteúdo do ZIP.");
  const summary = listResult.stdout.split(/\r?\n/).map((line) => line.trim()).reverse().find((line) => /^\d+\s+\d+\s+files?$/.test(line));
  if (!summary) throw new Error("Não foi possível validar o tamanho descompactado do ZIP.");
  const total = Number(summary.match(/^(\d+)/)?.[1] || 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > EXTENSION_EXTRACT_LIMIT) throw new Error("Conteúdo extraído excede o limite permitido.");

  const extractResult = await runSystemCommand("unzip", ["-qq", "-o", zipPath, "-d", destination], { timeoutMs: 120000 });
  if (!extractResult.ok) throw new Error(extractResult.stderr || "Falha ao extrair a extensão com unzip.");

  const queue = [destination];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const stat = fs.lstatSync(child);
      if (stat.isSymbolicLink()) throw new Error("Links simbólicos não são permitidos em pacotes de extensão.");
      if (stat.isDirectory()) queue.push(child);
    }
  }
}

async function safeExtractZipOnWindows(zipPath, destination) {
  const script = String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Path]::GetFullPath($env:MM_ZIP_PATH)
$dest=[IO.Path]::GetFullPath($env:MM_ZIP_DEST)
$limit=[int64]$env:MM_ZIP_LIMIT
$entryLimit=[int]$env:MM_ZIP_ENTRY_LIMIT
$archive=[IO.Compression.ZipFile]::OpenRead($zip)
try {
  if ($archive.Entries.Count -gt $entryLimit) { throw 'Pacote possui arquivos demais.' }
  $total=[int64]0
  foreach($entry in $archive.Entries){
    $name=[string]$entry.FullName
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    if ($name -match '^[\\/]' -or $name -match ':' -or $name -match '(^|[\\/])\.\.([\\/]|$)' -or $name.IndexOf([char]0) -ge 0) { throw 'Caminho inseguro dentro do ZIP.' }
    $target=[IO.Path]::GetFullPath([IO.Path]::Combine($dest,$name.Replace('/',[IO.Path]::DirectorySeparatorChar)))
    $prefix=$dest.TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
    if (-not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Tentativa de sair da pasta de extensao.' }
    $total += [int64]$entry.Length
    if ($total -gt $limit) { throw 'Conteudo extraido excede o limite permitido.' }
  }
  foreach($entry in $archive.Entries){
    $name=[string]$entry.FullName
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $target=[IO.Path]::GetFullPath([IO.Path]::Combine($dest,$name.Replace('/',[IO.Path]::DirectorySeparatorChar)))
    if ($name.EndsWith('/') -or $name.EndsWith('\\')) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
    $parent=[IO.Path]::GetDirectoryName($target); if($parent){[IO.Directory]::CreateDirectory($parent)|Out-Null}
    $input=$entry.Open(); try { $output=[IO.File]::Create($target); try { $input.CopyTo($output) } finally { $output.Dispose() } } finally { $input.Dispose() }
  }
} finally { $archive.Dispose() }
`;
  const result = await runPowerShellScript(script, { MM_ZIP_PATH: zipPath, MM_ZIP_DEST: destination, MM_ZIP_LIMIT: String(EXTENSION_EXTRACT_LIMIT), MM_ZIP_ENTRY_LIMIT: String(EXTENSION_ENTRY_LIMIT) }, 120000);
  if (!result.ok) throw new Error(result.stderr.trim() || result.stdout.trim() || "Falha ao extrair a extensão.");
}

async function safeExtractZipBytes(bytes, destination) {
  const zipBytes = crxZipPayload(bytes);
  if (zipBytes.length > EXTENSION_ARCHIVE_LIMIT) throw new Error("Pacote de extensão excede 100 MB.");
  if (zipBytes.subarray(0, 2).toString("ascii") !== "PK") throw new Error("O arquivo não é ZIP/CRX válido.");
  fs.mkdirSync(destination, { recursive: true });
  const zipPath = `${destination}.package.zip`;
  fs.writeFileSync(zipPath, zipBytes);
  try {
    const extractZip = process.platform === "win32" ? safeExtractZipOnWindows : safeExtractZipOnLinux;
    await extractZip(zipPath, destination);
  } finally {
    try { fs.unlinkSync(zipPath); } catch {}
  }
}
async function installExtensionBytes(bytes, source) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error("Pacote vazio.");
  if (bytes.length > EXTENSION_ARCHIVE_LIMIT) throw new Error("Pacote de extensão excede 100 MB.");
  const staging = path.join(extensionsRoot(), `.staging-${crypto.randomUUID()}`);
  fs.mkdirSync(staging, { recursive: true });
  try {
    await safeExtractZipBytes(bytes, staging);
    const extensionRoot = findExtensionRoot(staging);
    const manifest = readExtensionManifest(extensionRoot);
    const dest = path.join(extensionsRoot(), `ext-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
    fs.cpSync(extensionRoot, dest, { recursive: true, errorOnExist: true });
    const record = { installId: makeId("ext"), path: dest, source: String(source || "arquivo"), installType: "managed", enabled: true, allowFileAccess: false, runtimeId: "", lastError: "" };
    getExtensionRegistry().items.push(record);
    saveExtensionRegistry();
    await loadExtensionRecord(record);
    return { ok: !record.lastError, extension: extensionPublicRecord(record), error: record.lastError || undefined, manifestName: String(manifest.name || "") };
  } finally { try { fs.rmSync(staging, { recursive: true, force: true }); } catch {} }
}
async function fetchExtensionPackage(urlValue) {
  const url = new URL(String(urlValue || ""));
  if (url.protocol !== "https:") throw new Error("Somente fontes HTTPS são aceitas.");
  if (url.username || url.password) throw new Error("URLs de extensão com credenciais embutidas não são aceitas.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await net.fetch(url.href, { redirect: "follow", signal: controller.signal, headers: { "user-agent": CLEAN_USER_AGENT, accept: "application/x-chrome-extension,application/zip,application/octet-stream,*/*;q=0.5" } });
    if (!response.ok) throw new Error(`Download da extensão falhou (HTTP ${response.status}).`);
    if (!/^https:\/\//i.test(String(response.url || ""))) throw new Error("A fonte redirecionou para um protocolo não seguro.");
    const size = Number(response.headers.get("content-length") || 0);
    if (size > EXTENSION_ARCHIVE_LIMIT) throw new Error("Pacote de extensão excede 100 MB.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > EXTENSION_ARCHIVE_LIMIT) throw new Error("Pacote de extensão excede 100 MB.");
    return bytes;
  } finally { clearTimeout(timer); }
}
function chromeWebStorePackageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["chromewebstore.google.com", "chrome.google.com"].includes(url.hostname.toLowerCase())) return "";
    const match = url.pathname.match(/\/detail\/(?:[^/]+\/)?([a-p]{32})(?:\/|$)/i);
    if (!match) return "";
    const id = match[1].toLowerCase();
    return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${encodeURIComponent(CHROME_VERSION)}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${id}&uc`)}`;
  } catch { return ""; }
}
async function chooseUnpackedExtension() {
  const registry = getExtensionRegistry();
  if (!registry.developerMode) return { ok: false, error: "Ative o Modo desenvolvedor para carregar uma pasta descompactada." };
  if (!mainWindow) return { ok: false, error: "Janela indisponível." };
  const result = await dialog.showOpenDialog(mainWindow, { title: "Carregar extensão descompactada", properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  try {
    const folder = path.resolve(result.filePaths[0]);
    readExtensionManifest(folder);
    const record = { installId: makeId("ext"), path: folder, source: folder, installType: "unpacked", enabled: true, allowFileAccess: false, runtimeId: "", lastError: "" };
    registry.items.push(record); saveExtensionRegistry(); await loadExtensionRecord(record);
    return { ok: !record.lastError, extension: extensionPublicRecord(record), error: record.lastError || undefined };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}
async function chooseExtensionArchive() {
  const registry = getExtensionRegistry();
  if (!registry.developerMode) return { ok: false, error: "Ative o Modo desenvolvedor para instalar ZIP/CRX local." };
  if (!mainWindow) return { ok: false, error: "Janela indisponível." };
  const result = await dialog.showOpenDialog(mainWindow, { title: "Instalar extensão ZIP/CRX", properties: ["openFile"], filters: [{ name: "Extensões Chromium", extensions: ["zip", "crx"] }] });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  try {
    const file = result.filePaths[0]; const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > EXTENSION_ARCHIVE_LIMIT) throw new Error("Arquivo inválido ou maior que 100 MB.");
    return await installExtensionBytes(fs.readFileSync(file), file);
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}
async function installExtensionFromUrl(value) {
  const registry = getExtensionRegistry();
  const storePackage = chromeWebStorePackageUrl(value);
  if (!storePackage && (!registry.developerMode || !registry.allowExternalSources)) return { ok: false, error: "Ative Modo desenvolvedor e Fontes externas para instalar desta URL." };
  try {
    const downloadUrl = storePackage || String(value || "");
    const bytes = await fetchExtensionPackage(downloadUrl);
    return await installExtensionBytes(bytes, storePackage ? String(value) : downloadUrl);
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}
async function setExtensionSettings(patch = {}) {
  const registry = getExtensionRegistry();
  if (Object.prototype.hasOwnProperty.call(patch, "developerMode")) registry.developerMode = patch.developerMode === true;
  if (Object.prototype.hasOwnProperty.call(patch, "allowExternalSources")) registry.allowExternalSources = registry.developerMode && patch.allowExternalSources === true;
  if (!registry.developerMode) registry.allowExternalSources = false;
  saveExtensionRegistry();
  return extensionManagerState();
}
function findExtensionRecord(installId) { return getExtensionRegistry().items.find((item) => item.installId === String(installId || "")); }
async function setExtensionEnabled(installId, enabled) {
  const record = findExtensionRecord(installId); if (!record) return { ok: false, error: "Extensão não encontrada." };
  record.enabled = enabled === true;
  if (record.enabled) await loadExtensionRecord(record); else { await unloadExtensionRecord(record); saveExtensionRegistry(); }
  return { ok: !record.lastError, state: extensionManagerState(), error: record.lastError || undefined };
}
async function reloadManagedExtension(installId) {
  const record = findExtensionRecord(installId); if (!record) return { ok: false, error: "Extensão não encontrada." };
  await loadExtensionRecord(record); return { ok: !record.lastError, state: extensionManagerState(), error: record.lastError || undefined };
}
async function setExtensionFileAccess(installId, allow) {
  const record = findExtensionRecord(installId); if (!record) return { ok: false, error: "Extensão não encontrada." };
  record.allowFileAccess = allow === true; await loadExtensionRecord(record); return { ok: !record.lastError, state: extensionManagerState(), error: record.lastError || undefined };
}
async function removeManagedExtension(installId) {
  const registry = getExtensionRegistry(); const index = registry.items.findIndex((item) => item.installId === String(installId || ""));
  if (index < 0) return { ok: false, error: "Extensão não encontrada." };
  const record = registry.items[index]; await unloadExtensionRecord(record); registry.items.splice(index, 1); saveExtensionRegistry();
  if (record.installType === "managed" && isPathInside(extensionsRoot(), record.path)) { try { fs.rmSync(record.path, { recursive: true, force: true }); } catch {} }
  return { ok: true, state: extensionManagerState() };
}
async function packExtensionZip(installId) {
  const registry = getExtensionRegistry();
  if (!registry.developerMode) return { ok: false, error: "Ative o Modo desenvolvedor para empacotar." };
  const record = findExtensionRecord(installId); if (!record) return { ok: false, error: "Extensão não encontrada." };
  if (!mainWindow) return { ok: false, error: "Janela indisponível." };
  const manifest = readExtensionManifest(record.path); const filename = `${safeFilename(String(manifest.name || "extensao"), "extensao")}-${safeFilename(String(manifest.version || "1"), "1")}.zip`;
  const out = await dialog.showSaveDialog(mainWindow, { title: "Empacotar extensão", defaultPath: path.join(app.getPath("downloads"), filename), filters: [{ name: "Pacote ZIP", extensions: ["zip"] }] });
  if (out.canceled || !out.filePath) return { ok: false, canceled: true };
  if (process.platform === "win32") {
    const script = `$ErrorActionPreference='Stop'; if(Test-Path $env:MM_ZIP_OUT){Remove-Item -Force $env:MM_ZIP_OUT}; Compress-Archive -Path (Join-Path $env:MM_EXT_PATH '*') -DestinationPath $env:MM_ZIP_OUT -CompressionLevel Optimal -Force`;
    const result = await runPowerShellScript(script, { MM_EXT_PATH: record.path, MM_ZIP_OUT: out.filePath }, 120000);
    return result.ok ? { ok: true, path: out.filePath } : { ok: false, error: result.stderr.trim() || "Falha ao empacotar extensão." };
  }
  try { fs.rmSync(out.filePath, { force: true }); } catch {}
  const result = await runSystemCommand("zip", ["-q", "-r", out.filePath, "."], { cwd: record.path, timeoutMs: 120000 });
  return result.ok ? { ok: true, path: out.filePath } : { ok: false, error: result.stderr || "Falha ao empacotar extensão. Instale o pacote zip." };
}

// ------------------------------------------------------------------
// 4.1.0 — Detector e downloader de mídia
// ------------------------------------------------------------------

function headerFirst(headers, name) {
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : null;
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}
function classifyMedia(urlValue, mimeValue, resourceType = "", responseHeaders = {}, pageUrl = "") {
  return classifyMediaObservation({ url: urlValue, mimeType: mimeValue, resourceType, responseHeaders, pageUrl });
}
function tabByWebContentsId(id) {
  const targetId = Number(id);
  for (const context of browserContexts.values()) {
    for (const tab of context.tabs.values()) {
      if (tab.view && !tab.view.webContents.isDestroyed() && tab.view.webContents.id === targetId) return tab;
    }
  }
  return null;
}
function contextForTab(targetTab) {
  if (!targetTab) return null;
  for (const context of browserContexts.values()) {
    if ([...context.tabs.values()].includes(targetTab)) return context;
  }
  return null;
}
function pdfNameFromUrl(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ""));
    const base = decodeURIComponent(path.basename(parsed.pathname || ""));
    return safeFilename(base && /\.pdf$/i.test(base) ? base : "documento.pdf", "documento.pdf");
  } catch {
    return "documento.pdf";
  }
}
function openPdfInReader(context, url, { name = "" } = {}) {
  if (!context || !/^https?:\/\//i.test(String(url || ""))) return null;
  return createInternalTab(context, "pdf", {
    activate: true,
    privateMode: Boolean(context.privateMode),
    pdfSource: { kind: "url", url: String(url), name: name || pdfNameFromUrl(url) },
  });
}
function mediaCandidateId(url, kind) { return crypto.createHash("sha256").update(`${kind}:${url}`).digest("hex").slice(0, 24); }
function markTabDrmProtected(tab) {
  if (!tab) return;
  drmProtectedTabs.add(tab.id);
  const map = mediaCandidatesByTab.get(tab.id);
  if (map) {
    for (const [id, candidate] of map.entries()) map.set(id, { ...candidate, protected: true, drm: true });
  }
  if (tab.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("browser:media-changed", { tabId: tab.id, count: (map || new Map()).size });
  }
}
function candidateFilename(urlValue, kind, mimeType, container = "") {
  try {
    const u = new URL(urlValue); let name = decodeURIComponent(path.basename(u.pathname || ""));
    if (name && name.includes(".")) return safeFilename(name, kind === "audio" ? "audio" : kind === "manifest" ? "manifest" : "video");
  } catch {}
  const mime=String(mimeType||"").toLowerCase(); const c=String(container||"").toLowerCase();
  let ext = "bin";
  if (kind === "manifest") ext = c === "dash" ? "mpd" : c === "hls" ? "m3u8" : "manifest";
  else if (kind === "audio") ext = mime.includes("mpeg") ? "mp3" : c === "mp4" ? "m4a" : c === "webm" ? "webm" : c === "ogg" ? "ogg" : c === "opus" ? "opus" : "audio";
  else ext = c === "mp4" ? "mp4" : c === "webm" ? "webm" : "video";
  return `${kind}-${Date.now()}.${ext}`;
}
function addMediaCandidate(tab, input) {
  if (!tab || tab.internalPage || tab.private) return;
  const url = String(input.url || "");
  if (!/^https?:\/\//i.test(url)) return;
  const info = classifyMedia(url, input.mimeType, input.resourceType, input.responseHeaders || {}, tab.url || "");
  if (!info) return;
  const map = mediaCandidatesByTab.get(tab.id) || new Map();
  const id = info.id || mediaCandidateId(url, info.kind);
  const previous = map.get(id) || {};
  map.set(id, { ...previous, ...info, id, url, filename: input.filename || previous.filename || candidateFilename(url, info.kind, info.mimeType, info.container), source: input.source || info.source || "rede", detectedAt: Date.now(), contentLength: Number(input.contentLength || info.contentLength || previous.contentLength || 0), pageUrl: tab.url || "", protected: Boolean(drmProtectedTabs.has(tab.id)), drm: Boolean(drmProtectedTabs.has(tab.id)) });
  while (map.size > 60) map.delete(map.keys().next().value);
  mediaCandidatesByTab.set(tab.id, map);
  if (tab.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
    const previousTimer = mediaNotifyTimers.get(tab.id);
    if (previousTimer) clearTimeout(previousTimer);
    mediaNotifyTimers.set(tab.id, setTimeout(() => {
      mediaNotifyTimers.delete(tab.id);
      if (tab.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("browser:media-changed", { tabId: tab.id, count: (mediaCandidatesByTab.get(tab.id) || new Map()).size });
      }
    }, 180));
  }
}
function configureMediaDetection(targetSession) {
  targetSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    try {
      const tab = tabByWebContentsId(details.webContentsId);
      if (tab && shouldInterceptPdfResponse(details)) {
        const context = contextForTab(tab);
        if (context) {
          setImmediate(() => openPdfInReader(context, details.url, { name: pdfNameFromUrl(details.url) }));
          callback({ cancel: true });
          return;
        }
      }
      if (tab) {
        const type = headerFirst(details.responseHeaders, "content-type");
        const length = Number(headerFirst(details.responseHeaders, "content-length") || 0);
        addMediaCandidate(tab, { url: details.url, mimeType: type, resourceType: details.resourceType, contentLength: length, responseHeaders: details.responseHeaders, source: "rede" });
      }
    } catch (error) { console.warn("[Media detector]", error); }
    callback({ responseHeaders: details.responseHeaders });
  });
}
async function scanActiveMedia(context = mainBrowserContext) {
  const tab = activeTab(context);
  if (!tab?.view || tab.private || tab.view.webContents.isDestroyed()) return { count: 0, items: [], private: Boolean(tab?.private), usesMediaSource: false };
  let usesMediaSource = false;
  for (const frame of tab.view.webContents.mainFrame.framesInSubtree) {
    if (!frame || frame.detached) continue;
    try {
      const found = await frame.executeJavaScript(`(() => {
        const out=[]; let usesMediaSource=false;
        for(const el of document.querySelectorAll('audio,video')){
          const u=el.currentSrc||el.src||'';
          if(/^blob:/i.test(u)) usesMediaSource=true;
          if(/^https?:/i.test(u)) out.push({url:u,kind:el.tagName.toLowerCase()==='audio'?'audio':'video',mimeType:el.getAttribute('type')||''});
        }
        for(const e of performance.getEntriesByType('resource').slice(-400)){
          const u=String(e.name||'');
          if(/\.(?:mp3|m4a|aac|ogg|opus|flac|wav|mp4|webm|mov|m4v|m3u8|mpd)(?:[?#]|$)/i.test(u)) out.push({url:u,kind:/\.(?:mp3|m4a|aac|ogg|opus|flac|wav)(?:[?#]|$)/i.test(u)?'audio':'video',mimeType:''});
        }
        return {items:out.slice(0,120),usesMediaSource};
      })()`, false);
      if (found?.usesMediaSource) usesMediaSource = true;
      for (const item of Array.isArray(found?.items) ? found.items : []) {
        if (/^https?:\/\//i.test(String(item?.url || ""))) addMediaCandidate(tab, { ...item, source: "player" });
      }
    } catch {}
  }
  const map = mediaCandidatesByTab.get(tab.id) || new Map();
  const items = groupMediaObservations([...map.values()]).slice(0, 40);
  return { count: items.length, items, private: false, usesMediaSource };
}
function locateMediaCandidate(context, id) {
  const tab = activeTab(context); if (!tab) return null;
  return (mediaCandidatesByTab.get(tab.id) || new Map()).get(String(id || "")) || null;
}
async function findFfmpegExecutable() {
  const candidates = [];
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "bin", executableName));
    candidates.push(path.join(path.dirname(process.execPath), "bin", executableName));
  }
  candidates.push(path.join(ROOT, "bin", executableName));
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  return await new Promise((resolve) => {
    const command = process.platform === "win32" ? "where.exe" : "which";
    const child = spawn(command, ["ffmpeg"], { windowsHide: true }); let out = "";
    const timer = setTimeout(() => { try { child.kill(); } catch {}; resolve(""); }, 2500);
    child.stdout?.on("data", (d) => { out += String(d); });
    child.on("error", () => { clearTimeout(timer); resolve(""); });
    child.on("close", (code) => { clearTimeout(timer); const first = out.split(/\r?\n/).map((x)=>x.trim()).find(Boolean) || ""; resolve(code === 0 && first ? first : ""); });
  });
}
async function mediaCapabilities() { const ffmpeg = await findFfmpegExecutable(); return { directDownload: true, ffmpeg: Boolean(ffmpeg), ffmpegPath: ffmpeg ? path.basename(ffmpeg) : "", note: ffmpeg ? "Conversão MP3/MP4 disponível." : "Download original disponível. Conversão de streams segmentados requer FFmpeg instalado no sistema ou em MarshMallow/bin." }; }
async function cookieHeaderForUrl(ses, url) {
  try { const cookies = await ses.cookies.get({ url }); return cookies.map((c) => `${c.name}=${c.value}`).join("; "); } catch { return ""; }
}
async function runFfmpegForCandidate(context, candidate, format) {
  const tab = activeTab(context); if (!tab?.view) throw new Error("Aba de mídia indisponível.");
  const ffmpeg = await findFfmpegExecutable(); if (!ffmpeg) throw new Error("Para converter para MP3/MP4 ou baixar HLS/DASH, instale FFmpeg no sistema ou coloque o executável ffmpeg na pasta MarshMallow/bin.");
  if (!context?.window || context.window.isDestroyed()) throw new Error("Janela indisponível.");
  const ext = format === "mp3" ? "mp3" : "mp4";
  const base = safeFilename((tab.title || candidate.kind || "midia").replace(/\.[^.]+$/, ""), "midia");
  const out = await dialog.showSaveDialog(context.window, { title: `Salvar ${format.toUpperCase()} — MarshMallow`, defaultPath: path.join(browserPreferences.downloadPath || app.getPath("downloads"), `${base}.${ext}`), filters: [{ name: format.toUpperCase(), extensions: [ext] }] });
  if (out.canceled || !out.filePath) return { ok: false, canceled: true };
  const ses = tab.view.webContents.session; const cookie = await cookieHeaderForUrl(ses, candidate.url);
  const headerText = [`Referer: ${tab.url || candidate.pageUrl || ""}`, `User-Agent: ${userAgentForUrl(candidate.url)}`, cookie ? `Cookie: ${cookie}` : ""].filter(Boolean).join("\\r\\n") + "\\r\\n";
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-headers", headerText, "-i", candidate.url];
  if (format === "mp3") args.push("-vn", "-c:a", "libmp3lame", "-b:a", "192k", out.filePath);
  else args.push("-map", "0:v:0?", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", out.filePath);
  const result = await new Promise((resolve) => { const child = spawn(ffmpeg, args, { windowsHide: true }); let err=""; child.stderr?.on("data", (d)=>{ if(err.length<20000) err += String(d); }); child.on("error", (e)=>resolve({ok:false,error:String(e?.message||e)})); child.on("close", (code)=>resolve({ok:code===0,error:err.trim()})); });
  if (!result.ok) { try { fs.rmSync(out.filePath, { force: true }); } catch {} throw new Error(result.error || "FFmpeg não conseguiu converter esta mídia."); }
  return { ok: true, path: out.filePath, format };
}

async function mergeMediaCandidate(context, videoId) {
  const tab=activeTab(context); if(!tab?.view)return {ok:false,error:"Aba de mídia indisponível."};
  const items=[...(mediaCandidatesByTab.get(tab.id)||new Map()).values()];
  const pair=selectMergePair(items,videoId); if(!pair)return {ok:false,error:"Não encontrei um fluxo de áudio compatível para este vídeo."};
  const ffmpeg=await findFfmpegExecutable(); if(!ffmpeg)return {ok:false,error:"Vídeo + áudio requer FFmpeg instalado no sistema ou em MarshMallow/bin."};
  const mergeExt = pair.video.container === "mp4" && pair.audio.container === "mp4" ? "mp4" : "mkv";
  const mergeFilter = mergeExt === "mp4" ? {name:"Vídeo MP4",extensions:["mp4"]} : {name:"Vídeo Matroska",extensions:["mkv"]};
  const out=await dialog.showSaveDialog(context.window,{title:"Salvar vídeo + áudio — MarshMallow",defaultPath:path.join(browserPreferences.downloadPath||app.getPath("downloads"),`${safeFilename(tab.title||"video","video")}.${mergeExt}`),filters:[mergeFilter]});
  if(out.canceled||!out.filePath)return {ok:false,canceled:true};
  const ses=tab.view.webContents.session;
  const videoCookie=await cookieHeaderForUrl(ses,pair.video.url);
  const audioCookie=await cookieHeaderForUrl(ses,pair.audio.url);
  const videoHeaders=[`Referer: ${tab.url||""}`,`User-Agent: ${userAgentForUrl(pair.video.url)}`,videoCookie?`Cookie: ${videoCookie}`:""].filter(Boolean).join("\\r\\n")+"\\r\\n";
  const audioHeaders=[`Referer: ${tab.url||""}`,`User-Agent: ${userAgentForUrl(pair.audio.url)}`,audioCookie?`Cookie: ${audioCookie}`:""].filter(Boolean).join("\\r\\n")+"\\r\\n";
  const args=["-y","-hide_banner","-loglevel","error","-headers",videoHeaders,"-i",pair.video.url,"-headers",audioHeaders,"-i",pair.audio.url,"-map","0:v:0","-map","1:a:0","-c","copy","-movflags","+faststart",out.filePath];
  const result=await new Promise((resolve)=>{const child=spawn(ffmpeg,args,{windowsHide:true});let err="";child.stderr?.on("data",(d)=>{if(err.length<20000)err+=String(d)});child.on("error",(e)=>resolve({ok:false,error:String(e?.message||e)}));child.on("close",(code)=>resolve({ok:code===0,error:err.trim()}));});
  if(!result.ok){try{fs.rmSync(out.filePath,{force:true})}catch{}return {ok:false,error:result.error||"FFmpeg não conseguiu combinar os fluxos."};}
  return {ok:true,path:out.filePath,format:"merge"};
}
async function downloadMediaCandidate(context, id, format = "original") {
  const tab = activeTab(context); const candidate = locateMediaCandidate(context, id);
  if (!tab?.view || !candidate) return { ok: false, error: "Mídia não encontrada na aba atual." };
  if (!/^https?:\/\//i.test(candidate.url)) return { ok: false, error: "Esta mídia não possui uma URL HTTP(S) reutilizável." };
  if (candidate.protected || candidate.drm) return { ok: false, error: "Esta mídia usa conteúdo protegido por DRM. O MarshMallow não descriptografa nem contorna DRM." };
  try {
    if (format === "merge") return await mergeMediaCandidate(context, id);
    if (format === "mp3" || format === "mp4") return await runFfmpegForCandidate(context, candidate, format);
    pendingDownloadNames.set(candidate.url, candidate.filename);
    const headers = { Referer: tab.url || candidate.pageUrl || "", "User-Agent": userAgentForUrl(candidate.url) };
    tab.view.webContents.session.downloadURL(candidate.url, { headers });
    return { ok: true, started: true, filename: candidate.filename };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

async function saveWallpaperCopy(payload = {}) {
  if (!mainWindow) return { ok: false, error: "Janela indisponível." };
  try {
    const bytes = await wallpaperJpegBuffer(payload.source);
    const name = `${sanitizeWallpaperName(payload.name)}.jpg`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Salvar wallpaper",
      defaultPath: path.join(app.getPath("downloads"), name),
      filters: [{ name: "Imagem JPEG", extensions: ["jpg", "jpeg"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(result.filePath, bytes);
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function applyWallpaperToWindows(payload = {}) {
  if (process.platform !== "win32") return { ok: false, error: "Este recurso está disponível no Windows." };
  const target = payload.target === "lockscreen" ? "lockscreen" : "desktop";
  try {
    const file = await materializeWallpaperForWindows(payload.source, payload.name, target);
    if (target === "desktop") {
      const script = `
$ErrorActionPreference = 'Stop'
$path = $env:MM_WALLPAPER_PATH
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value '0'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MarshMallowWallpaperNative {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool SystemParametersInfo(int action, int param, string value, int flags);
}
"@
if (-not [MarshMallowWallpaperNative]::SystemParametersInfo(20, 0, $path, 3)) { exit 7 }
`;
      const result = await runPowerShellScript(script, { MM_WALLPAPER_PATH: file });
      if (!result.ok) throw new Error(result.stderr.trim() || `O Windows recusou a alteração (código ${result.code}).`);
      return { ok: true, target, path: file };
    }

    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.System.UserProfile.UserProfilePersonalizationSettings, Windows.System.UserProfile, ContentType=WindowsRuntime]
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Await-WinRT($operation, [Type]$resultType) {
  $method = $asTaskGeneric.MakeGenericMethod($resultType)
  $task = $method.Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}
if (-not [Windows.System.UserProfile.UserProfilePersonalizationSettings]::IsSupported()) { exit 8 }
$file = Await-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:MM_WALLPAPER_PATH)) ([Windows.Storage.StorageFile])
$settings = [Windows.System.UserProfile.UserProfilePersonalizationSettings]::Current
$ok = Await-WinRT ($settings.TrySetLockScreenImageAsync($file)) ([bool])
if (-not $ok) { exit 9 }
`;
    const result = await runPowerShellScript(script, { MM_WALLPAPER_PATH: file });
    if (!result.ok) {
      // Alguns PCs corporativos/políticas do Windows bloqueiam a API. Nesse caso
      // oferecemos a página nativa de personalização sem fingir que aplicamos.
      return { ok: false, target, path: file, error: result.stderr.trim() || "O Windows não permitiu alterar a tela de bloqueio. Verifique as políticas de personalização do sistema." };
    }
    return { ok: true, target, path: file };
  } catch (error) {
    return { ok: false, target, error: String(error?.message || error) };
  }
}

function findAudibleTabs(context = mainBrowserContext) {
  if (!context) return { count: 0, tabs: [] };
  const audible = [];
  const currentActiveId = contextActiveTabId(context);
  for (const tab of context.tabs.values()) {
    if (!tab.view || tab.sleeping || tab.view.webContents.isDestroyed()) continue;
    const wc = tab.view.webContents;
    let isAudible = false;
    try { isAudible = wc.isCurrentlyAudible() && !wc.isAudioMuted(); } catch {}
    if (!isAudible) continue;
    audible.push({ id: tab.id, title: tab.title || wc.getTitle() || "Aba sem título", url: tab.url || wc.getURL() || "", active: tab.id === contextActiveTabId(context) });
  }
  return { count: audible.length, tabs: audible };
}

function sleepBackgroundTabs(context = mainBrowserContext) {
  if (!context) return { ok: false, suspended: 0, alreadySleeping: 0, skipped: 0 };
  let suspended = 0;
  let alreadySleeping = 0;
  let skipped = 0;
  const currentActiveId = contextActiveTabId(context);
  for (const tab of context.tabs.values()) {
    if (tab.id === currentActiveId || tab.internalPage || !tab.view || tab.view.webContents.isDestroyed()) { skipped += 1; continue; }
    if (tab.sleeping) { alreadySleeping += 1; continue; }
    if (context.currentWatchSession?.tabId === tab.id) { skipped += 1; continue; }
    const wc = tab.view.webContents;
    tab.sleeping = true;
    tab.sleepingUrl = tab.url || wc.getURL() || currentNewTabUrl();
    tab.sleepingTitle = tab.title || wc.getTitle() || "Aba suspensa";
    tab.sleepingFavicon = tab.favicon || "";
    tab.loading = false;
    try { wc.stop(); } catch {}
    try { wc.setAudioMuted(true); } catch {}
    wc.loadURL("about:blank").catch(() => {});
    suspended += 1;
  }
  emitContextState(context);
  return { ok: true, suspended, alreadySleeping, skipped };
}

function wakeSleepingTab(tab) {
  if (!tab?.sleeping || !tab.view || tab.view.webContents.isDestroyed()) return false;
  const wc = tab.view.webContents;
  const target = tab.sleepingUrl || tab.url || currentNewTabUrl();
  tab.sleeping = false;
  tab.loading = true;
  tab.url = target;
  tab.title = tab.sleepingTitle || tab.title;
  tab.favicon = tab.sleepingFavicon || tab.favicon;
  delete tab.sleepingUrl;
  delete tab.sleepingTitle;
  delete tab.sleepingFavicon;
  syncTabAudioMute(tab);
  applyCompatibleUserAgent(wc, target);
  wc.loadURL(target).catch(() => {});
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageHttpUrl(tab) {
  const raw = tab?.view?.webContents?.getURL?.() || tab?.url || "";
  return safeHttpUrl(raw)?.href || "";
}

async function savePageAs(context, tab) {
  if (!context?.window || context.window.isDestroyed() || !tab) return;
  const wc = tab.view.webContents;
  const defaultName = `${safeFilename(wc.getTitle() || tab.title || "pagina")}.html`;
  try {
    const result = await dialog.showSaveDialog(context.window, {
      title: "Salvar página como",
      defaultPath: path.join(app.getPath("downloads"), defaultName),
      filters: [
        { name: "Página da Web completa", extensions: ["html", "htm"] },
        { name: "Todos os arquivos", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) return;
    await wc.savePage(result.filePath, "HTMLComplete");
  } catch (error) {
    dialog.showErrorBox("MarshMallow — Salvar página", `Não foi possível salvar esta página.\n\n${String(error)}`);
  }
}

function printPage(tab) {
  if (!tab) return;
  const wc = tab.view.webContents;
  try {
    wc.print({ silent: false, printBackground: true }, (success, failureReason) => {
      if (!success && failureReason && !/cancel/i.test(failureReason)) {
        dialog.showErrorBox("MarshMallow — Imprimir", `Não foi possível imprimir esta página.\n\n${failureReason}`);
      }
    });
  } catch (error) {
    dialog.showErrorBox("MarshMallow — Imprimir", `Não foi possível abrir a impressão.\n\n${String(error)}`);
  }
}

function googleTranslateUrl(url) {
  return `https://translate.google.com/translate?sl=auto&tl=pt&u=${encodeURIComponent(url)}`;
}

function translatePageToPortuguese(context, tab, { newTab = false } = {}) {
  const url = pageHttpUrl(tab);
  if (!url) return;
  const translated = googleTranslateUrl(url);
  if (newTab) {
    createTab(context, translated, { activate: true, privateMode: Boolean(context.privateMode || tab.private) });
  } else {
    applyCompatibleUserAgent(tab.view.webContents, translated);
    tab.view.webContents.loadURL(translated).catch(() => {});
  }
}

async function showPageQrCode(context, tab) {
  const url = pageHttpUrl(tab);
  if (!url || !context?.window || context.window.isDestroyed()) return;

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 340,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const title = safeFilename(tab.view.webContents.getTitle() || "Página", "Página");
    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QR code — MarshMallow</title>
<style>
  *{box-sizing:border-box} html,body{margin:0;min-height:100%;font-family:Segoe UI,Arial,sans-serif;background:#111418;color:#f5f5f5}
  body{display:flex;align-items:center;justify-content:center;padding:24px}
  main{width:min(390px,100%);text-align:center}.brand{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#c7cbd1;margin-bottom:9px}
  h1{font-size:19px;margin:0 0 5px;font-weight:650}.hint{font-size:12px;color:#9ba3ad;margin:0 0 18px}
  .qr{background:#fff;border-radius:18px;padding:14px;display:inline-flex;box-shadow:0 16px 50px rgba(0,0,0,.42)}
  .qr img{display:block;width:300px;height:300px;max-width:72vw;max-height:72vw}
  .url{margin:16px auto 0;padding:10px 12px;border:1px solid #303640;background:#191d23;border-radius:10px;font-size:11px;line-height:1.45;color:#cbd1d8;word-break:break-all;text-align:left}
</style></head><body><main>
<div class="brand">MarshMallow</div><h1>${escapeHtml(title)}</h1><p class="hint">Aponte a câmera do celular para abrir esta página.</p>
<div class="qr"><img alt="QR code da página" src="${qrDataUrl}"></div><div class="url">${escapeHtml(url)}</div>
</main></body></html>`;

    const qrWindow = new BrowserWindow({
      width: 430,
      height: 560,
      parent: context.window,
      modal: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      backgroundColor: "#111418",
      icon: APP_ICON,
      title: "QR code — MarshMallow",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    await qrWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } catch (error) {
    dialog.showErrorBox("MarshMallow — QR code", `Não foi possível criar o QR code.\n\n${String(error)}`);
  }
}

function openPageSource(context, tab) {
  const url = pageHttpUrl(tab);
  if (!url) return;
  createTab(context, `view-source:${url}`, { activate: true, privateMode: Boolean(context.privateMode || tab.private) });
}

function appendSpellingSuggestions(template, wc, params) {
  if (!params?.isEditable || !browserPreferences.spellcheckEnabled || !params.misspelledWord) return;
  const suggestions = Array.isArray(params.dictionarySuggestions) ? params.dictionarySuggestions.slice(0, 6) : [];
  if (suggestions.length) {
    for (const suggestion of suggestions) {
      template.push({
        label: suggestion,
        click: () => {
          try { wc.replaceMisspelling(suggestion); } catch {}
        },
      });
    }
  } else {
    template.push({ label: `Sem sugestão para “${String(params.misspelledWord).slice(0, 42)}”`, enabled: false });
  }
  template.push({
    label: `Adicionar “${String(params.misspelledWord).slice(0, 36)}” ao dicionário`,
    click: () => {
      try { wc.session.addWordToSpellCheckerDictionary(String(params.misspelledWord)); } catch {}
    },
  });
  template.push({ type: "separator" });
}

function installContextMenu(context, tab) {
  const wc = tab.view.webContents;
  wc.on("context-menu", (_event, params) => {
    const template = [];
    const nav = wc.navigationHistory;
    const pageUrl = pageHttpUrl(tab);

    if (!params.linkURL && !params.selectionText && !params.isEditable && params.mediaType === "none") {
      sendToContextShell(context, "ui:page-context");
    }

    if (params.linkURL) {
      template.push(
        {
          label: "Abrir link em nova aba",
          click: () => createTab(
            context,
            params.linkURL,
            {
              activate: false,
              privateMode: Boolean(
                context.privateMode ||
                tab.private
              ),
            }
          ),
        },
        {
          label: "Abrir link em nova aba privada",
          click: () => createTab(
            context,
            params.linkURL,
            {
              activate: false,
              privateMode: true,
            }
          ),
        },
        {
          label: "Abrir link em nova janela privada",
          click: () =>
            void createPrivateWindow(
              params.linkURL
            ),
        },
        {
          label: "Copiar endereço do link",
          click: () =>
            clipboard.writeText(
              params.linkURL
            ),
        },
        { type: "separator" },
      );
    }

    if (params.mediaType === "image" && params.srcURL) {
      template.push(
        {
          label: "Abrir imagem em nova aba",
          click: () => createTab(
            context,
            params.srcURL,
            {
              activate: true,
              privateMode: Boolean(
                context.privateMode ||
                tab.private
              ),
            }
          ),
        },
        { label: "Copiar endereço da imagem", click: () => clipboard.writeText(params.srcURL) },
        { type: "separator" },
      );
    }

    appendSpellingSuggestions(template, wc, params);

    // Em caixas de texto, o menu de edição sempre tem prioridade.
    // Antes, quando havia texto selecionado dentro de um input/textarea,
    // selectionText era tratado primeiro e o menu perdia Recortar/Colar/Selecionar tudo.
    if (params.isEditable) {
      const flags = params.editFlags || {};
      template.push(
        { label: "Recortar", accelerator: "CmdOrCtrl+X", enabled: flags.canCut !== false, click: () => wc.cut() },
        { label: "Copiar", accelerator: "CmdOrCtrl+C", enabled: flags.canCopy !== false, click: () => wc.copy() },
        { label: "Colar", accelerator: "CmdOrCtrl+V", enabled: flags.canPaste !== false, click: () => wc.paste() },
        { type: "separator" },
        { label: "Selecionar tudo", accelerator: "CmdOrCtrl+A", enabled: flags.canSelectAll !== false, click: () => wc.selectAll() },
        { type: "separator" },
      );
    } else if (params.selectionText) {
      template.push(
        { label: "Copiar", accelerator: "CmdOrCtrl+C", click: () => wc.copy() },
        {
          label: `Pesquisar "${params.selectionText.slice(0, 38)}${params.selectionText.length > 38 ? "…" : ""}"`,
          click: () => createTab(
            context,
            currentSearchUrl(
              params.selectionText
            ),
            {
              activate: true,
              privateMode: Boolean(
                context.privateMode ||
                tab.private
              ),
            }
          ),
        },
        { type: "separator" },
      );
    }

    template.push(
      { label: "Voltar", accelerator: "Alt+Left", enabled: nav.canGoBack(), click: () => nav.goBack() },
      { label: "Avançar", accelerator: "Alt+Right", enabled: nav.canGoForward(), click: () => nav.goForward() },
      { label: "Recarregar", accelerator: "CmdOrCtrl+R", click: () => wc.reload() },
      { type: "separator" },
      { label: "Salvar como…", accelerator: "CmdOrCtrl+S", click: () => void savePageAs(context, tab) },
      { label: "Imprimir…", accelerator: "CmdOrCtrl+P", click: () => printPage(tab) },
      {
        label: "Transmitir…",
        click: () => sendToContextShell(
          context,
          "ui:open-watch-chat"
        ),
      },
      { type: "separator" },
      {
        label: "Criar QR code para esta página",
        enabled: Boolean(pageUrl),
        click: () => void showPageQrCode(context, tab),
      },
      { type: "separator" },
      {
        label: "Traduzir para o português",
        enabled: Boolean(pageUrl),
        click: () => translatePageToPortuguese(context, tab, { newTab: false }),
      },
      {
        label: "Immersive Translation",
        enabled: Boolean(pageUrl),
        click: () => translatePageToPortuguese(context, tab, { newTab: true }),
      },
      { type: "separator" },
      {
        label: "Exibir código fonte da página",
        accelerator: "CmdOrCtrl+U",
        enabled: Boolean(pageUrl),
        click: () => openPageSource(context, tab),
      },
      { label: "Inspecionar", click: () => wc.inspectElement(params.x, params.y) },
    );

    Menu.buildFromTemplate(template).popup({ window: context.window });
  });
}

function installShellTextContextMenu(context = mainBrowserContext) {
  if (!context?.window || context.window.isDestroyed()) return;
  const wc = context.window.webContents;
  wc.on("context-menu", (_event, params) => {
    if (!params.isEditable) return;
    const flags = params.editFlags || {};
    const template = [];
    appendSpellingSuggestions(template, wc, params);
    template.push(
      { label: "Recortar", accelerator: "CmdOrCtrl+X", enabled: flags.canCut !== false, click: () => wc.cut() },
      { label: "Copiar", accelerator: "CmdOrCtrl+C", enabled: flags.canCopy !== false, click: () => wc.copy() },
      { label: "Colar", accelerator: "CmdOrCtrl+V", enabled: flags.canPaste !== false, click: () => wc.paste() },
      { type: "separator" },
      { label: "Selecionar tudo", accelerator: "CmdOrCtrl+A", enabled: flags.canSelectAll !== false, click: () => wc.selectAll() },
    );
    Menu.buildFromTemplate(template).popup({ window: context.window });
  });
}

function focusAddressBar(context = mainBrowserContext) {
  if (shuttingDown || !context?.window) return;

  const targetWindow = context.window;

  if (targetWindow.isDestroyed()) return;

  try {
    targetWindow.webContents.focus();
  } catch {}

  sendToContextShell(context, "ui:focus-address");
}
function handleShellShortcuts(context = mainBrowserContext) {
  const targetContext =
    context || mainBrowserContext;

  const targetWindow =
    targetContext?.window;

  if (
    !targetWindow ||
    targetWindow.isDestroyed()
  ) {
    return;
  }

  targetWindow.webContents.on(
    "before-input-event",
    (event, input) => {
      if (input.type !== "keyDown") return;

      const key =
        String(input.key || "").toLowerCase();

      const ctrl =
        input.control || input.meta;

      if (
        ctrl &&
        !input.shift &&
        key === "w"
      ) {
        event.preventDefault();

        const id =
          contextActiveTabId(
            targetContext
          );

        if (id) {
          void closeTab(
            targetContext,
            id
          );
        }

      } else if (
        ctrl &&
        !input.shift &&
        key === "t"
      ) {
        event.preventDefault();

        const currentTab =
          activeTab(targetContext);

        createTab(
          targetContext,
          currentNewTabUrl(),
          {
            activate: true,
            privateMode: Boolean(
              targetContext.privateMode ||
              currentTab?.private
            ),
          }
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "n"
      ) {
        event.preventDefault();

        void createPrivateWindow(
          currentNewTabUrl()
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "t"
      ) {
        event.preventDefault();

        reopenClosedTab(
          targetContext
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "m"
      ) {
        event.preventDefault();
        sendToContextShell(targetContext, "ui:open-ai");

      } else if (
        ctrl &&
        !input.shift &&
        key === "l"
      ) {
        event.preventDefault();
        focusAddressBar(targetContext);

      } else if (
        ctrl &&
        !input.shift &&
        key === "j"
      ) {
        event.preventDefault();
        sendToContextShell(
          targetContext,
          "ui:open-downloads"
        );

      } else if (
        key === "f12" ||
        (
          ctrl &&
          input.shift &&
          key === "i"
        )
      ) {
        event.preventDefault();

        const tab =
          activeTab(targetContext);

        if (tab?.view) {
          tab.view.webContents.openDevTools({
            mode: "detach",
          });
        } else {
          targetWindow.webContents.openDevTools({
            mode: "detach",
          });
        }

      } else if (
        ctrl &&
        input.shift &&
        key === "e"
      ) {
        event.preventDefault();

        const currentTab =
          activeTab(targetContext);

        createInternalTab(
          targetContext,
          "extensions",
          {
            activate: true,
            privateMode: Boolean(
              targetContext.privateMode ||
              currentTab?.private
            ),
          }
        );
      }
    }
  );
}
function handleTabShortcuts(context, tab) {
  const targetContext =
    context || mainBrowserContext;

  const wc =
    tab.view.webContents;

  wc.on(
    "before-input-event",
    (event, input) => {
      if (input.type !== "keyDown") return;

      const key =
        String(input.key || "").toLowerCase();

      const ctrl =
        input.control || input.meta;

      if (
        ctrl &&
        !input.shift &&
        key === "w"
      ) {
        event.preventDefault();

        void closeTab(
          targetContext,
          tab.id
        );

      } else if (
        ctrl &&
        !input.shift &&
        key === "t"
      ) {
        event.preventDefault();

        createTab(
          targetContext,
          currentNewTabUrl(),
          {
            activate: true,
            privateMode: Boolean(
              targetContext.privateMode ||
              tab.private
            ),
          }
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "n"
      ) {
        event.preventDefault();

        void createPrivateWindow(
          currentNewTabUrl()
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "t"
      ) {
        event.preventDefault();

        reopenClosedTab(
          targetContext
        );

      } else if (
        ctrl &&
        input.shift &&
        key === "m"
      ) {
        event.preventDefault();
        sendToContextShell(targetContext, "ui:open-ai");

      } else if (
        ctrl &&
        !input.shift &&
        key === "l"
      ) {
        event.preventDefault();
        focusAddressBar(context);

      } else if (
        ctrl &&
        !input.shift &&
        key === "j"
      ) {
        event.preventDefault();
        sendToContextShell(
          targetContext,
          "ui:open-downloads"
        );

      } else if (
        key === "f12" ||
        (
          ctrl &&
          input.shift &&
          key === "i"
        )
      ) {
        event.preventDefault();

        wc.openDevTools({
          mode: "detach",
        });

      } else if (
        ctrl &&
        input.shift &&
        key === "e"
      ) {
        event.preventDefault();

        createInternalTab(
          targetContext,
          "extensions",
          {
            activate: true,
            privateMode: Boolean(
              targetContext.privateMode ||
              tab.private
            ),
          }
        );

      } else if (
        (ctrl && key === "r") ||
        key === "f5"
      ) {
        event.preventDefault();
        wc.reload();

      } else if (
        ctrl &&
        !input.shift &&
        key === "s"
      ) {
        event.preventDefault();
        void savePageAs(tab);

      } else if (
        ctrl &&
        !input.shift &&
        key === "p"
      ) {
        event.preventDefault();
        printPage(tab);

      } else if (
        ctrl &&
        !input.shift &&
        key === "u"
      ) {
        event.preventDefault();
        openPageSource(tab);

      } else if (
        input.alt &&
        key === "arrowleft"
      ) {
        event.preventDefault();

        if (
          wc.navigationHistory.canGoBack()
        ) {
          wc.navigationHistory.goBack();
        }

      } else if (
        input.alt &&
        key === "arrowright"
      ) {
        event.preventDefault();

        if (
          wc.navigationHistory.canGoForward()
        ) {
          wc.navigationHistory.goForward();
        }
      }
    }
  );
}
function syncTabAudioMute(tab) {
  if (!tab?.view || tab.view.webContents.isDestroyed()) return;
  const effectiveMuted = Boolean(tab.userMuted || tab.deferMediaUntilActivated);
  try { tab.view.webContents.setAudioMuted(effectiveMuted); } catch {}
}

function backgroundMediaGuardScript() {
  return `(() => {
    const KEY = "__marshmallowBackgroundMediaGuard";
    if (window[KEY]) {
      window[KEY].setBlocked(true, false);
      return true;
    }
    let blocked = true;
    const resumeTargets = new Set();
    const rememberAndPause = (media) => {
      if (!(media instanceof HTMLMediaElement)) return;
      try {
        if (!media.paused && !media.ended) resumeTargets.add(media);
        if (!media.paused) media.pause();
      } catch {}
    };
    const pauseAll = () => {
      try { document.querySelectorAll("video,audio").forEach(rememberAndPause); } catch {}
    };
    document.addEventListener("play", (event) => {
      if (!blocked) return;
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      resumeTargets.add(media);
      queueMicrotask(() => rememberAndPause(media));
    }, true);
    const observer = new MutationObserver(() => { if (blocked) pauseAll(); });
    try { observer.observe(document.documentElement || document, { childList: true, subtree: true }); } catch {}
    window[KEY] = {
      setBlocked(value, resume) {
        blocked = Boolean(value);
        if (blocked) {
          pauseAll();
          return;
        }
        if (resume) {
          const pending = Array.from(resumeTargets);
          resumeTargets.clear();
          for (const media of pending) {
            if (!media?.isConnected || media.ended) continue;
            try {
              const result = media.play();
              if (result && typeof result.catch === "function") result.catch(() => {});
            } catch {}
          }
        } else {
          resumeTargets.clear();
        }
      },
      pauseAll,
    };
    pauseAll();
    return true;
  })();`;
}

function installBackgroundMediaGuard(tab) {
  if (!tab?.view || tab.view.webContents.isDestroyed() || !tab.deferMediaUntilActivated) return;
  syncTabAudioMute(tab);
  tab.view.webContents.executeJavaScript(backgroundMediaGuardScript(), false).catch(() => {});
}

function releaseBackgroundMediaGuard(tab, { resume = true } = {}) {
  if (!tab?.view || tab.view.webContents.isDestroyed() || !tab.deferMediaUntilActivated) return;
  tab.deferMediaUntilActivated = false;
  syncTabAudioMute(tab);
  const code = `(() => {
    const guard = window.__marshmallowBackgroundMediaGuard;
    if (guard && typeof guard.setBlocked === "function") guard.setBlocked(false, ${resume ? "true" : "false"});
  })();`;
  tab.view.webContents.executeJavaScript(code, false).catch(() => {});
}

function wireTab(context, tab) {
  const wc = tab.view.webContents;

  wc.setWindowOpenHandler(({ url, disposition, referrer }) => {
    const openerUrl = wc.getURL() || referrer?.url || tab.url || "";

    if (isPdfUrl(url)) {
      openPdfInReader(context, url, { name: pdfNameFromUrl(url) });
      return { action: "deny" };
    }

    if (browserPreferences.nativeAuthMode === "auto" && isNativeAuthUrl(url)) {
      void openNativeBrowserUrl(url, { reason: "protected-login", context });
      return { action: "deny" };
    }

    // Google/YouTube sometimes starts sign-in as a popup. Creating a brand-new
    // WebContentsView would lose the opener relationship expected by that flow.
    // Keep the authentication in the initiating tab instead.
    if (shouldKeepGoogleAuthInCurrentTab(openerUrl, url)) {
      setImmediate(() => {
        applyCompatibleUserAgent(wc, url);
        wc.loadURL(url).catch((error) => console.warn("[Google auth] Falha ao abrir login na aba atual:", error));
      });
      return { action: "deny" };
    }

    // Chromium disposition "default" means an in-window navigation is valid.
    // Google Search can use that path for a normal result click. Keep it in the
    // current MarshMallow tab and explicitly retain page focus instead of
    // manufacturing another tab and cancelling the original interaction.
    if (String(disposition || "") === "default" && isGoogleSearchResultsUrl(openerUrl) && safeHttpUrl(url)) {
      setImmediate(() => {
        if (wc.isDestroyed()) return;
        tab.focusAfterNavigation = true;
        applyCompatibleUserAgent(wc, url);
        wc.loadURL(url).catch((error) => {
          tab.focusAfterNavigation = false;
          console.warn("[Google navigation] Falha ao abrir resultado:", error);
        });
      });
      return { action: "deny" };
    }

    const popupMode = browserPreferences.popupMode;
    const allowed = popupMode === "allow"
      ? Boolean(safeHttpUrl(url))
      : popupMode === "block"
        ? sameWebOrigin(openerUrl, url)
        : isTrustedPopupOpener(openerUrl)
          ? Boolean(safeHttpUrl(url))
          : shouldOpenAsRequestedTab(openerUrl, url, disposition);

    if (allowed) {
      createTab(
        context,
        url,
        {
          activate:
            disposition !== "background-tab",
          privateMode: Boolean(
            context.privateMode ||
            tab.private
          ),
        }
      );
      console.log(`[Popup guard] allowed disposition=${disposition} ${openerUrl} -> ${url}`);
    } else {
      console.log(`[Popup guard] BLOCKED disposition=${disposition} ${openerUrl} -> ${url}`);
      sendToContextShell(context, "browser:popup-blocked", {
        tabId: tab.id,
        url,
        openerUrl,
      });
    }

    // Conteúdo remoto nunca cria BrowserWindow solta.
    return { action: "deny" };
  });

  installContextMenu(context, tab);
  handleTabShortcuts(context, tab);

  // Players HTML5 (YouTube, animes, streaming etc.) disparam estes eventos.
  // WebContentsView nao deve manter os bounds reservados para o shell nesse
  // momento, senao a barra superior cobre o video.
  wc.on("enter-html-full-screen", () => enterHtmlFullscreen(context, tab));
  wc.on("leave-html-full-screen", () => leaveHtmlFullscreen(context, tab.id));

  wc.on("will-navigate", (event, targetUrl) => {
    const currentUrl = wc.getURL() || tab.url || "";
    if (isPdfUrl(targetUrl)) {
      event.preventDefault();
      openPdfInReader(context, targetUrl, { name: pdfNameFromUrl(targetUrl) });
      return;
    }
    if (browserPreferences.nativeAuthMode === "auto" && isNativeAuthUrl(targetUrl)) {
      event.preventDefault();
      void interceptNativeAuth(context, tab, targetUrl, "protected-login");
      return;
    }

    if (
      isStrictMediaSite(currentUrl) &&
      safeHttpUrl(targetUrl) &&
      !sameWebOrigin(currentUrl, targetUrl) &&
      !isAllowedMediaFamilyTarget(targetUrl)
    ) {
      event.preventDefault();
      console.log(`[Navigation guard] BLOCKED ${currentUrl} -> ${targetUrl}`);
      sendToContextShell(context, "browser:popup-blocked", {
        tabId: tab.id,
        url: targetUrl,
        openerUrl: currentUrl,
      });
    }
  });

  wc.on("will-redirect", (event, targetUrl) => {
    if (browserPreferences.nativeAuthMode === "auto" && isNativeAuthUrl(targetUrl)) {
      event.preventDefault();
      void interceptNativeAuth(context, tab, targetUrl, "protected-login-redirect");
    }
  });

  wc.on("dom-ready", () => {
    if (tab.deferMediaUntilActivated) installBackgroundMediaGuard(tab);
    scheduleUiWork(() => { if (context.tabs.has(tab.id)) void probeGameSignals(context, tab); }, 900);
  });
  wc.on("media-started-playing", () => {
    if (!tab.deferMediaUntilActivated) return;
    syncTabAudioMute(tab);
    wc.executeJavaScript(`(() => {
      const guard = window.__marshmallowBackgroundMediaGuard;
      if (guard && typeof guard.pauseAll === "function") guard.pauseAll();
      else document.querySelectorAll("video,audio").forEach((media) => { try { media.pause(); } catch {} });
    })();`, false).catch(() => {});
  });

  wc.on("did-start-loading", () => {
    if (tab.sleeping) return;
    tab.loading = true;
    emitContextState(context);
  });
  wc.on("did-stop-loading", () => {
    if (tab.sleeping) { emitContextState(context); return; }
    tab.loading = false;
    tab.url = wc.getURL() || tab.url;
    tab.title = wc.getTitle() || tab.title;
    void probeGameSignals(context, tab);
    emitContextState(context);
  });
  wc.on("did-navigate", (_event, url) => {
    if (tab.sleeping && url === "about:blank") return;
    mediaCandidatesByTab.delete(tab.id);
    const mediaTimer = mediaNotifyTimers.get(tab.id); if (mediaTimer) clearTimeout(mediaTimer); mediaNotifyTimers.delete(tab.id);
    tab.url = url;
    if (tab.focusAfterNavigation) {
      tab.focusAfterNavigation = false;
      if (tab.id === contextActiveTabId(context) && !context.shellOnly) {
        try { wc.focus(); } catch {}
      }
    }
    emitContextState(context);
    void handleGoogleVerification(tab, url);
  });
  wc.on("did-navigate-in-page", (_event, url) => {
    if (tab.sleeping && url === "about:blank") return;
    tab.url = url;
    emitContextState(context);
    void handleGoogleVerification(tab, url);
  });
  wc.on("page-title-updated", (_event, title) => {
    if (tab.sleeping) return;
    tab.title = title || tab.title;
    emitContextState(context);
  });
  wc.on("page-favicon-updated", (_event, favicons) => {
    if (tab.sleeping) return;
    if (favicons?.[0]) { tab.favicon = favicons[0]; if (tab.url) faviconByUrl.set(tab.url, favicons[0]); }
    emitContextState(context);
  });
  wc.on("audio-state-changed", () => emitContextState(context));
  wc.on("destroyed", () => { const timer = mediaNotifyTimers.get(tab.id); if (timer) clearTimeout(timer); mediaNotifyTimers.delete(tab.id); mediaCandidatesByTab.delete(tab.id); gameSignalsByTab.delete(tab.id); applyGameScheduler(context); });
  wc.on("render-process-gone", (_event, details) => {
    tab.title = `Falha da página (${details.reason})`;
    emitContextState(context);
  });
  wc.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3) {
      tab.title = `Erro: ${description}`;
      tab.url = url || tab.url;
      emitContextState(context);
    }
  });
}

function isBrowserContext(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.window &&
    value.tabs instanceof Map &&
    Array.isArray(value.closedTabs)
  );
}

function contextActiveTabId(context) {
  if (!context) return null;
  return context.isMain ? activeTabId : context.activeTabId;
}

function setContextActiveTabId(context, value) {
  if (!context) return;

  context.activeTabId = value;

  if (context.isMain) {
    activeTabId = value;
  }
}

function emitContextState(context) {
  if (!context) return;

  if (!sendToContextShell(
    context,
    "browser:state",
    allTabsState(context)
  )) {
    return;
  }

  // Somente a janela normal participa da persistência/restauração.
  // Navegação privada nunca deve entrar em session restore.
  if (context.isMain) {
    scheduleSaveSession();
  }
}

function createInternalTab(context, page, options = {}) {
  // Compatibilidade temporária:
  // createInternalTab(page, options)
  if (!isBrowserContext(context)) {
    options =
      page && typeof page === "object"
        ? page
        : {};

    page = context;
    context = mainBrowserContext;
  }

  if (!context?.window || context.window.isDestroyed()) return null;

  const {
    activate = true,
    privateMode = false,
    pdfSource = null,
  } = options || {};

  const effectivePrivateMode =
    Boolean(context.privateMode || privateMode);

  const meta = internalPageMeta(page);
  if (!meta) return null;

  const id = makeId("internal");

  const tab = {
    id,
    view: null,
    internalPage: String(page),

    title:
      effectivePrivateMode &&
      String(page) === "newtab"
        ? "Nova aba privada"
        : meta.title,

    url: meta.url,
    favicon: "",
    loading: false,
    private: effectivePrivateMode,
    lastActiveAt: Date.now(),
    ...(String(page) === "pdf" && pdfSource && /^https?:\/\//i.test(String(pdfSource.url || ""))
      ? { pdfSource: { kind: "url", url: String(pdfSource.url), name: String(pdfSource.name || "") } }
      : {}),
  };

  context.tabs.set(id, tab);

  if (activate || !contextActiveTabId(context)) {
    activateTab(context, id);
  } else {
    emitContextState(context);
  }

  return id;
}

function createTab(context, input = null, options = {}) {
  // Compatibilidade temporária:
  // createTab(url, options)
  if (!isBrowserContext(context)) {
    options =
      input &&
      typeof input === "object" &&
      !Array.isArray(input)
        ? input
        : {};

    input = context ?? null;
    context = mainBrowserContext;
  }

  if (!context?.window || context.window.isDestroyed()) return null;

  const {
    activate = true,
    privateMode = false,
  } = options || {};

  const effectivePrivateMode =
    Boolean(context.privateMode || privateMode);

  const currentActiveId =
    contextActiveTabId(context);

  const shouldActivate =
    Boolean(activate || !currentActiveId);

  let requestedUrl =
    normalizeUrl(input || currentNewTabUrl());

  if (/^marshmallow:\/\//i.test(requestedUrl)) {
    const page = requestedUrl
      .replace(/^marshmallow:\/\//i, "")
      .split(/[/?#]/)[0];

    if (internalPageMeta(page)) {
      return createInternalTab(
        context,
        page,
        {
          activate,
          privateMode: effectivePrivateMode,
        }
      );
    }
  }

  if (isPdfUrl(requestedUrl)) {
    return openPdfInReader(context, requestedUrl, { name: pdfNameFromUrl(requestedUrl) });
  }

  if (
    browserPreferences.nativeAuthMode === "auto" &&
    isNativeAuthUrl(requestedUrl)
  ) {
    void openNativeBrowserUrl(
      requestedUrl,
      { reason: "protected-login", context }
    );

    requestedUrl = DEFAULT_HOME_URL;
  }

  const id = makeId();

  const view = new WebContentsView({
    webPreferences: {
      partition: effectivePrivateMode
        ? PRIVATE_PARTITION
        : TAB_PARTITION,

      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,

      backgroundThrottling:
        browserPreferences.backgroundThrottling,

      autoplayPolicy:
        browserPreferences.autoplayPolicy === "allow"
          ? "no-user-gesture-required"
          : "user-gesture-required",

      defaultFontSize:
        browserPreferences.defaultFontSize,

      minimumFontSize:
        browserPreferences.minimumFontSize,

      spellcheck:
        browserPreferences.spellcheckEnabled,

      enableBlinkFeatures:
        "MiddleClickAutoscroll",
    },
  });

  applyCompatibleUserAgent(
    view.webContents,
    requestedUrl
  );

  try {
    view.webContents.setZoomFactor(
      browserPreferences.defaultPageZoom / 100
    );
  } catch {}

  try {
    view.webContents.setBackgroundThrottling(
      browserPreferences.backgroundThrottling
    );
  } catch {}

  try {
    view.webContents.setWebRTCIPHandlingPolicy(
      browserPreferences.webrtcPolicy
    );
  } catch {}

  try {
    view.webContents.setImageAnimationPolicy(
      browserPreferences.imageAnimationPolicy
    );
  } catch {}

  if (effectivePrivateMode) {
    ensurePrivateSessionConfigured();
  }

  const tab = {
    id,
    view,
    title: "Carregando…",
    url: requestedUrl,
    favicon: "",
    loading: true,
    private: effectivePrivateMode,
    userMuted: false,
    sleeping: false,
    focusAfterNavigation: false,

    deferMediaUntilActivated:
      Boolean(
        browserPreferences.deferBackgroundMediaUntilActivated &&
        !shouldActivate &&
        gameSettingForUrl(requestedUrl).setting.mode !== "on"
      ),

    lastActiveAt: Date.now(),
  };

  context.tabs.set(id, tab);

  context.window.contentView.addChildView(
    view
  );

  const bounds =
    context.isMain
      ? tabArea
      : context.tabArea;

  view.setBounds(bounds);

  applyChatBubble(context);

  view.setVisible(false);

  syncTabAudioMute(tab);
  wireTab(context, tab);

  view.webContents
    .loadURL(tab.url)
    .catch(() => {});

  if (shouldActivate) {
    activateTab(context, id);
  } else {
    emitContextState(context);
  }

  return id;
}

function activateTab(context, id) {
  // Compatibilidade:
  // activateTab(id)
  if (!isBrowserContext(context)) {
    id = context;
    context = mainBrowserContext;
  }

  if (!context) return;

  const contextTabs =
    context.tabs;

  if (!contextTabs.has(id)) return;

  setContextActiveTabId(
    context,
    id
  );

  setVisibleTab(context, id);

  const tab =
    contextTabs.get(id);

  tab.lastActiveAt =
    Date.now();

  if (tab.sleeping) {
    wakeSleepingTab(tab);
  }

  if (tab.deferMediaUntilActivated) {
    releaseBackgroundMediaGuard(
      tab,
      { resume: true }
    );
  }

  const contextShellOnly =
    context.isMain
      ? shellOnly
      : Boolean(context.shellOnly);

  if (
    !contextShellOnly &&
    tab.view
  ) {
    tab.view.webContents.focus();
  }

  applyChatBubble(context);

  emitContextState(context);
}

async function closeTab(context, id) {
  // Compatibilidade:
  // closeTab(id)
  if (!isBrowserContext(context)) {
    id = context;
    context = mainBrowserContext;
  }

  if (!context) return;

  const contextTabs =
    context.tabs;

  const closedTabs =
    context.closedTabs;

  const tab =
    contextTabs.get(id);

  if (!tab) return;

  if (
    context.htmlFullscreenTabId === id
  ) {
    leaveHtmlFullscreen(context, id);
  }

  const ordered =
    [...contextTabs.keys()];

  const index =
    ordered.indexOf(id);

  // Proteção de privacidade mantida:
  // abas privadas nunca entram em Ctrl+Shift+T.
  if (!tab.private) {
    closedTabs.push({
      url: safeClosedTabUrl(tab.url),
      title: tab.title,
      internalPage:
        tab.internalPage || null,
    });

    if (
      closedTabs.length > 30
    ) {
      closedTabs.shift();
    }
  }

  if (
    context.currentWatchSession?.tabId === id
  ) {
    await stopWatchPublisher(context);
  }

  if (tab.view) {
    try {
      context.window
        .contentView
        .removeChildView(tab.view);
    } catch {}

    try {
      tab.view.webContents.close();
    } catch {}
  }

  contextTabs.delete(id);

  if (tab.private) {
    void clearPrivateSessionIfUnused();
  }

  if (
    contextActiveTabId(context) === id
  ) {
    const nextId =
      ordered[index + 1] ||
      ordered[index - 1] ||
      [...contextTabs.keys()][0] ||
      null;

    setContextActiveTabId(
      context,
      null
    );

    if (nextId) {
      activateTab(
        context,
        nextId
      );
    } else {
      createTab(
        context,
        currentNewTabUrl(),
        { activate: true }
      );
    }
  } else {
    emitContextState(context);
  }
}

function reopenClosedTab(context) {
  // Compatibilidade:
  // reopenClosedTab()
  if (!isBrowserContext(context)) {
    context = mainBrowserContext;
  }

  if (!context) return;

  const last =
    context.closedTabs.pop();

  if (!last) return;

  if (last.internalPage) {
    createInternalTab(
      context,
      last.internalPage,
      { activate: true }
    );
  } else {
    createTab(
      context,
      last.url || currentNewTabUrl(),
      { activate: true }
    );
  }
}

function activeTab(context) {
  // Compatibilidade:
  // activeTab()
  if (!isBrowserContext(context)) {
    context = mainBrowserContext;
  }

  if (!context) return null;

  const id =
    contextActiveTabId(context);

  return id
    ? context.tabs.get(id) || null
    : null;
}
function tabAction(context, action) {
  const tab = activeTab(context);
  if (!tab || !tab.view) return;

  const wc = tab.view.webContents;
  const nav = wc.navigationHistory;

  if (action === "back" && nav.canGoBack()) nav.goBack();
  else if (action === "forward" && nav.canGoForward()) nav.goForward();
  else if (action === "reload") wc.reload();
  else if (action === "reload-hard") wc.reloadIgnoringCache();
  else if (action === "stop") wc.stop();
}
function scheduleSaveSession() {
  if (shuttingDown) return;
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    sessionSaveTimer = null;
    saveSession();
  }, 650);
}

function saveSession() {
  try {
    const persistentTabs = [...tabs.values()]
      .filter((tab) => !tab.private && !googleVerificationInfo(tab.url) && (Boolean(tab.internalPage) || /^https?:/i.test(tab.url)));
    const activePersistentIndex = persistentTabs.findIndex((tab) => tab.id === activeTabId);
    const data = {
      version: VERSION,
      savedAt: Date.now(),
      tabs: persistentTabs.slice(0, 30).map((tab) => ({ url: tab.url, internalPage: tab.internalPage || null })),
      activeIndex: activePersistentIndex >= 0 ? Math.min(activePersistentIndex, 29) : 0,
    };
    fs.writeFileSync(userDataFile(), JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.warn("[Session] Falha ao salvar abas:", error);
  }
}

function restoreSession() {
  const mode = browserPreferences.startupMode;
  if (mode === "home") {
    createTab(currentHomeUrl(), { activate: true });
    return;
  }
  if (mode === "newtab") {
    createTab(currentNewTabUrl(), { activate: true });
    return;
  }
  if (mode === "custom" && browserPreferences.startupPages.length) {
    browserPreferences.startupPages.slice(0, 12).forEach((url, index) => createTab(url, { activate: index === 0 }));
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(userDataFile(), "utf8"));
    if (Array.isArray(data.tabs) && data.tabs.length) {
      data.tabs.slice(0, 30).forEach((item, index) => {
        const activate = index === Number(data.activeIndex || 0);
        if (item?.internalPage && internalPageMeta(item.internalPage)) createInternalTab(item.internalPage, { activate });
        else createTab(item?.url || currentNewTabUrl(), { activate });
      });
      if (!activeTabId) activateTab([...tabs.keys()][0]);
      return;
    }
  } catch {}
  createTab(currentNewTabUrl(), { activate: true });
}

function reorderTabs(context, ids) {
  if (!context) return { tabs: [], activeTabId: null };
  const contextTabs = context.tabs;
  if (!Array.isArray(ids)) return allTabsState(context);
  const seen = new Set();
  const ordered = [];
  for (const rawId of ids) {
    const id = String(rawId || "");
    if (!id || seen.has(id) || !contextTabs.has(id)) continue;
    seen.add(id);
    ordered.push([id, contextTabs.get(id)]);
  }
  for (const [id, tab] of contextTabs.entries()) {
    if (!seen.has(id)) ordered.push([id, tab]);
  }
  contextTabs.clear();
  for (const [id, tab] of ordered) contextTabs.set(id, tab);
  emitContextState(context);
  return allTabsState(context);
}

async function extractActivePageText(context = mainBrowserContext) {
  const tab = activeTab(context);
  if (!tab) return { title: "", url: "", text: "" };
  if (!tab.view) return { title: tab.title || "MarshMallow", url: tab.url || "", text: "Página interna do MarshMallow." };
  const wc = tab.view.webContents;
  let text = "";
  try {
    text = await wc.executeJavaScript(`(() => {
      const root = document.querySelector('main, article, [role="main"]') || document.body;
      return String(root?.innerText || document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 30000);
    })()`, true);
  } catch {}
  return { title: tab.title || wc.getTitle() || "", url: tab.url || wc.getURL() || "", text: String(text || "") };
}

// ------------------------------------------------------------------
// Watch Together: Fluxer-style Electron frame capture
// ------------------------------------------------------------------

async function probeMediaFrame(frame) {
  if (!frame || frame.detached) return null;
  try {
    const info = await frame.executeJavaScript(`(() => {
      const videos = [...document.querySelectorAll('video')];
      const audios = [...document.querySelectorAll('audio')];
      let best = null;
      for (const video of videos) {
        const r = video.getBoundingClientRect();
        const area = Math.max(0, r.width) * Math.max(0, r.height);
        const playing = !video.paused && !video.ended && video.readyState >= 2;
        const visible = r.width >= 120 && r.height >= 80;
        const score = area + (playing ? 1e9 : 0) + (visible ? 1e8 : 0) + (video.readyState >= 3 ? 1e7 : 0);
        if (!best || score > best.score) {
          best = {
            score,
            area,
            playing,
            paused: video.paused,
            readyState: video.readyState,
            width: r.width,
            height: r.height,
            videoWidth: video.videoWidth || 0,
            videoHeight: video.videoHeight || 0,
            currentTime: video.currentTime || 0,
          };
        }
      }
      return {
        hasVideo: !!best,
        video: best,
        audioElements: audios.length,
        title: document.title,
        url: location.href,
      };
    })()`, false);
    return { frame, info };
  } catch {
    return null;
  }
}

async function findBestMediaFrame(tab) {
  const frames = tab.view.webContents.mainFrame.framesInSubtree;
  const results = await Promise.all(frames.map(probeMediaFrame));
  const candidates = results.filter(Boolean).filter((item) => item.info?.hasVideo);

  candidates.sort((a, b) => {
    const av = a.info.video || {};
    const bv = b.info.video || {};
    const ascore = Number(av.score || 0);
    const bscore = Number(bv.score || 0);
    return bscore - ascore;
  });

  return candidates[0] || { frame: tab.view.webContents.mainFrame, info: { hasVideo: false, url: tab.url } };
}

function reportWatchStatus(context, status) {
  return sendToContextShell(context, "watch:status", status);
}

async function createWatchPublisher(context, config) {
  if (!isBrowserContext(context)) {
    throw new Error("Contexto do navegador indisponível.");
  }

  const tab = activeTab(context);
  if (!tab) throw new Error("Nenhuma aba ativa.");
  if (!tab.view) throw new Error("Abra uma página web antes de iniciar o Watch Together.");

  await stopWatchPublisher(context);

  reportWatchStatus(context, {
    phase: "detecting",
    message: "Detectando o frame que contém o vídeo…",
  });

  const selected = await findBestMediaFrame(tab);
  if (!selected?.frame || selected.frame.detached) {
    throw new Error("Não encontrei um frame capturável.");
  }

  context.activeCaptureFrame = selected.frame;

  reportWatchStatus(context, {
    phase: "frame-selected",
    message: selected.info?.hasVideo
      ? "Player encontrado · captura do frame sem bloquear a rolagem da página."
      : "Nenhum <video> detectado; capturando o frame ativo.",
    frameUrl: selected.info?.url || selected.frame.url,
    media: selected.info?.video || null,
  });

  const tokenResponse = await fetch(`${config.apiUrl.replace(/\/$/, "")}/api/livekit/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      room: config.room,
      role: "host",
      hostToken: config.hostToken,
      name: config.name || "Host",
    }),
  });

  const access = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !access?.token || !access?.url) {
    throw new Error(access?.error || `Falha ao obter token LiveKit (${tokenResponse.status}).`);
  }

  context.watchPublisherWindow = new BrowserWindow({
    width: 480,
    height: 240,
    show: false,
    frame: false,
    backgroundColor: "#000000",
    webPreferences: {
      // Cada BrowserContext recebe sua própria sessão efêmera de publisher.
      // Assim, dois Watch Together simultâneos não disputam o mesmo
      // setDisplayMediaRequestHandler e a janela privada não toca o perfil normal.
      partition: `mm-watch-publisher-${context.window.id}`,
      preload: path.join(__dirname, "watch-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const publisherWindow = context.watchPublisherWindow;
  const publisherContentsId = publisherWindow.webContents.id;
  const publisherSession = publisherWindow.webContents.session;
  context.watchPublisherSession = publisherSession;

  // A sessão do publisher é independente das sessões de navegação e precisa
  // receber as mesmas regras de permissão para display/media.
  configureSessionPermissions(publisherSession);

  context.currentWatchSession = {
    tabId: tab.id,
    room: config.room,
    apiUrl: config.apiUrl,
  };

  publisherSession.setDisplayMediaRequestHandler((request, callback) => {
    reportWatchStatus(context, {
      phase: "display-request",
      message: `Electron recebeu getDisplayMedia · vídeo=${request.videoRequested} áudio=${request.audioRequested} gesto=${request.userGesture}`,
      securityOrigin: request.securityOrigin,
      userGesture: request.userGesture,
    });

    console.log(
      `[DisplayMedia] request origin=${request.securityOrigin} video=${request.videoRequested}` +
      ` audio=${request.audioRequested} userGesture=${request.userGesture}`
    );

    const requester = request.frame
      ? electronWebContents.fromFrame(request.frame)
      : null;

    if (
      context.watchPublisherWindow !== publisherWindow ||
      requester?.id !== publisherContentsId
    ) {
      reportWatchStatus(context, {
        phase: "display-denied",
        message: `Solicitação recusada: requester=${requester?.id ?? "null"} publisher=${publisherContentsId}.`,
      });
      callback({});
      return;
    }

    const frame = context.activeCaptureFrame;
    if (!frame || frame.detached) {
      reportWatchStatus(context, {
        phase: "display-denied",
        message: "Solicitação recusada: o WebFrameMain selecionado foi destruído/desanexado.",
      });
      callback({});
      return;
    }

    reportWatchStatus(context, {
      phase: "display-granted",
      message: `Concedendo WebFrameMain diretamente · ${String(frame.url || "URL desconhecida")}`,
      frameUrl: frame.url,
      audioRequested: request.audioRequested,
    });

    callback({
      video: frame,
      audio: request.audioRequested ? frame : undefined,
      enableLocalEcho: true,
    });
  });

  publisherWindow.on("closed", () => {
    if (context.watchPublisherWindow !== publisherWindow) return;

    clearWatchDisplayMediaHandler(context);
    context.watchPublisherWindow = null;
    context.watchPublisherSession = null;
    context.watchPublisherReadyResolver = null;
    context.activeCaptureFrame = null;
    context.currentWatchSession = null;
  });

  const url = app.isPackaged
    ? `file://${path.join(DIST, "watch-host.html").replace(/\\/g, "/")}`
    : `${DEV_URL}/watch-host.html`;

  const readyPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      context.watchPublisherReadyResolver = null;
      reject(new Error("Publisher Electron não sinalizou ready em 10 segundos."));
    }, 10_000);

    context.watchPublisherReadyResolver = () => {
      clearTimeout(timer);
      context.watchPublisherReadyResolver = null;
      resolve();
    };
  });

  await publisherWindow.loadURL(url);
  await readyPromise;

  reportWatchStatus(context, {
    phase: "publisher-config",
    message: "Publisher pronto · enviando token LiveKit e iniciando captura.",
  });

  publisherWindow.webContents.send("watch-host:start", {
    livekitUrl: access.url,
    token: access.token,
    room: access.room,
  });

  return {
    ok: true,
    frameUrl: selected.info?.url || selected.frame.url,
    hasVideo: !!selected.info?.hasVideo,
    cleanApplied: false,
  };
}

function clearWatchDisplayMediaHandler(context) {
  try {
    context?.watchPublisherSession?.setDisplayMediaRequestHandler(null);
  } catch {}
}

async function stopWatchPublisher(context) {
  if (!isBrowserContext(context)) return false;

  context.watchPublisherReadyResolver = null;

  const publisherWindow = context.watchPublisherWindow;
  if (publisherWindow && !publisherWindow.isDestroyed()) {
    try { publisherWindow.webContents.send("watch-host:stop"); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
    try { publisherWindow.destroy(); } catch {}
  }

  clearWatchDisplayMediaHandler(context);

  const publisherSession = context.watchPublisherSession;
  context.watchPublisherWindow = null;
  context.watchPublisherSession = null;
  context.activeCaptureFrame = null;
  context.currentWatchSession = null;

  // O publisher usa partition sem "persist:"; esta limpeza evita que uma nova
  // transmissão do mesmo contexto herde storage/cache enquanto o app segue aberto.
  if (publisherSession) {
    try { await publisherSession.clearStorageData(); } catch {}
    try { await publisherSession.clearCache(); } catch {}
  }

  reportWatchStatus(context, {
    phase: "stopped",
    message: "Transmissão encerrada.",
  });

  return true;
}

function contextForWatchPublisherContents(contents) {
  if (!contents) return null;

  for (const context of browserContexts.values()) {
    const publisher = context.watchPublisherWindow;
    if (
      publisher &&
      !publisher.isDestroyed() &&
      publisher.webContents === contents
    ) {
      return context;
    }
  }

  return null;
}

function isWatchPublisherContents(webContents) {
  return Boolean(
    contextForWatchPublisherContents(webContents)
  );
}

function permissionPreference(permission, details = {}) {
  const mediaTypes = Array.isArray(details?.mediaTypes) ? details.mediaTypes : [];
  const mediaType = String(details?.mediaType || mediaTypes[0] || "");
  if (permission === "media") {
    if (mediaType === "video" || mediaTypes.includes("video")) return browserPreferences.permissionDefaults.camera;
    if (mediaType === "audio" || mediaTypes.includes("audio")) return browserPreferences.permissionDefaults.microphone;
    return browserPreferences.permissionDefaults.microphone;
  }
  if (permission === "geolocation") return browserPreferences.permissionDefaults.location;
  if (permission === "notifications") return browserPreferences.permissionDefaults.notifications;
  if (permission === "clipboard-sanitized-write") return "allow";
  if (permission === "clipboard-read") return browserPreferences.permissionDefaults.clipboard;
  if (permission === "midi" || permission === "midiSysex") return browserPreferences.permissionDefaults.midi;
  if (permission === "fullscreen") return browserPreferences.permissionDefaults.fullscreen;
  if (permission === "mediaKeySystem") return "allow";
  if (permission === "pointerLock" || permission === "keyboardLock") {
    const tab = tabByWebContentsId(details?.webContentsId || 0);
    const resolved = tab ? currentGameModeForTab(tab) : { active:false };
    return resolved.active ? "allow" : "ask";
  }
  if (permission === "storage-access" || permission === "top-level-storage-access") {
    return browserPreferences.thirdPartyCookieAccess === "block" ? "block" : "allow";
  }
  return "block";
}

function permissionLabel(permission, details = {}) {
  if (permission === "media") {
    const types = Array.isArray(details?.mediaTypes) ? details.mediaTypes : [];
    if (types.includes("video")) return "câmera";
    if (types.includes("audio")) return "microfone";
    return "câmera/microfone";
  }
  return ({ geolocation: "localização", notifications: "notificações", "clipboard-read": "área de transferência", "clipboard-sanitized-write": "área de transferência", midi: "MIDI", midiSysex: "MIDI", fullscreen: "tela cheia", mediaKeySystem: "conteúdo protegido (DRM)", pointerLock: "captura do ponteiro", keyboardLock: "captura do teclado", "storage-access": "cookies entre sites", "top-level-storage-access": "cookies relacionados entre sites" })[permission] || permission;
}

function configureSessionPermissions(targetSession) {
  targetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const publisher = isWatchPublisherContents(webContents);
    if (publisher && (permission === "display-capture" || permission === "media")) return true;
    if (permission === "clipboard-sanitized-write") return true;
    if (permission === "mediaKeySystem") {
      const tab = tabByWebContentsId(webContents?.id);
      if (tab) markTabDrmProtected(tab);
      return /^https:\/\//i.test(String(requestingOrigin || details?.requestingUrl || webContents?.getURL?.() || ""));
    }
    if (permission === "pointerLock" || permission === "keyboardLock") {
      const tab = tabByWebContentsId(webContents?.id);
      return Boolean(tab && currentGameModeForTab(tab).active);
    }
    const pref = permissionPreference(permission, details);
    return pref === "allow";
  });

  targetSession.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    const publisher = isWatchPublisherContents(webContents);
    if (publisher && (permission === "display-capture" || permission === "media")) { callback(true); return; }
    if (permission === "mediaKeySystem") {
      const tab = tabByWebContentsId(webContents?.id);
      if (tab) markTabDrmProtected(tab);
      const origin = String(details?.requestingUrl || details?.securityOrigin || webContents?.getURL?.() || "");
      callback(/^https:\/\//i.test(origin));
      return;
    }

    let pref = permissionPreference(permission, details);
    if (permission === "pointerLock" || permission === "keyboardLock") {
      const tab = tabByWebContentsId(webContents?.id);
      pref = tab && currentGameModeForTab(tab).active ? "allow" : "ask";
    }
    if (pref === "allow") { callback(true); return; }
    if (pref === "block") { callback(false); return; }

    const origin = String(details?.requestingUrl || details?.securityOrigin || webContents?.getURL?.() || "este site");
    const host = safeHttpUrl(origin)?.hostname || origin.slice(0, 120) || "este site";
    try {
      const options = {
        type: "question",
        title: "Permissão do site — MarshMallow",
        message: `${host} quer acessar ${permissionLabel(permission, details)}.`,
        detail: "Você pode alterar o comportamento padrão em Configurações → Permissões de sites.",
        buttons: ["Bloquear", "Permitir"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      };
      const context = contextForWebContents(webContents);
      const ownerWindow = context?.window;
      const result = ownerWindow && !ownerWindow.isDestroyed()
        ? await dialog.showMessageBox(ownerWindow, options)
        : mainWindow && !mainWindow.isDestroyed()
          ? await dialog.showMessageBox(mainWindow, options)
          : await dialog.showMessageBox(options);
      callback(result.response === 1);
    } catch {
      callback(false);
    }
  });
}

function uniqueDownloadPath(base, filename) {
  const safe = safeFilename(filename || "download");
  let candidate = path.join(base, safe);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(safe); const stem = safe.slice(0, safe.length - ext.length) || "download";
  for (let i = 2; i < 10000; i += 1) { candidate = path.join(base, `${stem} (${i})${ext}`); if (!fs.existsSync(candidate)) return candidate; }
  return path.join(base, `${stem}-${Date.now()}${ext}`);
}

const downloadHistoryFile = () => path.join(app.getPath("userData"), "download-history.json");
const DOWNLOADER_MANAGER_METADATA_URL = "https://marshmallow-browser-br.pages.dev/download/manager.json";

function nextDownloadId() {
  downloadCounter += 1;
  return `download-${Date.now().toString(36)}-${downloadCounter.toString(36)}`;
}

function loadDownloadHistory() {
  if (downloadHistoryLoaded) return;
  downloadHistoryLoaded = true;
  try {
    const parsed = JSON.parse(fs.readFileSync(downloadHistoryFile(), "utf8"));
    for (const item of trimDownloadHistory(Array.isArray(parsed) ? parsed : [], 200)) {
      if (!item.private && item.id) downloadRecords.set(item.id, item);
    }
  } catch {}
}

function saveDownloadHistory() {
  try {
    const items = trimDownloadHistory([...downloadRecords.values()].filter((item) => !item.private && !["progressing", "paused"].includes(item.state)), 200);
    fs.mkdirSync(path.dirname(downloadHistoryFile()), { recursive: true });
    fs.writeFileSync(downloadHistoryFile(), JSON.stringify(items, null, 2), "utf8");
  } catch (error) {
    console.warn("[Downloads] Falha ao salvar histórico:", error);
  }
}

function downloadSnapshot() {
  loadDownloadHistory();
  const items = [...downloadRecords.values()].map((item) => normalizeDownloadRecord(item)).sort((a, b) => b.updatedAt - a.updatedAt);
  const active = items.filter((item) => item.state === "progressing" || item.state === "paused").length;
  return { items, active, managerMode: browserPreferences.downloadManagerMode || "builtin" };
}

function emitDownloadsChanged() {
  sendToShell("browser:downloads-changed", downloadSnapshot());
}

function updateDownloadRecord(id, patch = {}) {
  const current = downloadRecords.get(id) || { id, state:"interrupted", startedAt:Date.now(), updatedAt:Date.now() };
  const next = normalizeDownloadRecord({ ...current, ...patch, id, updatedAt: Date.now() });
  downloadRecords.set(id, next);
  emitDownloadsChanged();
  return next;
}

function recordDownloadFromItem(id, item, patch = {}) {
  let canResume = false;
  try { canResume = Boolean(item.canResume?.()); } catch {}
  return updateDownloadRecord(id, {
    receivedBytes: Number(item.getReceivedBytes?.() || 0),
    totalBytes: Number(item.getTotalBytes?.() || 0),
    savePath: String(item.getSavePath?.() || patch.savePath || ""),
    canResume,
    ...patch,
  });
}

async function checkDownloaderManagerAvailability({ force = false } = {}) {
  if (process.platform !== "win32") {
    downloaderManagerManifestCache = { ok:true, available:false, version:"0.0.0", url:"", protocol:"marshmallow-downloader", checkedAt:Date.now(), metadataUrl:DOWNLOADER_MANAGER_METADATA_URL, error:"O MarshMallow Downloader Manager independente ainda é exclusivo do Windows. No Linux, use o gerenciador integrado." };
    return downloaderManagerManifestCache;
  }
  if (!force && downloaderManagerManifestCache?.checkedAt && Date.now() - downloaderManagerManifestCache.checkedAt < 10 * 60 * 1000) return downloaderManagerManifestCache;
  try {
    const response = await net.fetch(`${DOWNLOADER_MANAGER_METADATA_URL}?t=${Date.now()}`, { headers:{ "cache-control":"no-cache", accept:"application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const validated = validateDownloaderManagerManifest(json);
    downloaderManagerManifestCache = { ...validated, checkedAt:Date.now(), metadataUrl:DOWNLOADER_MANAGER_METADATA_URL };
  } catch (error) {
    downloaderManagerManifestCache = { ok:false, available:false, version:"0.0.0", url:"", protocol:"marshmallow-downloader", checkedAt:Date.now(), metadataUrl:DOWNLOADER_MANAGER_METADATA_URL, error:String(error?.message || error || "Falha ao consultar") };
  }
  return downloaderManagerManifestCache;
}

async function openDownloaderManagerInstaller() {
  if (process.platform !== "win32") return { ok:false, available:false, error:"O instalador .exe do MarshMallow Downloader Manager é exclusivo do Windows; o Linux usa o gerenciador integrado." };
  const state = await checkDownloaderManagerAvailability({ force:true });
  if (!state.ok || !state.available || !state.url) return { ok:false, available:false, error:state.error || "O MarshMallow Downloader Manager ainda não está disponível." };
  try { await shell.openExternal(state.url); return { ok:true, available:true, url:state.url, version:state.version }; }
  catch (error) { return { ok:false, available:true, error:String(error?.message || error || "Não foi possível abrir o instalador.") }; }
}

function configureDownloads(targetSession, { privateMode = false } = {}) {
  loadDownloadHistory();
  targetSession.on("will-download", (event, item) => {
    const chain = item.getURLChain?.() || [];
    const original = String(chain[0] || item.getURL?.() || "");
    const forced = pendingDownloadNames.get(original); if (forced) pendingDownloadNames.delete(original);
    const filename = safeFilename(forced || item.getFilename() || "download");

    const bypassExternal = externalManagerBypassOnce.delete(original);
    if (process.platform === "win32" && !privateMode && !bypassExternal && browserPreferences.downloadManagerMode === "external") {
      const handoff = buildExternalManagerProtocolUrl({ url:original, filename });
      if (handoff) {
        event.preventDefault();
        void shell.openExternal(handoff).catch((error) => {
          console.warn("[Downloads] Downloader Manager indisponível; usando gerenciador integrado:", error);
          externalManagerBypassOnce.add(original);
          pendingDownloadNames.set(original, filename);
          try { targetSession.downloadURL(original); } catch (retryError) { console.warn("[Downloads] Falha no fallback integrado:", retryError); }
        });
        return;
      }
    }

    const id = nextDownloadId();
    const base = browserPreferences.downloadPath || app.getPath("downloads");
    let savePath = "";
    if (browserPreferences.downloadsAskWhere) {
      try { item.setSaveDialogOptions({ title: "Salvar download — MarshMallow", defaultPath: uniqueDownloadPath(base, filename) }); } catch {}
    } else {
      try { fs.mkdirSync(base, { recursive: true }); } catch {}
      savePath = uniqueDownloadPath(base, filename);
      try { item.setSavePath(savePath); } catch {}
    }

    activeDownloadItems.set(id, item);
    downloadRecords.set(id, normalizeDownloadRecord({ id, url:original, filename, savePath, state:"progressing", receivedBytes:0, totalBytes:Number(item.getTotalBytes?.() || 0), startedAt:Date.now(), updatedAt:Date.now(), private:privateMode }));
    emitDownloadsChanged();

    item.on("updated", (_updatedEvent, state) => {
      const paused = Boolean(item.isPaused?.());
      const normalizedState = paused ? "paused" : state === "interrupted" ? "interrupted" : "progressing";
      recordDownloadFromItem(id, item, { state:normalizedState, filename, url:original, private:privateMode });
    });

    item.once("done", (_doneEvent, state) => {
      const normalizedState = state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted";
      recordDownloadFromItem(id, item, { state:normalizedState, filename, url:original, private:privateMode });
      activeDownloadItems.delete(id);
      if (!privateMode) saveDownloadHistory();
      emitDownloadsChanged();
    });
  });
}

function pauseDownload(id) {
  const item = activeDownloadItems.get(String(id || ""));
  if (!item) return { ok:false, error:"Download não está ativo." };
  try { item.pause(); recordDownloadFromItem(String(id), item, { state:"paused" }); return { ok:true }; }
  catch (error) { return { ok:false, error:String(error?.message || error) }; }
}

function resumeDownload(id) {
  const item = activeDownloadItems.get(String(id || ""));
  if (!item) return { ok:false, error:"Download não está ativo." };
  try {
    if (typeof item.canResume === "function" && !item.canResume()) return { ok:false, error:"Este download não pode ser retomado." };
    item.resume(); recordDownloadFromItem(String(id), item, { state:"progressing", canResume:false }); return { ok:true };
  } catch (error) { return { ok:false, error:String(error?.message || error) }; }
}

function cancelDownload(id) {
  const item = activeDownloadItems.get(String(id || ""));
  if (!item) return { ok:false, error:"Download não está ativo." };
  try { item.cancel(); return { ok:true }; }
  catch (error) { return { ok:false, error:String(error?.message || error) }; }
}

async function openDownloadedFile(id) {
  const record = downloadRecords.get(String(id || ""));
  if (!record?.savePath || record.state !== "completed") return { ok:false, error:"Arquivo concluído não encontrado." };
  if (!fs.existsSync(record.savePath)) return { ok:false, error:"O arquivo não existe mais neste caminho." };
  const error = await shell.openPath(record.savePath);
  return error ? { ok:false, error } : { ok:true };
}

function showDownloadedFile(id) {
  const record = downloadRecords.get(String(id || ""));
  if (!record?.savePath || !fs.existsSync(record.savePath)) return { ok:false, error:"Arquivo não encontrado." };
  try { shell.showItemInFolder(record.savePath); return { ok:true }; }
  catch (error) { return { ok:false, error:String(error?.message || error) }; }
}

function clearDownloadHistory() {
  for (const [id, record] of downloadRecords.entries()) {
    if (!["progressing", "paused"].includes(record.state)) downloadRecords.delete(id);
  }
  saveDownloadHistory();
  emitDownloadsChanged();
  return downloadSnapshot();
}

function configurePrivacyHeaders(targetSession) {
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...(details.requestHeaders || {}) };
    if (browserPreferences.doNotTrack) headers.DNT = "1";
    else delete headers.DNT;
    if (browserPreferences.globalPrivacyControl) headers["Sec-GPC"] = "1";
    else delete headers["Sec-GPC"];
    callback({ requestHeaders: headers });
  });
}

async function applySessionPreferences(targetSession, { proxy = true } = {}) {
  // Preserve the Chromium runtime UA at session level. Per-page cleanup is done
  // by WebContents only for non-Google sites. This avoids a global mismatch on
  // Google between an overridden UA and Chromium's own Client Hints.
  try { targetSession.setUserAgent(targetSession.getUserAgent(), browserPreferences.acceptLanguages); } catch {}
  try { targetSession.setSpellCheckerEnabled(browserPreferences.spellcheckEnabled); } catch {}
  if (browserPreferences.spellcheckEnabled) {
    try {
      const available = new Set(targetSession.availableSpellCheckerLanguages || []);
      const requested = browserPreferences.spellcheckLanguages.filter((code) => available.has(code));
      if (requested.length) targetSession.setSpellCheckerLanguages(requested);
    } catch {}
  }
  if (proxy) {
    try {
      if (browserPreferences.proxyMode === "direct") await targetSession.setProxy({ mode: "direct" });
      else if (browserPreferences.proxyMode === "custom" && browserPreferences.proxyRules) await targetSession.setProxy({ mode: "fixed_servers", proxyRules: browserPreferences.proxyRules });
      else await targetSession.setProxy({ mode: "system" });
      await targetSession.closeAllConnections();
    } catch (error) {
      console.warn("[Preferences] Falha ao aplicar proxy:", error);
    }
  }
}

function configurePermissions() {
  const tabSession = session.fromPartition(TAB_PARTITION);
  configureSessionPermissions(tabSession);
  configureDownloads(tabSession, { privateMode: false });
  configurePrivacyHeaders(tabSession);
  configureMediaDetection(tabSession);
  void applySessionPreferences(tabSession);
}

async function applyBrowserPreferences(next) {
  const previous = browserPreferences;
  browserPreferences = sanitizePreferences({ ...browserPreferences, ...(next || {}), permissionDefaults: { ...browserPreferences.permissionDefaults, ...(next?.permissionDefaults || {}) } });
  saveBrowserPreferences();
  if (previous.downloadManagerMode !== browserPreferences.downloadManagerMode) emitDownloadsChanged();

  const tabSession = session.fromPartition(TAB_PARTITION);
  const proxyChanged = previous.proxyMode !== browserPreferences.proxyMode || previous.proxyRules !== browserPreferences.proxyRules;
  await applySessionPreferences(tabSession, { proxy: proxyChanged });
  if (mainWindow && !mainWindow.isDestroyed()) await applySessionPreferences(mainWindow.webContents.session, { proxy: false });
  for (const tab of tabs.values()) {
    if (!tab.view) continue;
    const wc = tab.view.webContents;
    try { wc.setZoomFactor(browserPreferences.defaultPageZoom / 100); } catch {}
    try { wc.setBackgroundThrottling(browserPreferences.backgroundThrottling); } catch {}
    if (!browserPreferences.deferBackgroundMediaUntilActivated && tab.deferMediaUntilActivated) releaseBackgroundMediaGuard(tab, { resume: true });
    else syncTabAudioMute(tab);
    try { wc.setWebRTCIPHandlingPolicy(browserPreferences.webrtcPolicy); } catch {}
    try { wc.setImageAnimationPolicy(browserPreferences.imageAnimationPolicy); } catch {}
  }
  applyGameScheduler(mainBrowserContext);

  return {
    preferences: browserPreferences,
    restartRequired: previous.hardwareAcceleration !== browserPreferences.hardwareAcceleration ||
      previous.defaultFontSize !== browserPreferences.defaultFontSize ||
      previous.minimumFontSize !== browserPreferences.minimumFontSize ||
      previous.autoplayPolicy !== browserPreferences.autoplayPolicy,
  };
}

async function clearBrowsingDataNow() {
  const tabSession = session.fromPartition(TAB_PARTITION);
  await Promise.allSettled([tabSession.clearCache(), tabSession.clearStorageData()]);
  return { ok: true };
}

function normalTabSession() {
  return session.fromPartition(TAB_PARTITION);
}

function cookiePublicView(cookie) {
  return {
    name: String(cookie?.name || ""),
    domain: String(cookie?.domain || ""),
    path: String(cookie?.path || "/"),
    secure: Boolean(cookie?.secure),
    httpOnly: Boolean(cookie?.httpOnly),
    session: Boolean(cookie?.session),
    expirationDate: Number.isFinite(Number(cookie?.expirationDate)) ? Number(cookie.expirationDate) : undefined,
    sameSite: String(cookie?.sameSite || "unspecified"),
    hostOnly: Boolean(cookie?.hostOnly),
  };
}

function cookieUrlFor(cookie) {
  const host = String(cookie?.domain || "").replace(/^\./, "").trim();
  if (!host) return "";
  const secure = Boolean(cookie?.secure) || String(cookie?.sameSite || "") === "no_restriction";
  const cookiePath = String(cookie?.path || "/").startsWith("/") ? String(cookie?.path || "/") : "/";
  return `${secure ? "https" : "http"}://${host}${cookiePath}`;
}

async function listBrowserCookies(query = "") {
  const ses = normalTabSession();
  const all = await ses.cookies.get({});
  const q = String(query || "").trim().toLowerCase();
  const filtered = q
    ? all.filter((cookie) => `${cookie.domain} ${cookie.name} ${cookie.path}`.toLowerCase().includes(q))
    : all;
  filtered.sort((a, b) => String(a.domain || "").localeCompare(String(b.domain || "")) || String(a.name || "").localeCompare(String(b.name || "")));
  return {
    count: all.length,
    storagePath: ses.storagePath || "",
    cookies: filtered.slice(0, 2000).map(cookiePublicView),
  };
}

async function saveCookiesNow() {
  const ses = normalTabSession();
  await ses.cookies.flushStore();
  await ses.flushStorageData();
  const cookies = await ses.cookies.get({});
  return { ok: true, count: cookies.length, storagePath: ses.storagePath || "" };
}

async function removeBrowserCookie(input = {}) {
  const ses = normalTabSession();
  const cookie = {
    domain: String(input.domain || ""),
    path: String(input.path || "/"),
    secure: Boolean(input.secure),
    sameSite: String(input.sameSite || "unspecified"),
  };
  const url = cookieUrlFor(cookie);
  const name = String(input.name || "");
  if (!url || !name) return { ok: false, error: "Cookie inválido." };
  await ses.cookies.remove(url, name);
  await ses.cookies.flushStore();
  return { ok: true };
}

async function clearCookiesOnly() {
  const ses = normalTabSession();
  await ses.clearStorageData({ storages: ["cookies"] });
  await ses.cookies.flushStore();
  return { ok: true };
}

function deriveCookieBackupKey(passphrase, salt) {
  return crypto.pbkdf2Sync(String(passphrase), salt, 180000, 32, "sha256");
}

function serializeCookieForBackup(cookie) {
  return {
    name: String(cookie?.name || ""),
    value: String(cookie?.value || ""),
    domain: String(cookie?.domain || ""),
    hostOnly: Boolean(cookie?.hostOnly),
    path: String(cookie?.path || "/"),
    secure: Boolean(cookie?.secure),
    httpOnly: Boolean(cookie?.httpOnly),
    session: Boolean(cookie?.session),
    expirationDate: Number.isFinite(Number(cookie?.expirationDate)) ? Number(cookie.expirationDate) : undefined,
    sameSite: String(cookie?.sameSite || "unspecified"),
  };
}

function cookieSetDetailsFromBackup(cookie) {
  const name = String(cookie?.name || "");
  const domain = String(cookie?.domain || "");
  const host = domain.replace(/^\./, "").trim();
  if (!name || !host) return null;

  const sameSite = ["unspecified", "no_restriction", "lax", "strict"].includes(String(cookie?.sameSite))
    ? String(cookie.sameSite)
    : "unspecified";
  const secure = Boolean(cookie?.secure) || sameSite === "no_restriction";
  const cookiePath = String(cookie?.path || "/").startsWith("/") ? String(cookie?.path || "/") : "/";
  const details = {
    url: `${secure ? "https" : "http"}://${host}${cookiePath}`,
    name,
    value: String(cookie?.value || ""),
    path: cookiePath,
    secure,
    httpOnly: Boolean(cookie?.httpOnly),
    sameSite,
  };

  if (!cookie?.hostOnly && domain) details.domain = domain;
  const expirationDate = Number(cookie?.expirationDate);
  if (!cookie?.session && Number.isFinite(expirationDate) && expirationDate > Date.now() / 1000) {
    details.expirationDate = expirationDate;
  }
  return details;
}

async function exportCookieBackup(passphrase) {
  const secret = String(passphrase || "");
  if (secret.length < 8) return { ok: false, error: "Use uma senha de backup com pelo menos 8 caracteres." };
  if (!mainWindow) return { ok: false, error: "Janela principal indisponível." };

  const ses = normalTabSession();
  await ses.cookies.flushStore();
  const cookies = await ses.cookies.get({});
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exportar backup de cookies — MarshMallow",
    defaultPath: path.join(app.getPath("documents"), `MarshMallow-Cookies-${new Date().toISOString().slice(0, 10)}.mmcookies`),
    filters: [{ name: "Backup seguro de cookies MarshMallow", extensions: ["mmcookies"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const payload = Buffer.from(JSON.stringify({
    format: "MarshMallowCookieBackup",
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: VERSION,
    cookies: cookies.map(serializeCookieForBackup),
  }), "utf8");

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveCookieBackupKey(secret, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope = {
    format: "MarshMallowEncryptedCookieBackup",
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: 180000,
    cipher: "AES-256-GCM",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    data: encrypted.toString("base64"),
  };
  fs.writeFileSync(result.filePath, JSON.stringify(envelope, null, 2), "utf8");
  return { ok: true, path: result.filePath, count: cookies.length };
}

async function importCookieBackup(passphrase) {
  const secret = String(passphrase || "");
  if (secret.length < 8) return { ok: false, error: "Informe a senha usada no backup (mínimo de 8 caracteres)." };
  if (!mainWindow) return { ok: false, error: "Janela principal indisponível." };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Importar backup de cookies — MarshMallow",
    properties: ["openFile"],
    filters: [{ name: "Backup seguro de cookies MarshMallow", extensions: ["mmcookies"] }],
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };

  try {
    const envelope = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    if (envelope?.format !== "MarshMallowEncryptedCookieBackup" || Number(envelope?.version) !== 1) {
      return { ok: false, error: "Arquivo de backup incompatível." };
    }
    const salt = Buffer.from(String(envelope.salt || ""), "base64");
    const iv = Buffer.from(String(envelope.iv || ""), "base64");
    const tag = Buffer.from(String(envelope.tag || ""), "base64");
    const encrypted = Buffer.from(String(envelope.data || ""), "base64");
    const key = deriveCookieBackupKey(secret, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload = JSON.parse(decrypted.toString("utf8"));
    if (payload?.format !== "MarshMallowCookieBackup" || !Array.isArray(payload?.cookies)) {
      return { ok: false, error: "Conteúdo do backup inválido." };
    }

    const ses = normalTabSession();
    let imported = 0;
    let skipped = 0;
    for (const cookie of payload.cookies.slice(0, 20000)) {
      const details = cookieSetDetailsFromBackup(cookie);
      if (!details) { skipped++; continue; }
      try {
        await ses.cookies.set(details);
        imported++;
      } catch {
        skipped++;
      }
    }
    await ses.cookies.flushStore();
    await ses.flushStorageData();
    return { ok: true, imported, skipped, sourceVersion: String(payload?.appVersion || "") };
  } catch (error) {
    return { ok: false, error: "Não foi possível abrir o backup. Confira a senha e o arquivo.", detail: String(error?.message || error || "") };
  }
}

// ------------------------------------------------------------------
// App window + IPC
// ------------------------------------------------------------------

function browserUiUrl() {
  return app.isPackaged
    ? `file://${path.join(DIST, "index.html").replace(/\\/g, "/")}`
    : DEV_URL;
}

function createBrowserWindow({
  title = "MarshMallow",
} = {}) {
  return new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    title,
    backgroundColor: "#08090c",
    show: false,
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,

    // O shell continua usando a sessão normal do aplicativo.
    // O conteúdo privado vive nos WebContentsViews com PRIVATE_PARTITION.
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: browserPreferences.spellcheckEnabled,
    },
  });
}

async function createPrivateWindow(input = null) {
  const privateWindow = createBrowserWindow({
    title: "MarshMallow — Navegação privada",
  });

  const context = createBrowserContext(
    privateWindow,
    {
      privateMode: true,
      isMain: false,
    }
  );

  if (!context) {
    try {
      privateWindow.destroy();
    } catch {}

    return null;
  }

  installShellTextContextMenu(context);
  handleShellShortcuts(context);

  privateWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(String(url || ""))) {
      createTab(
        context,
        url,
        {
          activate: true,
          privateMode: true,
        }
      );
    }

    return { action: "deny" };
  });

  privateWindow.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    const value = String(url || "");

    if (app.isPackaged) {
      try {
        const local = fileURLToPath(value);
        const distRoot = path.resolve(DIST) + path.sep;

        allowed =
          path.resolve(local).startsWith(distRoot);
      } catch {
        allowed = false;
      }
    } else {
      allowed =
        value.startsWith(DEV_URL);
    }

    if (!allowed) {
      event.preventDefault();

      if (/^https?:\/\//i.test(value)) {
        createTab(
          context,
          value,
          {
            activate: true,
            privateMode: true,
          }
        );
      }
    }
  });

  privateWindow.on("resize", () => {
    applyTabArea(context);
    hideToolbarOverflow(context);
  });

  privateWindow.on("move", () => {
    hideToolbarOverflow(context);
  });

  privateWindow.on("enter-html-full-screen", () => {
    applyTabArea(context);
  });

  privateWindow.on("leave-html-full-screen", () => {
    leaveHtmlFullscreen(context);
  });
  privateWindow.on("maximize", () => {
    sendToContextShell(context, "window:maximized", true);
  });
  privateWindow.on("unmaximize", () => {
    sendToContextShell(context, "window:maximized", false);
  });
  privateWindow.on("close", () => {
    if (!hasOtherLiveBrowserContext(context)) {
      shuttingDown = true;
      cancelPendingUiWork();
    }
    try { context.chatBubbleView?.setVisible(false); } catch {}
    try { context.toolbarOverflowWindow?.destroy(); } catch {}
  });
  privateWindow.on("closed", async () => {
    // Encerra somente o publisher pertencente a esta janela privada antes de
    // remover o BrowserContext que permite resolver seus eventos IPC.
    await stopWatchPublisher(context);

    browserContexts.delete(privateWindow.id);

    // Solta as referências dos WebContentsViews desta janela.
    context.tabs.clear();

    void clearPrivateSessionIfUnused();
  });

  await privateWindow.loadURL(
    browserUiUrl()
  );

  // Esta janela só pode ser criada a partir de uma sessão MarshMallow
  // já autenticada. As páginas continuam isoladas na sessão privada.
  context.shellOnly = false;

  createTab(
    context,
    input || currentNewTabUrl(),
    {
      activate: true,
      privateMode: true,
    }
  );

  privateWindow.show();

  return privateWindow;
}

async function createMainWindow() {
  if (!preparingToQuit) shuttingDown = false;
  mainWindow = createBrowserWindow();

  mainBrowserContext = createBrowserContext(mainWindow, {
    privateMode: false,
    isMain: true,
  });

  mainWindow.on("resize", () => {
    applyTabArea(mainBrowserContext);
    hideToolbarOverflow(mainBrowserContext);
  });
  mainWindow.on("move", () => {
    hideToolbarOverflow(mainBrowserContext);
  });
  mainWindow.on("enter-html-full-screen", () => {
    applyTabArea(mainBrowserContext);
  });
  mainWindow.on("leave-html-full-screen", () => {
    leaveHtmlFullscreen(mainBrowserContext);
  });
  mainWindow.on("maximize", () => sendToShell("window:maximized", true));
  mainWindow.on("unmaximize", () => sendToShell("window:maximized", false));
  mainWindow.on("close", () => {
    // Arm process-wide shutdown guards only when this is the last browser
    // context. A surviving private window must remain fully operational.
    if (!hasOtherLiveBrowserContext(mainBrowserContext)) {
      shuttingDown = true;
      cancelPendingUiWork();
    }
    saveSession();
    try { chatBubbleView?.setVisible(false); } catch {}
    try { toolbarOverflowWindow?.destroy(); } catch {}
  });
  mainWindow.on("closed", () => {
    const closedContext = mainBrowserContext;
    if (closedContext?.window?.id != null) {
      browserContexts.delete(closedContext.window.id);
    }
    tabs.clear();
    activeTabId = null;
    htmlFullscreenTabId = null;
    chatBubbleView = null;
    toolbarOverflowWindow = null;
    mainBrowserContext = null;
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(String(url || ""))) createTab(url, { activate: true });
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    const value = String(url || "");
    if (app.isPackaged) {
      try {
        const local = fileURLToPath(value);
        const distRoot = path.resolve(DIST) + path.sep;
        allowed = path.resolve(local).startsWith(distRoot);
      } catch { allowed = false; }
    } else {
      allowed = value.startsWith(DEV_URL);
    }
    if (!allowed) { event.preventDefault(); if (/^https?:\/\//i.test(value)) createTab(value, { activate: true }); }
  });
  installShellTextContextMenu(mainBrowserContext);
  handleShellShortcuts(mainBrowserContext);
  void applySessionPreferences(mainWindow.webContents.session, { proxy: false });

  const uiUrl = browserUiUrl();

  await mainWindow.loadURL(uiUrl);
  mainWindow.show();
  restoreSession();
  applyTabArea(mainBrowserContext);
  emitState();
}

ipcMain.handle("browser:get-state", (event) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) {
    return {
      version: VERSION,
      activeTabId: null,
      tabs: [],
    };
  }

  return allTabsState(context);
});
ipcMain.handle("browser:new-tab", (event, url) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return null;

  return createTab(
    context,
    url || currentNewTabUrl(),
    { activate: true }
  );
});
ipcMain.handle("browser:new-private-tab", (event, url) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return null;

  return createTab(
    context,
    url || currentNewTabUrl(),
    {
      activate: true,
      privateMode: true,
    }
  );
});
ipcMain.handle("browser:new-internal-tab", (event, page) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return null;

  return createInternalTab(
    context,
    page,
    { activate: true }
  );
});
ipcMain.handle("browser:reorder-tabs", (event, ids) => {
  const context = contextForWebContents(event.sender);
  if (!context) return { tabs: [], activeTabId: null };
  return reorderTabs(context, ids);
});
ipcMain.handle("browser:extract-text", (event) => {
  const context = contextForWebContents(event.sender);
  return extractActivePageText(context || mainBrowserContext);
});
ipcMain.handle("browser:set-chat-bubble", (event, payload) => {
  const context = contextForWebContents(event.sender);
  if (!context) return { visible: false, unread: 0 };
  return setChatBubbleState(context, payload);
});
ipcMain.handle("browser:set-shell-only", (event, value) => {
  const context = contextForWebContents(event.sender);
  if (!context) return true;
  return setShellOnly(context, value);
});
ipcMain.handle("browser:activate-tab", (event, id) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return;

  return activateTab(
    context,
    id
  );
});
ipcMain.handle("browser:close-tab", (event, id) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return;

  return closeTab(
    context,
    id
  );
});
ipcMain.handle("browser:reopen-tab", (event) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return;

  return reopenClosedTab(
    context
  );
});
ipcMain.handle("browser:navigate", (event, input) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return;

  const tab =
    activeTab(context);

  if (!tab) return;

  const targetUrl =
    normalizeUrl(input);

  if (
    browserPreferences.nativeAuthMode === "auto" &&
    isNativeAuthUrl(targetUrl)
  ) {
    return openNativeBrowserUrl(
      targetUrl,
      { reason: "address-bar", context }
    );
  }

  if (!tab.view) {
    const oldId = tab.id;

    createTab(
      context,
      targetUrl,
      {
        activate: true,
        privateMode: Boolean(tab.private),
      }
    );

    void closeTab(
      context,
      oldId
    );

    return;
  }

  const pageContents =
    tab.view.webContents;

  // Focusing before loadURL commits only focuses the old document. The newly
  // committed document can then start unfocused and consume the user's first
  // click. Arm a one-shot handoff consumed by did-navigate instead.
  tab.focusAfterNavigation = true;

  applyCompatibleUserAgent(
    pageContents,
    targetUrl
  );

  pageContents
    .loadURL(targetUrl)
    .catch(() => {
      tab.focusAfterNavigation = false;
    });
});
ipcMain.handle("browser:action", (event, action) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;
  return tabAction(context, action);
});

ipcMain.handle("browser:get-navigation-history", (event, direction) => {
  const context = contextForWebContents(event.sender);

  if (!context) {
    return { currentIndex: 0, items: [] };
  }

  const tab = activeTab(context);

  if (!tab?.view) {
    return { currentIndex: 0, items: [] };
  }

  const nav = tab.view.webContents.navigationHistory;
  const entries = nav.getAllEntries();
  const currentIndex = nav.getActiveIndex();

  return {
    currentIndex,
    items: buildHistoryMenu(
      entries,
      currentIndex,
      direction,
      15
    ).map((item) => ({
      ...item,
      favicon: faviconByUrl.get(item.url) || "",
    })),
  };
});

ipcMain.handle("browser:go-navigation-index", (event, index) => {
  const context = contextForWebContents(event.sender);

  if (!context) return { tabs: [], activeTabId: null };

  const tab = activeTab(context);

  if (!tab?.view) return allTabsState(context);

  const nav = tab.view.webContents.navigationHistory;
  const i = Number(index);

  if (
    Number.isInteger(i) &&
    i >= 0 &&
    i < nav.getAllEntries().length
  ) {
    nav.goToIndex(i);
  }

  return allTabsState(context);
});
ipcMain.handle("browser:get-game-mode", (event) => {
  const context = contextForWebContents(event.sender);
  return getActiveGameMode(context || mainBrowserContext);
});
ipcMain.handle("browser:set-game-mode", (event, setting) => {
  const context = contextForWebContents(event.sender);
  return setActiveGameMode(context || mainBrowserContext, setting);
});
ipcMain.handle("browser:report-game-signals", (event, signals) => {
  const context = contextForWebContents(event.sender);
  if (!context) return getActiveGameMode(mainBrowserContext);
  const tab = activeTab(context);
  if (!tab) return getActiveGameMode(context);
  gameSignalsByTab.set(tab.id, signals && typeof signals === "object" ? signals : {});
  tab.gameMode = currentGameModeForTab(tab);
  return getActiveGameMode(context);
});
ipcMain.handle("browser:get-performance-diagnostics", (event) => {
  const context = contextForWebContents(event.sender);
  return performanceDiagnostics(context || mainBrowserContext);
});
ipcMain.handle("browser:open-support-url", (_event, url) => openSupportUrl(url));
ipcMain.handle("browser:check-update", () => checkForUpdate());
ipcMain.handle("browser:download-update", () => downloadVerifiedUpdate());
ipcMain.handle("browser:set-muted", (event, id, muted) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;

  const tab = context.tabs.get(id);
  if (!tab || !tab.view) return;

  tab.userMuted = Boolean(muted);
  syncTabAudioMute(tab);
  emitContextState(context);
});
ipcMain.handle("browser:set-layout", (event, bounds) => {
  const context =
    contextForWebContents(event.sender);

  if (!context || !bounds) return;

  const nextArea = {
    x: Number(bounds.x || 0),
    y: Number(bounds.y || 0),
    width: Number(bounds.width || 100),
    height: Number(bounds.height || 100),
  };

  context.tabArea = nextArea;

  if (context.isMain) {
    tabArea = nextArea;
  }

  applyTabArea(context);
  return allTabsState(context);
});
ipcMain.handle("browser:set-toolbar-overflow", (event, payload) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) return false;

  return setToolbarOverflow(
    context,
    payload
  );
});
ipcMain.handle("browser:set-dock", (event, payload) => {
  const context =
    contextForWebContents(event.sender);

  if (!context) {
    return {
      mode: "none",
      width: 0,
      pageBounds: null,
    };
  }

  return setDockState(
    context,
    payload
  );
});
ipcMain.handle("browser:devtools", (event) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;

  const tab = activeTab(context);

  if (tab?.view) {
    tab.view.webContents.openDevTools({ mode: "detach" });
  } else if (!context.window.isDestroyed()) {
    context.window.webContents.openDevTools({ mode: "detach" });
  }
});

ipcMain.handle("browser:inspect", (event) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;

  const tab = activeTab(context);

  if (tab?.view) {
    tab.view.webContents.openDevTools({ mode: "detach" });
  } else if (!context.window.isDestroyed()) {
    context.window.webContents.openDevTools({ mode: "detach" });
  }
});
ipcMain.handle("browser:get-preferences", () => browserPreferences);
ipcMain.handle("browser:set-preferences", (_event, prefs) => applyBrowserPreferences(prefs));
ipcMain.handle("browser:choose-download-folder", async (event) => {
  const context = contextForWebContents(event.sender);
  if (!context?.window || context.window.isDestroyed()) return "";
  const result = await dialog.showOpenDialog(context.window, {
    title: "Escolha a pasta de downloads",
    defaultPath: browserPreferences.downloadPath || app.getPath("downloads"),
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? "" : String(result.filePaths?.[0] || "");
});
ipcMain.handle("browser:clear-browsing-data", () => clearBrowsingDataNow());
ipcMain.handle("browser:list-cookies", (_event, query) => listBrowserCookies(query));
ipcMain.handle("browser:save-cookies", () => saveCookiesNow());
ipcMain.handle("browser:remove-cookie", (_event, cookie) => removeBrowserCookie(cookie));
ipcMain.handle("browser:clear-cookies", () => clearCookiesOnly());
ipcMain.handle("browser:export-cookies", (_event, passphrase) => exportCookieBackup(passphrase));
ipcMain.handle("browser:import-cookies", (_event, passphrase) => importCookieBackup(passphrase));
ipcMain.handle("browser:save-wallpaper", (_event, payload) => saveWallpaperCopy(payload));
ipcMain.handle("browser:apply-wallpaper", (_event, payload) => applyWallpaperToWindows(payload));
ipcMain.handle("browser:find-audible-tabs", (event) => {
  const context = contextForWebContents(event.sender);
  return findAudibleTabs(context || mainBrowserContext);
});
ipcMain.handle("browser:sleep-background-tabs", (event) => {
  const context = contextForWebContents(event.sender);
  return sleepBackgroundTabs(context || mainBrowserContext);
});
ipcMain.handle("browser:get-downloads", () => downloadSnapshot());
ipcMain.handle("browser:pause-download", (_event, id) => pauseDownload(id));
ipcMain.handle("browser:resume-download", (_event, id) => resumeDownload(id));
ipcMain.handle("browser:cancel-download", (_event, id) => cancelDownload(id));
ipcMain.handle("browser:open-download", (_event, id) => openDownloadedFile(id));
ipcMain.handle("browser:show-download", (_event, id) => showDownloadedFile(id));
ipcMain.handle("browser:clear-download-history", () => clearDownloadHistory());
ipcMain.handle("browser:get-downloader-manager", () => checkDownloaderManagerAvailability());
ipcMain.handle("browser:refresh-downloader-manager", () => checkDownloaderManagerAvailability({ force:true }));
ipcMain.handle("browser:open-downloader-manager-installer", () => openDownloaderManagerInstaller());
ipcMain.handle("browser:open-downloads-folder", () => shell.openPath(browserPreferences.downloadPath || app.getPath("downloads")));
ipcMain.handle("browser:open-default-apps", () => {
  if (process.platform !== "win32") return { ok: false, error: "Esta tela de configurações existe apenas no Windows." };
  return shell.openExternal("ms-settings:defaultapps");
});
ipcMain.handle("browser:make-default-browser", () => makeDefaultBrowser());
ipcMain.handle("browser:open-native-url", (event, url) => {
  const context = contextForWebContents(event.sender);
  return openNativeBrowserUrl(url, { reason: "manual", context: context || mainBrowserContext });
});
ipcMain.handle("browser:get-native-engine", () => nativeEngineInfo());
ipcMain.handle("browser:list-extensions", () => extensionManagerState());
ipcMain.handle("browser:set-extension-settings", (_event, patch) => setExtensionSettings(patch));
ipcMain.handle("browser:load-unpacked-extension", () => chooseUnpackedExtension());
ipcMain.handle("browser:install-extension-archive", () => chooseExtensionArchive());
ipcMain.handle("browser:install-extension-url", (_event, url) => installExtensionFromUrl(url));
ipcMain.handle("browser:set-extension-enabled", (_event, id, enabled) => setExtensionEnabled(id, enabled));
ipcMain.handle("browser:reload-extension", (_event, id) => reloadManagedExtension(id));
ipcMain.handle("browser:set-extension-file-access", (_event, id, allow) => setExtensionFileAccess(id, allow));
ipcMain.handle("browser:remove-extension", (_event, id) => removeManagedExtension(id));
ipcMain.handle("browser:open-extension-folder", (_event, id) => { const record = findExtensionRecord(id); return record ? shell.openPath(record.path) : "Extensão não encontrada."; });
ipcMain.handle("browser:pack-extension", (_event, id) => packExtensionZip(id));
ipcMain.handle("browser:list-media", (event) => {
  const context = contextForWebContents(event.sender);
  return scanActiveMedia(context || mainBrowserContext);
});
ipcMain.handle("browser:media-capabilities", () => mediaCapabilities());
ipcMain.handle("browser:download-media", (event, id, format) => {
  const context = contextForWebContents(event.sender);
  if (!context) return { ok: false, error: "Contexto do navegador indisponível." };
  return downloadMediaCandidate(context, id, format);
});

ipcMain.handle("window:minimize", (event) => {
  const targetWindow =
    BrowserWindow.fromWebContents(event.sender);

  if (
    !targetWindow ||
    targetWindow.isDestroyed()
  ) {
    return false;
  }

  targetWindow.minimize();
  return true;
});

ipcMain.handle("window:maximize-toggle", (event) => {
  const targetWindow =
    BrowserWindow.fromWebContents(event.sender);

  if (
    !targetWindow ||
    targetWindow.isDestroyed()
  ) {
    return false;
  }

  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize();
  } else {
    targetWindow.maximize();
  }

  return targetWindow.isMaximized();
});

ipcMain.handle("window:close", (event) => {
  const targetWindow =
    BrowserWindow.fromWebContents(event.sender);

  if (
    !targetWindow ||
    targetWindow.isDestroyed()
  ) {
    return false;
  }

  targetWindow.close();
  return true;
});

ipcMain.handle("pdf:fetch-url", async (event, url) => {
  const context = contextForWebContents(event.sender);
  const targetUrl = String(url || "");
  if (!context) return { ok: false, error: "Contexto do navegador indisponível." };
  if (!/^https?:\/\//i.test(targetUrl)) return { ok: false, error: "Somente URLs HTTP(S) podem ser abertas no PDF Reader." };

  try {
    const targetSession = session.fromPartition(context.privateMode ? PRIVATE_PARTITION : TAB_PARTITION);
    const response = await targetSession.fetch(targetUrl, { method: "GET", redirect: "follow" });
    if (!response.ok) return { ok: false, error: `Falha HTTP ${response.status} ao abrir o PDF.` };
    const mimeType = String(response.headers.get("content-type") || "");
    if (!isPdfMime(mimeType) && !isPdfUrl(targetUrl)) {
      return { ok: false, error: "O endereço não retornou um documento PDF." };
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > 268435456) return { ok: false, error: "PDF maior que 256 MB; use o download normal para este arquivo." };
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 268435456) return { ok: false, error: "PDF maior que 256 MB; use o download normal para este arquivo." };
    return { ok: true, bytes: new Uint8Array(arrayBuffer), name: pdfNameFromUrl(targetUrl), mimeType: mimeType || "application/pdf" };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle("pdf:save", async (event, bytes, suggestedName) => {
  const context = contextForWebContents(event.sender);
  if (!context?.window || context.window.isDestroyed()) return { ok: false, error: "Janela indisponível." };
  try {
    const data = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
    if (!data.length) return { ok: false, error: "O PDF está vazio." };
    const filename = safeFilename(String(suggestedName || "documento.pdf"), "documento.pdf");
    const result = await dialog.showSaveDialog(context.window, {
      title: "Salvar PDF",
      defaultPath: path.join(app.getPath("documents"), /\.pdf$/i.test(filename) ? filename : `${filename}.pdf`),
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(result.filePath, data);
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle("backend:request", (_event, input) => requestFirstPartyBackend(input));

ipcMain.handle("watch:start-media", async (event, config) => {
  const context = contextForWebContents(event.sender);
  if (!context) {
    return { ok: false, error: "Contexto do navegador indisponível." };
  }

  try {
    return await createWatchPublisher(context, config);
  } catch (error) {
    await stopWatchPublisher(context);
    const message = String(error?.message || error);
    reportWatchStatus(context, { phase: "error", message });
    return { ok: false, error: message };
  }
});
ipcMain.handle("watch:stop-media", (event) => {
  const context = contextForWebContents(event.sender);
  if (!context) return false;
  return stopWatchPublisher(context);
});

ipcMain.on("chat-bubble:open", (event) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;
  sendToContextShell(context, "ui:open-watch-chat");
});
ipcMain.on("chat-bubble:hide-until-new", (event) => {
  const context = contextForWebContents(event.sender);
  if (!context) return;
  sendToContextShell(context, "ui:hide-watch-chat");
});

ipcMain.on("watch-host:ready", (event) => {
  const context = contextForWatchPublisherContents(event.sender);
  if (!context) return;

  reportWatchStatus(context, {
    phase: "publisher-ready",
    message: "Janela publisher confirmou que os listeners estão prontos.",
  });

  context.watchPublisherReadyResolver?.();
});

ipcMain.on("watch-host:status", (event, payload) => {
  const context = contextForWatchPublisherContents(event.sender);
  if (!context) return;

  reportWatchStatus(context, payload);
  const phase = String(payload?.phase || "");
  const message = String(payload?.message || "");
  console.log(`[Watch ${phase}] ${message}`);
});

if (HAS_SINGLE_INSTANCE_LOCK) app.whenReady().then(async () => {
  configurePermissions();
  await restoreInstalledExtensions();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

app.on("before-quit", (event) => {
  if (preparingToQuit) return;
  event.preventDefault();
  preparingToQuit = true;
  shuttingDown = true;
  cancelPendingUiWork();
  saveSession();
  try { chatBubbleView?.setVisible(false); } catch {}
  const ses = normalTabSession();
  void (async () => {
    try {
      if (browserPreferences.clearBrowsingDataOnExit) await clearBrowsingDataNow();
      else {
        await ses.cookies.flushStore();
        await ses.flushStorageData();
      }
    } catch (error) {
      console.warn("[Session] Falha ao finalizar armazenamento:", error);
    } finally {
      app.quit();
    }
  })();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
