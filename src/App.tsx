import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BrowserCookieSummary, BrowserExtension, BrowserPreferences, BrowserState, BrowserTab, DownloadRecord, DownloadSnapshot, DownloaderManagerState, ExtensionManagerState, GameModeState, GameDomainSetting, InternalPageId, MediaCandidate, MediaCapabilities, NavigationMenuEntry, PermissionMode, PerformanceDiagnostics, UpdateState, WatchSession, WatchStatus } from "./types";
import { buildAddressSuggestions, type OmniboxSuggestion as AddressSuggestion } from "./lib/omnibox";
import PdfReaderPage from "./pdf/PdfReaderPage";
import "./styles.css";

const DEFAULT_API = import.meta.env.VITE_MARSHMALLOW_API_URL || "https://marshmallow-gateway.marshmallow-browser-br.workers.dev";
const HOME_URL = "marshmallow://newtab";
const SETTINGS_KEY = "mm.settings.3.1";
const BOOKMARKS_KEY = "mm.bookmarks.3.1";
const HISTORY_KEY = "mm.history.3.1";
const GROUPS_KEY = "mm.groupsByUrl.3.1";
const AI_LOG_KEY = "mm.aiLog.3.1";
const AUTH_TOKEN_KEY = "mm.auth.token.3.1";

function isGoogleVerificationUrl(value: string) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    const isGoogleHost = host === "google.com" || host.endsWith(".google.com") || host === "google.com.br" || host.endsWith(".google.com.br");
    return isGoogleHost && url.pathname.startsWith("/sorry/");
  } catch {
    return false;
  }
}

const DEFAULT_BROWSER_PREFERENCES: BrowserPreferences = {
  startupMode: "continue",
  startupPages: [],
  homePage: HOME_URL,
  newTabPage: HOME_URL,
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
  acceptLanguages: "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  autoplayPolicy: "allow",
  backgroundThrottling: true,
  deferBackgroundMediaUntilActivated: true,
  hardwareAcceleration: true,
  proxyMode: "system",
  proxyRules: "",
  webrtcPolicy: "default",
  imageAnimationPolicy: "animate",
  nativeAuthMode: "off",
  nativeBrowser: "edge",
  gameModeByDomain: {},
  permissionDefaults: { camera: "ask", microphone: "ask", location: "ask", notifications: "ask", clipboard: "ask", midi: "ask", fullscreen: "allow" },
};

function wsUrl(httpUrl: string) { return httpUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:"); }
function makeMessageId() { try { return crypto.randomUUID(); } catch { return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; } }

function aiReplyToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(aiReplyToText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "content", "message", "answer", "reply", "response"]) {
      if (key in record) {
        const text = aiReplyToText(record[key]);
        if (text) return text;
      }
    }
    try { return JSON.stringify(value, null, 2); } catch { return ""; }
  }
  return String(value);
}
function readJson<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function normalizeText(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function siteOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function normalizeTrustedPopupSite(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(url.protocol) ? url.hostname.replace(/^www\./i, "").replace(/\.$/, "") : "";
  } catch { return ""; }
}
function friendlyTime(at: number) { const d = new Date(at); return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function formatBytes(value: number) { const n = Math.max(0, Number(value || 0)); if (n < 1024) return `${Math.round(n)} B`; const units = ["KB", "MB", "GB", "TB"]; let x = n / 1024; let unit = units[0]; for (let i = 1; i < units.length && x >= 1024; i += 1) { x /= 1024; unit = units[i]; } return `${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} ${unit}`; }
function downloadStateLabel(item: DownloadRecord) { if (item.state === "completed") return "Concluído"; if (item.state === "paused") return "Pausado"; if (item.state === "cancelled") return "Cancelado"; if (item.state === "interrupted") return item.canResume ? "Interrompido · pode continuar" : "Interrompido"; return item.totalBytes > 0 ? `${item.progress.toFixed(item.progress % 1 ? 1 : 0)}%` : "Baixando…"; }

function categoryFor(tab: BrowserTab) {
  if (tab.internalPage) return "MarshMallow";
  const t = normalizeText(`${tab.title} ${tab.url}`);
  if (/anime|goyabu|animefire|anroll|sushianime|donghua|crunchyroll/.test(t)) return "Anime";
  if (/youtube|youtu\.be/.test(t)) return /music|musica|official video|lyric|vevo/.test(t) ? "Música" : "YouTube";
  if (/spotify|deezer|soundcloud|music|musica|bandcamp/.test(t)) return "Música";
  if (/netflix|primevideo|disney|hbo|max\.com|filme|series|movie|cinema/.test(t)) return "Filmes/Séries";
  if (/github|stackoverflow|npmjs|developer|docs\.|code|programa|tecnologia|tech/.test(t)) return "Tecnologia";
  if (/amazon|mercadolivre|shopee|aliexpress|ebay|shop|loja/.test(t)) return "Compras";
  if (/instagram|facebook|x\.com|twitter|tiktok|reddit|discord|twitch/.test(t)) return "Social";
  if (/news|noticia|g1\.|uol|cnn|bbc|reuters|folha|estadao/.test(t)) return "Notícias";
  return "Outros";
}

const THEMES = [
  { id: "black-piano", name: "Black Piano", glyph: "●", description: "Preto profundo e metal escovado." },
  { id: "sakura-night", name: "Sakura Night", glyph: "桜", description: "Rosa noturno discreto." },
  { id: "neo-tokyo", name: "Neo Tokyo", glyph: "光", description: "Azul frio futurista." },
  { id: "dark-fantasy", name: "Dark Fantasy", glyph: "◆", description: "Bronze, carvão e fantasia sombria." },
  { id: "arctic-anime", name: "Arctic Anime", glyph: "❄", description: "Gelo, névoa e azul ártico." },
] as const;

type WallpaperMode = "none" | "fixed" | "shuffle" | "daily";
type WallpaperCollection = "studio" | "photographic";
type WallpaperPreset = {
  id: string;
  name: string;
  src: string;
  collection: WallpaperCollection;
  author?: string;
  online?: boolean;
};

function bundledWallpaper(fileName: string) {
  try { return new URL(`wallpapers/${fileName}`, window.location.href).href; }
  catch { return `./wallpapers/${fileName}`; }
}

const STUDIO_WALLPAPERS: WallpaperPreset[] = [
  { id: "aurora-north", name: "Aurora Boreal", src: bundledWallpaper("aurora_north.webp"), collection: "studio" },
  { id: "mist-forest", name: "Floresta de Névoa", src: bundledWallpaper("mist_forest.webp"), collection: "studio" },
  { id: "eclipse-ridge", name: "Eclipse", src: bundledWallpaper("eclipse_ridge.webp"), collection: "studio" },
  { id: "ember-dunes", name: "Dunas de Âmbar", src: bundledWallpaper("ember_dunes.webp"), collection: "studio" },
  { id: "lunar-ocean", name: "Oceano Lunar", src: bundledWallpaper("lunar_ocean.webp"), collection: "studio" },
  { id: "violet-nebula", name: "Nebulosa Violeta", src: bundledWallpaper("violet_nebula.webp"), collection: "studio" },
  { id: "cobalt-dunes", name: "Dunas de Cobalto", src: bundledWallpaper("cobalt_dunes.webp"), collection: "studio" },
  { id: "aurora-silence", name: "Silêncio Boreal", src: bundledWallpaper("aurora_silence.webp"), collection: "studio" },
  { id: "black-satin", name: "Black Satin", src: bundledWallpaper("black_satin.webp"), collection: "studio" },
  { id: "afterglow-clouds", name: "Afterglow", src: bundledWallpaper("afterglow_clouds.webp"), collection: "studio" },
  { id: "blue-glacier", name: "Glaciar Azul", src: bundledWallpaper("blue_glacier.webp"), collection: "studio" },
  { id: "emerald-lake", name: "Lago Esmeralda", src: bundledWallpaper("emerald_lake.webp"), collection: "studio" },
];

// Coleção fotográfica opcional. Ela só é carregada quando o usuário a escolhe.
// As fotos são gratuitas sob a licença Unsplash; créditos em WALLPAPER_CREDITS.md.
const PHOTOGRAPHIC_WALLPAPERS: WallpaperPreset[] = [
  { id: "photo-aurora-ungaro", name: "Aurora Ártica", author: "Francesco Ungaro", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1752759667426-be8b901c5fc5?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-mist-forest", name: "Entre Pinheiros", author: "Marita Kavelashvili", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-dark-ocean", name: "Oceano Noturno", author: "Jeremy Bishop", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1497044793173-df560dfbe923?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-aurora-iceland", name: "Aurora na Islândia", author: "Vincent Guth", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1506155475929-a146afddd515?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-aurora-meteor", name: "Céu Boreal", author: "Jaanus Jagomägi", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1579201157678-a242a244b34e?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-star-camp", name: "Noite Estrelada", author: "Pic Kaca", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1765813957002-d38730e03b11?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-waterfall", name: "Cachoeira na Floresta", author: "Albert Dera", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1775531844474-5258a7c2ac4c?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-misty-lake", name: "Lago Nebuloso", author: "Dmytro Yarish", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1755147053209-3cf6b1199236?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-desert-stars", name: "Deserto Estrelado", author: "Jean Carlo Emer", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1570053102001-b73ba5912a08?auto=format&fit=crop&q=82&w=2560" },
  { id: "photo-dark-patagonia", name: "Patagônia Sombria", author: "Marek Piwnicki", online: true, collection: "photographic", src: "https://images.unsplash.com/photo-1753296427965-beecbfb0ab9a?auto=format&fit=crop&q=82&w=2560" },
];

const WALLPAPER_PRESETS: WallpaperPreset[] = [...STUDIO_WALLPAPERS, ...PHOTOGRAPHIC_WALLPAPERS];

function shuffledWallpapers(items: WallpaperPreset[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function wallpaperPool(collection: WallpaperCollection) {
  return collection === "photographic" ? PHOTOGRAPHIC_WALLPAPERS : STUDIO_WALLPAPERS;
}

function wallpaperThumbnail(item: WallpaperPreset) {
  return item.online ? item.src.replace("q=82&w=2560", "q=62&w=520") : item.src;
}

function deterministicDailyIndex(length: number) {
  if (!length) return 0;
  const now = new Date();
  const key = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`);
  return key % length;
}

type ThemeId = typeof THEMES[number]["id"];
type PanelName = "watch" | "ai" | "organizer" | "media" | "game" | null;
type Bookmark = { url: string; title: string };
type HistoryEntry = { url: string; title: string; at: number; visits?: number };
type ChatMessage = { id: string; name: string; role: "host" | "guest"; text: string; at: number; own?: boolean };
type AiMessage = { role: "user" | "assistant"; text: string; at: number };
type AiPermissions = { organizeTabs: boolean; openPages: boolean; readCurrentPage: boolean; autoOrganize: boolean; closeTabs: "ask" | "allow" | "deny" };
type AiAction =
  | { type: "sort_tabs"; mode: "alpha" | "site" | "recent" }
  | { type: "group_tabs"; groups: Array<{ name: string; tabIds: string[] }> }
  | { type: "open_url"; url: string }
  | { type: "close_tabs"; tabIds: string[] };
type UndoSnapshot = { order: string[]; groupsByUrl: Record<string, string>; description: string };
type AccountProfile = { username: string; displayName: string; createdAt: number; provider?: "local" | "google" | "microsoft" };
type AuthMode = "register" | "login" | "recover";
type BackendJsonResult = {
  ok: boolean;
  status: number;
  data: Record<string, any>;
  error?: string;
  body: string;
};

async function callBackend(
  path: string,
  options: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string } = {},
): Promise<BackendJsonResult> {
  const reply = await window.marshmallow.backend.request({ path, ...options });
  let data: Record<string, any> = {};
  if (reply.body) {
    try { data = JSON.parse(reply.body) as Record<string, any>; } catch { data = {}; }
  }
  return { ok: reply.ok, status: reply.status, data, error: reply.error, body: reply.body };
}

type Settings = {
  compactTabs: boolean;
  theme: ThemeId;
  customWallpaper: string;
  wallpaperMode: WallpaperMode;
  wallpaperCollection: WallpaperCollection;
  wallpaperOpacity: number;
  wallpaperBlur: number;
  displayName: string;
  chatBubblePersistentHidden: boolean;
  interfaceFontScale: number;
  permissions: AiPermissions;
};

const DEFAULT_PERMISSIONS: AiPermissions = { organizeTabs: true, openPages: true, readCurrentPage: false, autoOrganize: false, closeTabs: "ask" };
const DEFAULT_SETTINGS: Settings = {
  compactTabs: true,
  theme: "black-piano",
  customWallpaper: "",
  wallpaperMode: "none",
  wallpaperCollection: "photographic",
  wallpaperOpacity: 88,
  wallpaperBlur: 0,
  displayName: "BlackBeard",
  chatBubblePersistentHidden: false,
  interfaceFontScale: 130,
  permissions: DEFAULT_PERMISSIONS,
};

function loadUiSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  const legacyWallpaperSettings = saved.wallpaperMode == null;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    wallpaperMode: saved.wallpaperMode ?? (saved.customWallpaper ? "fixed" : "none"),
    wallpaperCollection: saved.wallpaperCollection ?? "photographic",
    wallpaperOpacity: legacyWallpaperSettings && saved.wallpaperOpacity === 24 ? 88 : (saved.wallpaperOpacity ?? DEFAULT_SETTINGS.wallpaperOpacity),
    wallpaperBlur: legacyWallpaperSettings && saved.wallpaperBlur === 4 ? 0 : (saved.wallpaperBlur ?? DEFAULT_SETTINGS.wallpaperBlur),
    permissions: { ...DEFAULT_PERMISSIONS, ...(saved.permissions || {}) },
  };
}

function loadBookmarks(): Bookmark[] {
  const current = readJson<Bookmark[]>(BOOKMARKS_KEY, []);
  if (Array.isArray(current) && current.length) return current;
  const legacy = readJson<Record<string, string>>("mm.bookmarks", {});
  return Object.entries(legacy).map(([url, title]) => ({ url, title }));
}

export default function App() {
  const [state, setState] = useState<BrowserState>({ version: "5.0.2", platform: "unknown", activeTabId: null, tabs: [] });
  const isWindows = state.platform === "win32";
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressSuggestionIndex, setAddressSuggestionIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>(loadUiSettings);
  const [maximized, setMaximized] = useState(false);
  const [panel, setPanel] = useState<PanelName>(null);
  const [watchSession, setWatchSession] = useState<WatchSession | null>(null);
  const [watchStatus, setWatchStatus] = useState<WatchStatus>({ phase: "idle", message: "Pronto para transmitir." });
  const [watchTrace, setWatchTrace] = useState<WatchStatus[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatUnread, setChatUnread] = useState(0);
  const [chatBubbleHiddenUntilNew, setChatBubbleHiddenUntilNew] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readJson(HISTORY_KEY, []));
  const [groupsByUrl, setGroupsByUrl] = useState<Record<string, string>>(() => readJson(GROUPS_KEY, {}));
  const [aiLog, setAiLog] = useState<string[]>(() => readJson(AI_LOG_KEY, []));
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authUsername, setAuthUsername] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authRecoveryCode, setAuthRecoveryCode] = useState("");
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState("");
  const [pendingAccount, setPendingAccount] = useState<AccountProfile | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [aiProvider, setAiProvider] = useState("verificando");
  const [browserPreferences, setBrowserPreferences] = useState<BrowserPreferences>(DEFAULT_BROWSER_PREFERENCES);
  const [settingsRestartRequired, setSettingsRestartRequired] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaCandidate[]>([]);
  const [mediaCapabilitiesState, setMediaCapabilitiesState] = useState<MediaCapabilities | null>(null);
  const [mediaUsesMediaSource, setMediaUsesMediaSource] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [downloadsState, setDownloadsState] = useState<DownloadSnapshot>({ items:[], active:0, managerMode:"builtin" });
  const [downloadPanelView, setDownloadPanelView] = useState<"downloads" | "media">("downloads");
  const [gameModeState, setGameModeState] = useState<GameModeState | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [navigationMenu, setNavigationMenu] = useState<{ direction: "back" | "forward"; items: NavigationMenuEntry[] } | null>(null);
  const [pendingPopup, setPendingPopup] = useState<{ tabId?: string; url?: string; openerUrl?: string } | null>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const addressAreaRef = useRef<HTMLDivElement>(null);
  const toolbarOverflowButtonRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const seenChatIds = useRef(new Set<string>());
  const toastTimerRef = useRef<number | null>(null);
  const lastHistoryRef = useRef("");
  const dragTabRef = useRef<string | null>(null);
  const panelRef = useRef(panel);
  const settingsRef = useRef(settings);
  const aiTranscriptRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const navHoldTimerRef = useRef<number | null>(null);
  const navHoldTriggeredRef = useRef(false);

  const active = useMemo(() => state.tabs.find((tab) => tab.id === state.activeTabId) || null, [state]);
  const addressSuggestions = useMemo(() => browserPreferences.addressSuggestionsEnabled ? buildAddressSuggestions(address, history, bookmarks, state.tabs, Boolean(active?.private)) : [], [address, history, bookmarks, state.tabs, active?.private, browserPreferences.addressSuggestionsEnabled]);
  const showAddressSuggestions = addressFocused && addressSuggestions.length > 0 && (!active?.internalPage || active.internalPage === "newtab");
  const omniboxPopoverHeight = showAddressSuggestions ? Math.min(8, addressSuggestions.length) * 44 + 34 : 0;
  const historyPopoverHeight = navigationMenu ? Math.min(520, Math.min(15, Math.max(1, navigationMenu.items.length)) * 44 + 96) : 0;
  const popupPermissionHeight = pendingPopup ? 74 : 0;
  const chromePopoverHeight = Math.max(omniboxPopoverHeight, historyPopoverHeight, popupPermissionHeight);
  const dockOpen = panel !== null;
  const chatBubbleVisible = Boolean(watchSession && panel !== "watch" && !settings.chatBubblePersistentHidden && !chatBubbleHiddenUntilNew);
  const groupedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tab of state.tabs) {
      const group = groupsByUrl[tab.url] || categoryFor(tab);
      counts.set(group, (counts.get(group) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [state.tabs, groupsByUrl]);

  useEffect(() => { panelRef.current = panel; }, [panel]);

  useEffect(() => {
    const off = window.marshmallow.browser.onToolbarOverflowState((open) => {
      setToolbarMenuOpen(open);
    });
    return off;
  }, []);
  useEffect(() => {
    const syncDock = () => {
      if (!panel) {
        document.documentElement.style.setProperty("--dock-w", "386px");
        void window.marshmallow.browser.setDock({ mode: "none", width: 0 });
        return;
      }
      const sidebarWidth = settingsRef.current.compactTabs ? 64 : 232;
      const available = Math.max(320, window.innerWidth - sidebarWidth - 320);
      const width = Math.max(320, Math.min(386, available));
      document.documentElement.style.setProperty("--dock-w", `${width}px`);
      void window.marshmallow.browser.setDock({ mode: panel, width });
    };
    syncDock();
    window.addEventListener("resize", syncDock);
    return () => {
      window.removeEventListener("resize", syncDock);
      void window.marshmallow.browser.setDock({ mode: "none", width: 0 });
    };
  }, [panel, settings.compactTabs]);
  useEffect(() => {
    if (panel !== "game") return;
    void window.marshmallow.browser.getGameMode().then(setGameModeState).catch(() => setGameModeState(null));
  }, [panel, active?.url]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    if (panel !== "ai") return;
    const frame = requestAnimationFrame(() => {
      const node = aiTranscriptRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [aiMessages.length, aiBusy, panel]);
  useEffect(() => {
    if (panel !== "watch") return;
    const frame = requestAnimationFrame(() => {
      const node = chatLogRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.length, panel]);

  useEffect(() => {
    let cancelled = false;
    void window.marshmallow.browser.getPreferences().then((prefs) => {
      if (!cancelled && prefs) setBrowserPreferences(prefs);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function refreshMedia() {
    try {
      const [list, capabilities] = await Promise.all([window.marshmallow.browser.listMedia(), window.marshmallow.browser.mediaCapabilities()]);
      setMediaItems(list.items || []);
      setMediaUsesMediaSource(Boolean(list.usesMediaSource));
      setMediaCapabilitiesState(capabilities);
    } catch { setMediaItems([]); setMediaUsesMediaSource(false); }
  }

  async function refreshDownloads() {
    try { setDownloadsState(await window.marshmallow.browser.getDownloads()); }
    catch { setDownloadsState({ items:[], active:0, managerMode:browserPreferences.downloadManagerMode || "builtin" }); }
  }

  useEffect(() => {
    const off = window.marshmallow.browser.onMediaChanged((payload) => {
      if (payload.tabId === state.activeTabId) void refreshMedia();
    });
    return off;
  }, [state.activeTabId]);
  useEffect(() => {
    void refreshDownloads();
    const off = window.marshmallow.browser.onDownloadsChanged((payload) => setDownloadsState(payload));
    return off;
  }, []);
  useEffect(() => { if (panel === "media") { void refreshDownloads(); if (downloadPanelView === "media") void refreshMedia(); } }, [panel, state.activeTabId, downloadPanelView]);

  useEffect(() => {
    // WebContentsView fica acima do React no Electron. Enquanto a sessão ainda
    // não foi validada (ou não existe conta), ocultamos TODAS as páginas nativas
    // para que o cadastro/login seja realmente a primeira tela visível.
    void window.marshmallow.browser.setShellOnly(!authChecked || !account);
  }, [authChecked, account?.username]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const health = await callBackend("/health");
        if (!health.ok) throw new Error(health.error || `HTTP ${health.status}`);
        const data = health.data;
        if (!cancelled) setAiProvider(String(data.aiProvider || (data.geminiConfigured ? "gemini" : "none")));
      } catch {
        if (!cancelled) setAiProvider("offline");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
      if (!token) { if (!cancelled) setAuthChecked(true); return; }
      try {
        const response = await callBackend("/api/auth/session", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (!response.ok || !data.profile) throw new Error(String(data.error || response.error || "Sessão inválida."));
        if (!cancelled) {
          const profile = data.profile as AccountProfile;
          setAccount(profile);
          setSettings((current) => ({ ...current, displayName: profile.displayName || current.displayName }));
        }
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2600);
  }

  useEffect(() => {
    window.marshmallow.browser.getState().then(setState);
    const offState = window.marshmallow.browser.onState(setState);
    const offMax = window.marshmallow.window.onMaximized(setMaximized);
    const offFocus = window.marshmallow.ui.onFocusAddress(() => { addressRef.current?.focus(); addressRef.current?.select(); });
    const offAi = window.marshmallow.ui.onOpenAI(() => setPanel("ai"));
    const offDownloads = window.marshmallow.ui.onOpenDownloads(() => { setDownloadPanelView("downloads"); setPanel("media"); });
    const offWatch = window.marshmallow.watch.onStatus((status) => { setWatchStatus(status); setWatchTrace((current) => [...current.slice(-15), status]); });
    const offPopup = window.marshmallow.ui.onPopupBlocked((payload) => setPendingPopup(payload));
    const offNativeAuth = window.marshmallow.ui.onNativeAuthOpened((payload) => showToast(`Login protegido aberto no ${payload.engine || "navegador nativo"}. Continue a autenticação nessa janela.`));
    const offPageContext = window.marshmallow.ui.onPageContext(() => {
      if (watchSession && settingsRef.current.chatBubblePersistentHidden) {
        setSettings((current) => ({ ...current, chatBubblePersistentHidden: false }));
        setChatBubbleHiddenUntilNew(false);
        showToast("Balão do chat reexibido");
      }
    });
    const offOpenWatchChat = window.marshmallow.ui.onOpenWatchChat(() => { setPanel("watch"); setChatUnread(0); });
    const offHideWatchChat = window.marshmallow.ui.onHideWatchChat(() => setChatBubbleHiddenUntilNew(true));
    return () => { offState(); offMax(); offFocus(); offAi(); offDownloads(); offWatch(); offPopup(); offNativeAuth(); offPageContext(); offOpenWatchChat(); offHideWatchChat(); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [watchSession]);

  useEffect(() => {
    if (!pendingPopup) return;
    setAddressFocused(false);
    addressRef.current?.blur();
    setNavigationMenu(null);
  }, [pendingPopup]);

  useEffect(() => { if (active) { setAddress(active.internalPage === "newtab" ? "" : (active.url || "")); setAddressSuggestionIndex(0); } }, [active?.id, active?.url, active?.internalPage]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 1000))); }, [history]);
  useEffect(() => { localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsByUrl)); }, [groupsByUrl]);
  useEffect(() => { localStorage.setItem(AI_LOG_KEY, JSON.stringify(aiLog.slice(0, 80))); }, [aiLog]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const root = document.documentElement;
    root.style.setProperty("--custom-wallpaper", settings.wallpaperMode === "fixed" && settings.customWallpaper ? `url("${settings.customWallpaper}")` : "none");
    root.style.setProperty("--wallpaper-opacity", String(settings.wallpaperOpacity / 100));
    root.style.setProperty("--wallpaper-blur", `${settings.wallpaperBlur}px`);
    root.style.setProperty("--ui-root-font-size", `${16 * Math.min(1.6, Math.max(1, settings.interfaceFontScale / 100))}px`);
  }, [settings.theme, settings.customWallpaper, settings.wallpaperMode, settings.wallpaperOpacity, settings.wallpaperBlur, settings.interfaceFontScale]);

  useEffect(() => {
    if (!active || active.private || !/^https?:/i.test(active.url) || active.loading || isGoogleVerificationUrl(active.url)) return;
    const key = active.url;
    if (lastHistoryRef.current === key) return;
    lastHistoryRef.current = key;
    setHistory((current) => {
      const previous = current.find((item) => item.url === active.url);
      const next: HistoryEntry = { url: active.url, title: active.title || active.url, at: Date.now(), visits: (previous?.visits || 0) + 1 };
      return [next, ...current.filter((item) => item.url !== active.url)].slice(0, 1000);
    });
  }, [active?.url, active?.title, active?.loading, active?.private]);

  useEffect(() => {
    void window.marshmallow.browser.setChatBubble({ visible: chatBubbleVisible && !dockOpen, unread: chatUnread });
  }, [chatBubbleVisible, dockOpen, chatUnread]);

  useEffect(() => {
    const sendBounds = () => {
      const el = surfaceRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      void window.marshmallow.browser.setLayout({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    };
    sendBounds();
    const observer = new ResizeObserver(sendBounds); if (surfaceRef.current) observer.observe(surfaceRef.current);
    window.addEventListener("resize", sendBounds);
    const timer = window.setTimeout(sendBounds, 120);
    return () => { observer.disconnect(); window.removeEventListener("resize", sendBounds); clearTimeout(timer); };
  }, [settings.compactTabs, dockOpen, chromePopoverHeight]);

  useEffect(() => () => socketRef.current?.close(), []);

  useEffect(() => {
    if (!settings.permissions.autoOrganize || state.tabs.length < 2) return;
    const timer = window.setTimeout(() => void organizeBySubject(false), 650);
    return () => clearTimeout(timer);
  }, [state.tabs.length, settings.permissions.autoOrganize]);

  function navigateTo(value: string) {
    const target = value.trim();
    if (!target) return;
    setAddressFocused(false);
    // The shell omnibox and the page are separate Electron WebContents.
    // Release React/input focus before asking the native page to navigate so
    // the first click on the loaded page is a real click, not only focus handoff.
    addressRef.current?.blur();
    void window.marshmallow.browser.navigate(target);
  }
  function navigate(event?: FormEvent) { event?.preventDefault(); navigateTo(address); }
  function onAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && addressSuggestions.length) {
      event.preventDefault();
      setAddressSuggestionIndex((current) => (current + 1) % addressSuggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && addressSuggestions.length) {
      event.preventDefault();
      setAddressSuggestionIndex((current) => (current - 1 + addressSuggestions.length) % addressSuggestions.length);
      return;
    }
    if (event.key === "Tab" && showAddressSuggestions) {
      const suggestion = addressSuggestions[Math.min(addressSuggestionIndex, addressSuggestions.length - 1)];
      if (suggestion) {
        event.preventDefault();
        setAddress(suggestion.url);
        setAddressSuggestionIndex(0);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // Comportamento de omnibox tradicional: qualquer edição ainda não
      // navegada é descartada e a barra volta a mostrar o endereço real da aba.
      const currentTabAddress = active?.internalPage === "newtab" ? "" : (active?.url || "");
      setAddress(currentTabAddress);
      setAddressSuggestionIndex(0);
      setAddressFocused(false);
      addressRef.current?.blur();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = showAddressSuggestions ? addressSuggestions[Math.min(addressSuggestionIndex, addressSuggestions.length - 1)] : null;
      navigateTo(suggestion?.url || address);
    }
  }

  async function toggleToolbarOverflow() {
    const next = !toolbarMenuOpen;

    if (next) setNavigationMenu(null);

    const rect = toolbarOverflowButtonRef.current?.getBoundingClientRect();

    setToolbarMenuOpen(next);

    try {
      await window.marshmallow.browser.setToolbarOverflow({
        open: next,
        anchor: rect
          ? {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            }
          : undefined,
      });
    } catch {
      setToolbarMenuOpen(false);
    }
  }
  async function openNavigationHistory(direction: "back" | "forward") {
    try {
      const result = await window.marshmallow.browser.getNavigationHistory(direction);
      setAddressFocused(false);
      addressRef.current?.blur();
      setToolbarMenuOpen(false);
      void window.marshmallow.browser.setToolbarOverflow({ open: false });
      setNavigationMenu({ direction, items: result.items || [] });
    } catch {
      setNavigationMenu(null);
    }
  }
  function navPointerDown(direction: "back" | "forward") {
    navHoldTriggeredRef.current = false;
    if (navHoldTimerRef.current) window.clearTimeout(navHoldTimerRef.current);
    navHoldTimerRef.current = window.setTimeout(() => {
      navHoldTriggeredRef.current = true;
      void openNavigationHistory(direction);
    }, 450);
  }
  function navPointerUp(action: "back" | "forward") {
    if (navHoldTimerRef.current) window.clearTimeout(navHoldTimerRef.current);
    navHoldTimerRef.current = null;
    if (!navHoldTriggeredRef.current) {
      setNavigationMenu(null);
      void window.marshmallow.browser.action(action);
    }
    navHoldTriggeredRef.current = false;
  }
  async function goToNavigationItem(item: NavigationMenuEntry) {
    try { await window.marshmallow.browser.goNavigationIndex(item.index); } finally { setNavigationMenu(null); }
  }
  async function updateGameMode(patch: Partial<GameDomainSetting>) {
    const current = gameModeState?.setting || { mode: "auto", saveResourcesInBackground: false };
    const next: GameDomainSetting = { ...current, ...patch };
    try { setGameModeState(await window.marshmallow.browser.setGameMode(next)); } catch { showToast("Não foi possível alterar o Modo Jogo."); }
  }

  function toggleBookmark() {
    if (!active?.url || active.internalPage || active.private || !/^https?:/i.test(active.url)) return;
    setBookmarks((current) => current.some((item) => item.url === active.url) ? current.filter((item) => item.url !== active.url) : [{ url: active.url, title: active.title || active.url }, ...current]);
  }

  async function openUrl(url: string, privateMode = false) {
    if (privateMode) await window.marshmallow.browser.newPrivateTab(url);
    else await window.marshmallow.browser.newTab(url);
    setPanel(null);
  }

  function snapshot(description: string) { setUndoSnapshot({ order: state.tabs.map((tab) => tab.id), groupsByUrl: { ...groupsByUrl }, description }); }
  function logAi(text: string) { setAiLog((current) => [`${new Date().toLocaleTimeString("pt-BR")} — ${text}`, ...current].slice(0, 80)); }

  async function reorder(order: string[]) { await window.marshmallow.browser.reorderTabs(order); }

  async function sortTabs(mode: "alpha" | "site" | "recent", withSnapshot = true) {
    if (!settings.permissions.organizeTabs) { showToast("Permissão para organizar abas está desativada."); return; }
    if (withSnapshot) snapshot(`Ordenação ${mode}`);
    const sorted = [...state.tabs].sort((a, b) => {
      if (mode === "alpha") return (a.title || a.url).localeCompare(b.title || b.url, "pt-BR", { sensitivity: "base" });
      if (mode === "site") return siteOf(a.url).localeCompare(siteOf(b.url), "pt-BR", { sensitivity: "base" }) || (a.title || "").localeCompare(b.title || "", "pt-BR");
      return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
    });
    await reorder(sorted.map((tab) => tab.id));
    logAi(`Organizou ${sorted.length} abas (${mode}).`);
  }

  async function organizeBySubject(withSnapshot = true) {
    if (!settings.permissions.organizeTabs) { showToast("Permissão para organizar abas está desativada."); return; }
    if (withSnapshot) snapshot("Organização por assunto");
    const nextGroups = { ...groupsByUrl };
    for (const tab of state.tabs) if (!tab.private) nextGroups[tab.url] = categoryFor(tab);
    setGroupsByUrl(nextGroups);
    const groupFor = (tab: BrowserTab) => tab.private ? categoryFor(tab) : (nextGroups[tab.url] || categoryFor(tab));
    const order = [...state.tabs].sort((a, b) => groupFor(a).localeCompare(groupFor(b), "pt-BR") || (a.title || a.url).localeCompare(b.title || b.url, "pt-BR"));
    await reorder(order.map((tab) => tab.id));
    logAi(`Organizou as abas por assunto em ${new Set(order.map((tab) => nextGroups[tab.url])).size} grupos.`);
  }

  async function closeDuplicates() {
    const seen = new Set<string>(); const ids: string[] = [];
    for (const tab of state.tabs) { const key = tab.url.replace(/#.*$/, ""); if (seen.has(key)) ids.push(tab.id); else seen.add(key); }
    if (!ids.length) { showToast("Não há abas duplicadas."); return; }
    await closeTabIds(ids, "abas duplicadas");
  }

  async function closeTabIds(ids: string[], reason = "abas") {
    const valid = ids.filter((id) => state.tabs.some((tab) => tab.id === id)); if (!valid.length) return;
    if (settings.permissions.closeTabs === "deny") { showToast("A IA não tem permissão para fechar abas."); return; }
    if (settings.permissions.closeTabs === "ask" && !window.confirm(`Permitir que o MarshMallow feche ${valid.length} ${reason}?`)) return;
    snapshot(`Fechamento de ${valid.length} aba(s)`);
    for (const id of valid) await window.marshmallow.browser.closeTab(id);
    logAi(`Fechou ${valid.length} aba(s).`);
  }

  async function undoOrganization() {
    if (!undoSnapshot) { showToast("Nada para desfazer."); return; }
    await reorder(undoSnapshot.order);
    setGroupsByUrl(undoSnapshot.groupsByUrl);
    logAi(`Desfez: ${undoSnapshot.description}.`);
    setUndoSnapshot(null);
  }

  function applyGroups(groups: Array<{ name: string; tabIds: string[] }>) {
    if (!settings.permissions.organizeTabs) { showToast("Permissão para organizar abas está desativada."); return; }
    snapshot("Agrupamento pela IA");
    const byId = new Map<string, BrowserTab>(state.tabs.map((tab) => [tab.id, tab]));
    const next = { ...groupsByUrl };
    for (const group of groups) for (const id of group.tabIds || []) { const tab = byId.get(id); if (tab && !tab.private) next[tab.url] = String(group.name || "Outros").slice(0, 60); }
    setGroupsByUrl(next);
    const order = [...state.tabs].sort((a, b) => (next[a.url] || "Outros").localeCompare(next[b.url] || "Outros", "pt-BR"));
    void reorder(order.map((tab) => tab.id));
    logAi(`Aplicou agrupamento inteligente em ${groups.length} grupo(s).`);
  }

  async function executeAiActions(actions: AiAction[]) {
    for (const action of actions.slice(0, 12)) {
      if (action.type === "sort_tabs") await sortTabs(action.mode);
      else if (action.type === "group_tabs") applyGroups(action.groups || []);
      else if (action.type === "open_url") {
        if (!settings.permissions.openPages) { showToast("A IA não tem permissão para abrir páginas."); continue; }
        if (/^https?:\/\//i.test(action.url)) await window.marshmallow.browser.newTab(action.url);
      } else if (action.type === "close_tabs") await closeTabIds(action.tabIds || [], "abas sugeridas pela IA");
    }
  }

  async function runLocalIntent(prompt: string) {
    const p = normalizeText(prompt);
    if (!/(organ|ordene|agrupe|separe|abas|duplicad)/.test(p)) return false;
    if (/duplicad/.test(p)) { await closeDuplicates(); return true; }
    if (/assunto|categoria/.test(p)) { await organizeBySubject(); return true; }
    if (/site|dominio/.test(p)) { await sortTabs("site"); return true; }
    if (/recente|uso recente|ultim/.test(p)) { await sortTabs("recent"); return true; }
    if (/alfabet|a-z|az/.test(p)) { await sortTabs("alpha"); return true; }
    return false;
  }

  async function locateSoundSource() {
    try {
      const result = await window.marshmallow.browser.findAudibleTabs();
      let text = "Nenhuma aba está emitindo som neste momento.";
      if (result.count === 1) {
        const tab = result.tabs[0];
        text = `O som está vindo da aba “${tab.title}” (${siteOf(tab.url)}).`;
      } else if (result.count > 1) {
        text = `Há ${result.count} abas emitindo som:\n${result.tabs.map((tab, index) => `${index + 1}. ${tab.title} — ${siteOf(tab.url)}`).join("\n")}`;
      }
      setAiMessages((current) => [...current, { role: "assistant", text, at: Date.now() }]);
      showToast(result.count ? `${result.count} aba(s) com áudio identificada(s).` : "Nenhuma aba está emitindo som.");
    } catch (error) {
      setAiMessages((current) => [...current, { role: "assistant", text: `Não consegui verificar o áudio: ${String(error)}`, at: Date.now() }]);
    }
  }

  async function reduceTabMemory() {
    try {
      const result = await window.marshmallow.browser.sleepBackgroundTabs();
      const text = result.suspended > 0
        ? `${result.suspended} aba(s) em segundo plano foram suspensas para reduzir o uso de RAM. Elas continuam na barra de abas e recarregam automaticamente quando você clicar nelas. A aba atual foi preservada.`
        : result.alreadySleeping > 0
          ? `As abas em segundo plano já estavam suspensas. A aba atual continua ativa normalmente.`
          : `Não havia abas de sites em segundo plano disponíveis para suspender.`;
      setAiMessages((current) => [...current, { role: "assistant", text, at: Date.now() }]);
      showToast(result.suspended > 0 ? `${result.suspended} aba(s) suspensa(s) para economizar RAM.` : "Nenhuma nova aba precisou ser suspensa.");
    } catch (error) {
      setAiMessages((current) => [...current, { role: "assistant", text: `Não consegui ativar a economia de RAM: ${String(error)}`, at: Date.now() }]);
    }
  }

  async function handleWallpaperAction(action: "download" | "desktop" | "lockscreen", source: string, name = "MarshMallow Wallpaper") {
    if (!source) { showToast("Nenhum wallpaper ativo para usar."); return; }
    if (action === "download") {
      const result = await window.marshmallow.browser.saveWallpaper({ source, name });
      if (result.canceled) return;
      showToast(result.ok ? "Wallpaper salvo no computador." : `Não foi possível salvar: ${result.error || "erro desconhecido"}`);
      return;
    }
    const result = await window.marshmallow.browser.applyWallpaper({ source, name, target: action });
    if (result.ok) {
      showToast(action === "desktop" ? "Wallpaper aplicado à área de trabalho do Windows." : "Wallpaper aplicado à tela de bloqueio do Windows.");
    } else {
      showToast(`O Windows não aplicou a imagem: ${result.error || "permissão recusada"}`);
    }
  }

  async function askAI() {
    const prompt = aiPrompt.trim(); if (!prompt || aiBusy) return;
    setAiPrompt("");
    setAiMessages((current) => [...current, { role: "user", text: prompt, at: Date.now() }]);
    if (await runLocalIntent(prompt)) {
      setAiMessages((current) => [...current, { role: "assistant", text: "Concluído localmente, sem usar a IA online.", at: Date.now() }]);
      return;
    }
    setAiBusy(true);
    try {
      const normalized = normalizeText(prompt);
      const needsPage = !active?.private && settings.permissions.readCurrentPage && /(esta pagina|essa pagina|pagina atual|resum|explique|texto|artigo|site atual)/.test(normalized);
      const page = needsPage ? await window.marshmallow.browser.extractText() : undefined;
      const response = await fetch(`${DEFAULT_API}/api/ai`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          messages: aiMessages.slice(-10).map((item) => ({ role: item.role, text: item.text })),
          tabs: state.tabs.filter((tab) => !tab.private).map((tab) => ({ id: tab.id, title: tab.title, url: tab.url, groupId: groupsByUrl[tab.url] || "" })),
          groups: groupedCounts.map(([name]) => ({ name, tabIds: state.tabs.filter((tab) => !tab.private && (groupsByUrl[tab.url] || categoryFor(tab)) === name).map((tab) => tab.id) })).filter((group) => group.tabIds.length),
          permissions: settings.permissions,
          page: page?.text ? { title: page.title, url: page.url, text: page.text.slice(0, 16000) } : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const reply = aiReplyToText(data.reply ?? data.text ?? data.answer) || "Concluído.";
      if (Array.isArray(data.actions)) await executeAiActions(data.actions as AiAction[]);
      setAiMessages((current) => [...current, { role: "assistant", text: reply, at: Date.now() }]);
    } catch (error) {
      setAiMessages((current) => [...current, { role: "assistant", text: `Não consegui acessar a IA online agora. ${String(error)}`, at: Date.now() }]);
    } finally { setAiBusy(false); }
  }

  function addChatMessage(message: ChatMessage) {
    if (seenChatIds.current.has(message.id)) return;
    seenChatIds.current.add(message.id);
    setChat((current) => [...current.slice(-149), message]);
    if (!message.own && message.role === "guest" && panelRef.current !== "watch") {
      setChatUnread((value) => value + 1);
      if (!settingsRef.current.chatBubblePersistentHidden) setChatBubbleHiddenUntilNew(false);
    }
  }

  function connectWatchChat(session: WatchSession) {
    socketRef.current?.close();
    const url = `${wsUrl(DEFAULT_API)}/api/room/${encodeURIComponent(session.room)}/ws?token=${encodeURIComponent(session.hostToken)}&name=${encodeURIComponent(settings.displayName)}`;
    const socket = new WebSocket(url); socketRef.current = socket;
    socket.onmessage = (event) => {
      let data: any; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "chat") addChatMessage({ id: String(data.id || data.messageId || makeMessageId()), name: String(data.name || "Participante"), role: data.role === "host" ? "host" : "guest", text: String(data.text || ""), at: Number(data.at || Date.now()) });
      else if (data.type === "chat-history" && Array.isArray(data.messages)) for (const item of data.messages) addChatMessage({ id: String(item.id || item.messageId || makeMessageId()), name: String(item.name || "Participante"), role: item.role === "host" ? "host" : "guest", text: String(item.text || ""), at: Number(item.at || Date.now()) });
    };
  }

  async function createWatchRoom() {
    setWatchStatus({ phase: "creating", message: "Criando sala…" });
    try {
      const response = await fetch(`${DEFAULT_API}/api/rooms`, { method: "POST" }); const data = await response.json();
      if (!response.ok || !data.room) throw new Error(data.error || "Não foi possível criar a sala.");
      const session: WatchSession = { room: data.room, hostToken: data.hostToken, chatToken: data.chatToken, inviteUrl: data.inviteUrl };
      setWatchSession(session); setChat([]); setChatUnread(0); setWatchTrace([]); seenChatIds.current.clear(); connectWatchChat(session);
      setWatchStatus({ phase: "starting", message: "Preparando captura Electron…" });
      const result = await window.marshmallow.watch.startMedia({ apiUrl: DEFAULT_API, room: session.room, hostToken: session.hostToken, name: settings.displayName });
      if (!result.ok) setWatchStatus({ phase: "error", message: result.error || "Falha ao iniciar a mídia." });
    } catch (error) { setWatchStatus({ phase: "error", message: String(error) }); }
  }

  async function stopWatch() { socketRef.current?.close(); socketRef.current = null; await window.marshmallow.watch.stopMedia(); setWatchSession(null); setChat([]); setChatUnread(0); seenChatIds.current.clear(); }
  async function sendChat() {
    const text = chatText.trim(); if (!text || !watchSession) return; setChatText("");
    const id = makeMessageId(); addChatMessage({ id, name: "Você", role: "host", text, at: Date.now(), own: true });
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "chat", text, messageId: id }));
    void fetch(`${DEFAULT_API}/api/room/${encodeURIComponent(watchSession.room)}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatToken: watchSession.chatToken, name: settings.displayName, text, messageId: id }) }).catch(() => undefined);
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    const username = authUsername.trim().toLowerCase();
    const displayName = authDisplayName.trim();
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
      setAuthError("O usuário deve ter 3 a 24 caracteres: letras minúsculas, números, ponto, _ ou -.");
      return;
    }
    if (authMode === "register" && displayName.length < 2) {
      setAuthError("Informe seu nome de exibição.");
      return;
    }
    if (authMode === "recover" && authRecoveryCode.trim().length < 12) {
      setAuthError("Informe o código de recuperação entregue quando a conta foi criada.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthError(authMode === "recover" ? "A nova senha precisa ter pelo menos 8 caracteres." : "A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if ((authMode === "register" || authMode === "recover") && authPassword !== authConfirm) {
      setAuthError("As senhas não coincidem.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const endpoint = authMode === "register" ? "register" : authMode === "recover" ? "recover" : "login";
      const payload = authMode === "recover"
        ? { username, recoveryCode: authRecoveryCode, newPassword: authPassword }
        : { username, displayName, password: authPassword };
      const response = await callBackend(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = response.data;
      if (response.status === 0) {
        throw new Error(`Não foi possível conectar ao backend MarshMallow. ${response.error || "Falha de rede."}`);
      }
      if (response.status === 200 && data.service === "MarshMallow Gateway" && !data.token) {
        throw new Error("O backend online ainda não possui as rotas de conta desta versão.");
      }
      if (!response.ok || !data.token || !data.profile) {
        const detail = String(data.detail || "").trim();
        const serverError = String(data.error || "").trim();
        const rawBody = !serverError && !detail ? String(response.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280) : "";
        throw new Error(serverError ? `${serverError}${detail ? ` — ${detail}` : ""}` : (detail || rawBody || `HTTP ${response.status}`));
      }
      localStorage.setItem(AUTH_TOKEN_KEY, String(data.token));
      const profile = data.profile as AccountProfile;
      setAuthPassword("");
      setAuthConfirm("");
      setAuthRecoveryCode("");

      if ((authMode === "register" || authMode === "recover") && data.recoveryCode) {
        setPendingAccount(profile);
        setPendingRecoveryCode(String(data.recoveryCode));
        return;
      }

      setAccount(profile);
      setSettings((current) => ({ ...current, displayName: profile.displayName || current.displayName }));
      showToast("Login realizado.");
    } catch (error) {
      const text = String((error as Error)?.message || error);
      if (/404|Rota de conta|ainda não possui as rotas de conta/i.test(text)) {
        setAuthError("O backend ainda não foi atualizado para contas. Execute PUBLICAR_BACKEND_3.2.3.bat no computador do proprietário.");
      } else if (/Worker script configured by the website owner|unhandled exception/i.test(text)) {
        setAuthError("O serviço de contas da Cloudflare sofreu uma exceção. Publique o backend 3.2.3; esta versão cria um registro de contas novo e captura o erro real no servidor.");
      } else {
        setAuthError(text.replace(/^Error:\s*/i, ""));
      }
    } finally {
      setAuthBusy(false);
    }
  }

  function finishRecoveryNotice() {
    if (!pendingAccount) return;
    setAccount(pendingAccount);
    setSettings((current) => ({ ...current, displayName: pendingAccount.displayName || current.displayName }));
    setPendingAccount(null);
    setPendingRecoveryCode("");
    setAuthMode("login");
    showToast("Conta pronta. Código de recuperação confirmado.");
  }

  async function copyRecoveryCode() {
    if (!pendingRecoveryCode) return;
    try {
      await navigator.clipboard.writeText(pendingRecoveryCode);
      showToast("Código de recuperação copiado.");
    } catch {
      setAuthError("Não foi possível copiar automaticamente. Selecione e copie o código manualmente.");
    }
  }

  async function logoutAccount() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAccount(null);
    setAuthMode("login");
    setAuthUsername("");
    setAuthPassword("");
    setAuthConfirm("");
    setAuthRecoveryCode("");
    setPendingRecoveryCode("");
    setPendingAccount(null);
    if (token) void callBackend("/api/auth/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => undefined);
  }

  async function updateBrowserPreferences(patch: Partial<BrowserPreferences>) {
    const next: BrowserPreferences = {
      ...browserPreferences,
      ...patch,
      permissionDefaults: { ...browserPreferences.permissionDefaults, ...(patch.permissionDefaults || {}) },
    };
    setBrowserPreferences(next);
    try {
      const result = await window.marshmallow.browser.setPreferences(next);
      setBrowserPreferences(result.preferences);
      if (result.restartRequired) setSettingsRestartRequired(true);
    } catch (error) {
      showToast(`Não foi possível aplicar a configuração: ${String((error as Error)?.message || error)}`);
    }
  }

  async function openPendingPopupOnce() {
    const popup = pendingPopup;
    setPendingPopup(null);
    if (!popup?.url) return;
    await window.marshmallow.browser.newTab(popup.url);
  }

  async function trustPendingPopupSite() {
    const popup = pendingPopup;
    if (!popup?.url) return;
    const host = normalizeTrustedPopupSite(popup.openerUrl || active?.url || "");
    if (!host) {
      showToast("Não foi possível identificar o site que abriu o pop-up.");
      return;
    }
    const trustedPopupSites = [...new Set([...(browserPreferences.trustedPopupSites || []), host])].sort();
    await updateBrowserPreferences({ trustedPopupSites });
    setPendingPopup(null);
    await window.marshmallow.browser.newTab(popup.url);
  }

  async function setSitePermission(name: keyof BrowserPreferences["permissionDefaults"], value: PermissionMode) {
    await updateBrowserPreferences({ permissionDefaults: { ...browserPreferences.permissionDefaults, [name]: value } });
  }

  async function chooseDownloadFolder() {
    const folder = await window.marshmallow.browser.chooseDownloadFolder();
    if (folder) await updateBrowserPreferences({ downloadPath: folder });
  }

  async function clearBrowsingData() {
    const confirmed = window.confirm("Limpar cookies, cache e dados de sites do perfil normal do MarshMallow agora?");
    if (!confirmed) return;
    try {
      await window.marshmallow.browser.clearBrowsingData();
      setHistory([]);
      showToast("Cookies, cache e dados de sites foram limpos.");
    } catch (error) {
      showToast(`Falha ao limpar dados: ${String((error as Error)?.message || error)}`);
    }
  }

  async function downloadDetectedMedia(item: MediaCandidate, format: "original" | "mp3" | "mp4" | "merge") {
    setMediaBusy(true);
    try {
      const result = await window.marshmallow.browser.downloadMedia(item.id, format);
      if (result.ok) showToast(result.path ? `Mídia salva: ${result.path}` : `Download iniciado: ${result.filename || item.filename}`);
      else if (!result.canceled) showToast(result.error || "Não foi possível baixar esta mídia.");
    } finally { setMediaBusy(false); }
  }

  async function runDownloadAction(action: "pause" | "resume" | "cancel" | "open" | "show", item: DownloadRecord) {
    const api = window.marshmallow.browser;
    const result = action === "pause" ? await api.pauseDownload(item.id)
      : action === "resume" ? await api.resumeDownload(item.id)
      : action === "cancel" ? await api.cancelDownload(item.id)
      : action === "open" ? await api.openDownload(item.id)
      : await api.showDownload(item.id);
    if (!result.ok && result.error) showToast(result.error);
    await refreshDownloads();
  }

  function openPanel(name: Exclude<PanelName, null>) { setPanel((current) => current === name ? null : name); if (name === "watch") setChatUnread(0); }
  function openInternalPage(page: InternalPageId) {
    setPanel(null);
    void window.marshmallow.browser.newInternalTab(page);
  }

  function onWallpaper(file?: File) {
    if (!file) return;
    if (file.size > 4_000_000) { showToast("Escolha uma imagem com até 4 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setSettings((current) => ({ ...current, customWallpaper: String(reader.result || ""), wallpaperMode: "fixed" })); reader.readAsDataURL(file);
  }

  async function dropTab(targetId: string) {
    const sourceId = dragTabRef.current; dragTabRef.current = null; if (!sourceId || sourceId === targetId) return;
    const order = state.tabs.map((tab) => tab.id); const from = order.indexOf(sourceId); const to = order.indexOf(targetId); if (from < 0 || to < 0) return;
    order.splice(from, 1); order.splice(to, 0, sourceId); await reorder(order);
  }

  const activeBookmarked = Boolean(active?.url && !active.internalPage && bookmarks.some((item) => item.url === active.url));
  const activeInternalPage = active?.internalPage || null;
  const appClasses = ["app", settings.compactTabs ? "tabs-compact" : "", dockOpen ? "dock-open" : "", activeInternalPage ? "internal-page-open" : ""].filter(Boolean).join(" ");

  if (!authChecked) {
    return <div className="auth-screen"><AuthWindowControls maximized={maximized}/><div className="auth-card auth-loading"><img src="./icon.png" alt=""/><b>MarshMallow</b><span>Preparando seu perfil…</span></div></div>;
  }

  if (!account) {
    if (pendingRecoveryCode && pendingAccount) {
      return (
        <div className="auth-screen">
          <AuthWindowControls maximized={maximized}/>
          <div className="auth-card recovery-card">
            <div className="auth-brand"><img src="./icon.png" alt="MarshMallow"/><div><h1>Código de recuperação</h1><p>Guarde antes de continuar</p></div></div>
            <div className="recovery-warning">Este código é a chave para redefinir a senha de uma conta local. O MarshMallow mostra o código completo somente agora.</div>
            <button className="recovery-code" type="button" onClick={() => void copyRecoveryCode()} title="Clique para copiar">{pendingRecoveryCode}</button>
            <div className="recovery-actions"><button type="button" onClick={() => void copyRecoveryCode()}>Copiar código</button><button className="primary" type="button" onClick={finishRecoveryNotice}>Já guardei · Continuar</button></div>
            <div className="auth-foot"><span>🔑</span><p>O servidor armazena apenas uma verificação criptográfica deste código. Se você perder a senha e também perder este código, uma conta local não poderá ser recuperada automaticamente.</p></div>
          </div>
        </div>
      );
    }

    const recovering = authMode === "recover";
    return (
      <div className="auth-screen">
        <AuthWindowControls maximized={maximized}/>
        <div className="auth-card">
          <div className="auth-brand"><img src="./icon.png" alt="MarshMallow"/><div><h1>MarshMallow</h1><p>{authMode === "register" ? "Crie seu perfil para começar" : recovering ? "Recupere sua conta local" : "Entre na sua conta"}</p></div></div>
          {!recovering && <div className="auth-tabs"><button className={authMode === "register" ? "active" : ""} type="button" onClick={() => { setAuthMode("register"); setAuthError(""); }}>Criar conta</button><button className={authMode === "login" ? "active" : ""} type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>Entrar</button></div>}
          {recovering && <button className="auth-back" type="button" onClick={() => { setAuthMode("login"); setAuthError(""); setAuthPassword(""); setAuthConfirm(""); }}>← Voltar para entrar</button>}
          <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
            {authMode === "register" && <label><span>Nome de exibição</span><input value={authDisplayName} onChange={(e) => setAuthDisplayName(e.target.value)} maxLength={36} autoComplete="name" placeholder="Como você quer aparecer" autoFocus/></label>}
            <label><span>Nome de usuário</span><div className="username-field"><i>@</i><input value={authUsername} onChange={(e) => setAuthUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} maxLength={24} autoComplete="username" placeholder="seu.usuario" autoFocus={authMode !== "register"}/></div></label>
            {recovering && <label><span>Código de recuperação</span><input value={authRecoveryCode} onChange={(e) => setAuthRecoveryCode(e.target.value.toUpperCase())} maxLength={40} autoComplete="off" placeholder="MM-XXXX-XXXX-XXXX-XXXX-XXXX"/></label>}
            <label><span>{recovering ? "Nova senha" : "Senha"}</span><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} minLength={8} maxLength={128} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres"/></label>
            {(authMode === "register" || recovering) && <label><span>{recovering ? "Confirmar nova senha" : "Confirmar senha"}</span><input type="password" value={authConfirm} onChange={(e) => setAuthConfirm(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" placeholder="Digite a senha novamente"/></label>}
            {authMode === "login" && <button className="forgot-password" type="button" onClick={() => { setAuthMode("recover"); setAuthError(""); setAuthPassword(""); setAuthConfirm(""); }}>Esqueci minha senha</button>}
            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? "Aguarde…" : authMode === "register" ? "Criar minha conta" : recovering ? "Redefinir senha" : "Entrar no MarshMallow"}</button>
          </form>
          <div className="auth-foot"><span>{recovering ? "🔑" : "🔒"}</span><p>{authMode === "register" ? "A senha é armazenada somente como hash. Ao criar a conta, você receberá um código de recuperação único para guardar." : recovering ? "O código de recuperação é necessário para redefinir uma conta local sem Google ou Microsoft." : "Sua senha não é enviada para sites visitados e não é armazenada em texto aberto."}</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className={appClasses}>
      <header className="titlebar store-titlebar">
        <div className="title-drag"><span className="brand-mark">M</span><span className="brand-name">MarshMallow</span><span className="page-title">{active?.private ? "◐ Privada · " : ""}{active?.title || "Nova aba"}</span></div>
        <div className="windows-controls no-drag" aria-label="Controles da janela">
          <button className="window-control window-control-minimize" type="button" title="Minimizar" aria-label="Minimizar" onClick={() => void window.marshmallow.window.minimize()}>−</button>
          <button className="window-control window-control-maximize" type="button" title={maximized ? "Restaurar" : "Maximizar"} aria-label={maximized ? "Restaurar" : "Maximizar"} onClick={() => void window.marshmallow.window.maximizeToggle()}>{maximized ? "❐" : "□"}</button>
          <button className="window-control window-control-close" type="button" title="Fechar" aria-label="Fechar" onClick={() => void window.marshmallow.window.close()}>×</button>
        </div>
      </header>

      <div className="browser-grid">
        <aside className="sidebar">
          <div className="new-tab-row">
            <button className="new-tab" title="Nova aba (Ctrl+T)" onClick={() => void window.marshmallow.browser.newTab()}>＋</button>
            {!settings.compactTabs && <button className="private-tab" title="Nova aba privada" onClick={() => void window.marshmallow.browser.newPrivateTab()}>◐</button>}
          </div>
          <div className="tabs">
            {state.tabs.map((tab) => (
              <button key={tab.id} draggable className={`tab ${tab.active ? "active" : ""} ${tab.private ? "private" : ""} ${tab.sleeping ? "sleeping" : ""}`} title={`${groupsByUrl[tab.url] ? `${groupsByUrl[tab.url]} · ` : ""}${tab.title}${tab.sleeping ? " · Suspensa para economizar RAM" : ""}`} onDragStart={() => { dragTabRef.current = tab.id; }} onDragOver={(e) => e.preventDefault()} onDrop={() => void dropTab(tab.id)} onClick={() => void window.marshmallow.browser.activateTab(tab.id)}>
                <span className="tab-favicon-wrap">{tab.private ? <span className="private-tab-logo" aria-hidden="true">M</span> : tab.internalPage ? <span className="internal-tab-icon">{tab.internalPage === "newtab" ? "M" : tab.internalPage === "library" ? "★" : tab.internalPage === "themes" ? "◈" : tab.internalPage === "extensions" ? "🧩" : tab.internalPage === "support" ? "♡" : tab.internalPage === "performance" ? "⚡" : tab.internalPage === "pdf" ? "▤" : "⚙"}</span> : <img src={tab.favicon || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect rx='8' width='32' height='32' fill='%23171920'/%3E%3Ctext x='16' y='22' text-anchor='middle' fill='%23fff' font-size='17'%3EM%3C/text%3E%3C/svg%3E"} onError={(event) => { event.currentTarget.style.opacity = "0.35"; }} />}</span>
                {!settings.compactTabs && <><span className="tab-copy"><span className="tab-title">{tab.title}</span>{groupsByUrl[tab.url] && <span className="tab-group">{groupsByUrl[tab.url]}</span>}</span></>}
                {tab.audible && <span className="audio-dot" title={tab.muted ? "Silenciado" : "Reproduzindo áudio"} onClick={(event) => { event.stopPropagation(); void window.marshmallow.browser.setMuted(tab.id, !tab.muted); }}>{tab.muted ? "×" : "♪"}</span>}
                <span className={`tab-close ${settings.compactTabs ? "tab-close-compact" : ""}`} title="Fechar aba" onClick={(event) => { event.stopPropagation(); void window.marshmallow.browser.closeTab(tab.id); }}>×</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button title={settings.compactTabs ? "Expandir abas" : "Compactar abas"} onClick={() => setSettings((current) => ({ ...current, compactTabs: !current.compactTabs }))}><span className="sidebar-tool-icon" aria-hidden="true">{settings.compactTabs ? "›" : "‹"}</span><span className="sidebar-tool-label">{settings.compactTabs ? "Expandir abas" : "Compactar abas"}</span></button>
            <button className={panel === "organizer" ? "active-tool" : ""} title="Organizar abas" onClick={() => openPanel("organizer")}><span className="sidebar-tool-icon" aria-hidden="true">▦</span><span className="sidebar-tool-label">Organizar abas</span></button>
            <button className={activeInternalPage === "library" ? "active-tool" : ""} title="Favoritos e histórico — abrir em nova aba" onClick={() => openInternalPage("library")}><span className="sidebar-tool-icon" aria-hidden="true">★</span><span className="sidebar-tool-label">Favoritos e histórico</span></button>
            <button className={activeInternalPage === "themes" ? "active-tool" : ""} title="Temas — abrir em nova aba" onClick={() => openInternalPage("themes")}><span className="sidebar-tool-icon" aria-hidden="true">◈</span><span className="sidebar-tool-label">Temas</span></button>
            <button className={panel === "ai" ? "active-tool" : ""} title="MarshMallow AI (Ctrl+Shift+M)" onClick={() => openPanel("ai")}><span className="sidebar-tool-icon" aria-hidden="true">✦</span><span className="sidebar-tool-label">MarshMallow AI</span></button>
            <button className={panel === "watch" ? "active-tool" : ""} title="Watch Together" onClick={() => openPanel("watch")}><span className="sidebar-tool-icon" aria-hidden="true">🔥</span><span className="sidebar-tool-label">Watch Together</span>{chatUnread > 0 && <sup>{chatUnread > 99 ? "99+" : chatUnread}</sup>}</button>
            <button className={`pdf-sidebar-tool ${activeInternalPage === "pdf" ? "active-tool" : ""}`} title="PDF Reader" onClick={() => openInternalPage("pdf")}><span className="sidebar-tool-icon pdf-tool-icon" aria-hidden="true">PDF</span><span className="sidebar-tool-label">PDF Reader</span></button>
            <button className={activeInternalPage === "support" ? "active-tool" : ""} title="Apoie o MarshMallow" onClick={() => openInternalPage("support")}><span className="sidebar-tool-icon" aria-hidden="true">♡</span><span className="sidebar-tool-label">Apoie o MarshMallow</span></button>
            <button className={activeInternalPage === "settings" ? "active-tool" : ""} title="Configurações — abrir em nova aba" onClick={() => openInternalPage("settings")}><span className="sidebar-tool-icon" aria-hidden="true">⚙</span><span className="sidebar-tool-label">Configurações</span></button>
          </div>
        </aside>

        <main className="main-column" style={{ "--chrome-popover-height": `${chromePopoverHeight}px` } as CSSProperties}>
          <div className="toolbar">
            <div className="nav-buttons">
              <button disabled={!active?.canGoBack} title="Voltar · segure ou clique com o botão direito para ver o histórico" onPointerDown={(e) => { if (e.button === 0) navPointerDown("back"); }} onPointerUp={(e) => { if (e.button === 0) navPointerUp("back"); }} onPointerCancel={() => { if (navHoldTimerRef.current) clearTimeout(navHoldTimerRef.current); }} onContextMenu={(e) => { e.preventDefault(); void openNavigationHistory("back"); }}>←</button>
              <button disabled={!active?.canGoForward} title="Avançar · segure ou clique com o botão direito para ver o histórico" onPointerDown={(e) => { if (e.button === 0) navPointerDown("forward"); }} onPointerUp={(e) => { if (e.button === 0) navPointerUp("forward"); }} onPointerCancel={() => { if (navHoldTimerRef.current) clearTimeout(navHoldTimerRef.current); }} onContextMenu={(e) => { e.preventDefault(); void openNavigationHistory("forward"); }}>→</button>
              <button onClick={() => void window.marshmallow.browser.action(active?.loading ? "stop" : "reload")}>{active?.loading ? "×" : "↻"}</button>
              {browserPreferences.showHomeButton && <button title="Página inicial" onClick={() => void window.marshmallow.browser.navigate(browserPreferences.homePage || HOME_URL)}>⌂</button>}
            </div>
            <div className="address-area" ref={addressAreaRef}>
              <form className={`address-wrap ${active?.private ? "private-address" : ""} ${activeInternalPage ? "internal-address" : ""}`} onSubmit={navigate}><span className="security-dot">{active?.private ? "◐" : activeInternalPage ? "M" : "●"}</span><input ref={addressRef} value={address} onFocus={() => { setNavigationMenu(null); setAddressFocused(true); setAddressSuggestionIndex(0); }} onBlur={() => setAddressFocused(false)} onChange={(event) => { setAddress(event.target.value); setAddressSuggestionIndex(0); }} onKeyDown={onAddressKeyDown} spellCheck={false} autoComplete="off" aria-label="Barra de endereço"/><button type="button" className={activeBookmarked ? "bookmarked" : ""} disabled={Boolean(active?.private || activeInternalPage)} onClick={toggleBookmark}>☆</button></form>
              {showAddressSuggestions && <div className="omnibox-suggestions" role="listbox" aria-label="Sugestões da barra de endereço">
                {addressSuggestions.map((suggestion, index) => <button key={suggestion.id} type="button" className={`omnibox-suggestion ${index === addressSuggestionIndex ? "selected" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => navigateTo(suggestion.url)}>
                  <span className={`omnibox-source ${suggestion.source}`}>{suggestion.source === "bookmark" ? "★" : suggestion.source === "tab" ? "▣" : suggestion.source === "history" ? "◷" : suggestion.source === "url" ? "→" : "⌕"}</span>
                  <span className="omnibox-copy"><b>{suggestion.title}</b><small>{suggestion.subtitle}</small></span>
                  <span className="omnibox-url">{suggestion.source === "search" ? "" : suggestion.url.replace(/^https?:\/\//i, "")}</span>
                </button>)}
                <div className="omnibox-hint"><span>↑↓ navegar</span><span>Tab preencher</span><span>Enter abrir</span><span>Esc fechar</span></div>
              </div>}
            </div>
            <div className="toolbar-tools">
              <button className={`toolbar-action ${panel === "game" || active?.gameMode?.active ? "active-tool" : ""}`} title="Modo Jogo" disabled={Boolean(activeInternalPage || active?.private)} onClick={() => openPanel("game")}>🎮</button>
              <button className={`toolbar-action ${panel === "media" ? "active-tool" : ""}`} title={`Downloads${downloadsState.active ? ` · ${downloadsState.active} ativo${downloadsState.active === 1 ? "" : "s"}` : ""}${mediaItems.length ? ` · mídia detectada: ${mediaItems.length}` : ""}`} onClick={() => { setDownloadPanelView("downloads"); openPanel("media"); }}>↓{(downloadsState.active > 0 || mediaItems.length > 0) && <span className="toolbar-badge">{Math.min(downloadsState.active || mediaItems.length, 99)}</span>}</button>
              <button className={`toolbar-action ${activeInternalPage === "extensions" ? "active-tool" : ""}`} title="Extensões" onClick={() => openInternalPage("extensions")}>🧩</button>
              <div className="toolbar-overflow-wrap"><button ref={toolbarOverflowButtonRef} className={`toolbar-action ${toolbarMenuOpen ? "active-tool" : ""}`} title="Menu" onClick={() => void toggleToolbarOverflow()}>⋯</button></div>
            </div>

          </div>
          {navigationMenu && <div className="nav-history-menu" role="dialog" aria-label={navigationMenu.direction === "forward" ? "Páginas posteriores" : "Páginas anteriores"}>
            <div className="nav-history-head"><b>{navigationMenu.direction === "forward" ? "PÁGINAS POSTERIORES" : "PÁGINAS ANTERIORES"}</b><button className="nav-history-close" type="button" title="Fechar" aria-label="Fechar histórico" onClick={() => setNavigationMenu(null)}>×</button></div>
            <div className="nav-history-list">{navigationMenu.items.length ? navigationMenu.items.map((item) => <button key={`${item.index}:${item.url}`} type="button" className="nav-history-item" onClick={() => void goToNavigationItem(item)}>
              {item.favicon ? <img src={item.favicon} alt=""/> : <span className="nav-history-fallback">M</span>}
              <span><b>{item.title || siteOf(item.url)}</b><small>{siteOf(item.url)}</small></span>
            </button>) : <div className="nav-history-empty">Nenhuma página disponível.</div>}</div>
            <button type="button" className="nav-history-full" onClick={() => { setNavigationMenu(null); openInternalPage("library"); }}>◷ <span>Mostrar histórico completo</span></button>
          </div>}
          {pendingPopup && <div className="popup-permission-bar no-drag" role="dialog" aria-label="Pop-up bloqueado">
            <div className="popup-permission-copy"><b>Pop-up bloqueado em {normalizeTrustedPopupSite(pendingPopup.openerUrl || active?.url || "") || "este site"}</b><small>{pendingPopup.url ? siteOf(pendingPopup.url) : "Destino não identificado"}</small></div>
            <div className="popup-permission-actions"><button type="button" onClick={() => void openPendingPopupOnce()}>Abrir desta vez</button><button type="button" className="popup-trust" onClick={() => void trustPendingPopupSite()}>Sempre permitir neste site</button><button type="button" className="popup-dismiss" title="Fechar" aria-label="Fechar" onClick={() => setPendingPopup(null)}>×</button></div>
          </div>}
          <div className={`browser-surface ${activeInternalPage ? "browser-surface-internal" : ""}`} ref={surfaceRef}>
            {activeInternalPage === "newtab" ? <NewTabPage key={active?.id || "newtab"} settings={settings} onWallpaper={onWallpaper} onWallpaperAction={handleWallpaperAction} update={(patch) => setSettings((current) => ({ ...current, ...patch }))} openThemes={() => openInternalPage("themes")} openPdf={() => openInternalPage("pdf")} privateMode={Boolean(active?.private)} isWindows={isWindows}/>
              : activeInternalPage === "pdf" ? <PdfReaderPage tabId={active?.id || "pdf"} source={active?.pdfSource}/>
              : activeInternalPage === "library" ? <LibraryPage bookmarks={bookmarks} history={history} openUrl={(url) => void openUrl(url)} removeBookmark={(url) => setBookmarks((c) => c.filter((x) => x.url !== url))} clearHistory={() => setHistory([])}/>
              : activeInternalPage === "themes" ? <ThemesPage settings={settings} update={(patch) => setSettings((current) => ({ ...current, ...patch }))} onWallpaper={onWallpaper}/>
              : activeInternalPage === "extensions" ? <ExtensionsPage showToast={showToast}/>
              : activeInternalPage === "support" ? <SupportPage showToast={showToast}/>
              : activeInternalPage === "performance" ? <PerformancePage/>
              : activeInternalPage === "settings" ? <SettingsCenter
                embedded
                version={state.version || "5.0.2"}
                account={account}
                settings={settings}
                preferences={browserPreferences}
                restartRequired={settingsRestartRequired}
                logout={() => void logoutAccount()}
                updateUi={(patch) => setSettings((current) => ({ ...current, ...patch }))}
                updatePreferences={(patch) => void updateBrowserPreferences(patch)}
                updatePermission={(name, value) => void setSitePermission(name, value)}
                chooseDownloadFolder={() => void chooseDownloadFolder()}
                clearBrowsingData={() => void clearBrowsingData()}
                openDownloadsFolder={() => void window.marshmallow.browser.openDownloadsFolder()}
                isWindows={isWindows}
                openDefaultApps={() => {
                  if (isWindows) { void window.marshmallow.browser.openDefaultApps(); return; }
                  void window.marshmallow.browser.makeDefaultBrowser().then((result) => showToast(result.ok ? (result.message || "MarshMallow definido como navegador padrão.") : `Não foi possível definir o navegador padrão: ${result.error || "erro desconhecido"}`));
                }}
                reopenTab={() => void window.marshmallow.browser.reopenTab()}
                openDevTools={() => void window.marshmallow.browser.devTools()}
                newPrivateTab={() => void window.marshmallow.browser.newPrivateTab(browserPreferences.newTabPage || HOME_URL)}
                onWallpaper={onWallpaper}
              />
              : <div className="surface-placeholder"><span>M</span></div>}
          </div>
        </main>
      </div>

      {panel === "watch" && <section className="floating-panel no-drag">
        <PanelHead title="🔥 Watch Together" subtitle="Captura nativa de frame + LiveKit" close={() => setPanel(null)} />
        {!watchSession ? <><p className="panel-copy">O MarshMallow detecta o frame do player e transmite vídeo + áudio dele, sem capturar o áudio geral do sistema.</p><button className="primary" onClick={() => void createWatchRoom()}>Criar sala e transmitir</button></> : <>
          <div className="watch-code"><span>Sala</span><strong>{watchSession.room}</strong></div>
          <div className="invite-row"><input readOnly value={watchSession.inviteUrl}/><button onClick={() => void navigator.clipboard.writeText(watchSession.inviteUrl)}>Copiar</button></div>
          <div className={`watch-status phase-${watchStatus.phase}`}><span className="live-dot"/><div><b>{watchStatus.phase}</b><p>{watchStatus.message}</p></div></div>
          <details className="watch-trace"><summary>Diagnóstico ({watchTrace.length})</summary><div>{watchTrace.map((item, index) => <p key={`${item.phase}-${index}`}><b>{item.phase}</b><span>{item.message}</span></p>)}</div></details>
          <div className="chat-toolbar"><b>Chat</b><button onClick={() => { setPanel(null); setChatBubbleHiddenUntilNew(false); }}>Minimizar em balão</button></div>
          <div className="chat-log" ref={chatLogRef}>{chat.length === 0 && <div className="chat-empty">As mensagens aparecerão aqui.</div>}{chat.map((message) => <div className={`chat-message ${message.role === "host" ? "host" : ""}`} key={message.id}><b>{message.own ? "Você" : message.name}</b><span>{message.text}</span></div>)}</div>
          <div className="chat-compose"><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Mensagem…" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void sendChat(); } }}/><button onClick={() => void sendChat()}>↑</button></div>
          <label className="toggle-row chat-hide-toggle"><input type="checkbox" checked={settings.chatBubblePersistentHidden} onChange={(event) => setSettings((current) => ({ ...current, chatBubblePersistentHidden: event.target.checked }))}/><span>Ocultar balão sempre. Clique direito numa área livre da página para fazê-lo reaparecer.</span></label>
          <button className="danger" onClick={() => void stopWatch()}>Encerrar transmissão</button>
        </>}
      </section>}

      {panel === "game" && <section className="floating-panel game-panel no-drag">
        <PanelHead title="🎮 Modo Jogo" subtitle={gameModeState?.host || siteOf(active?.url || "")} close={() => setPanel(null)} />
        <div className={`game-status ${gameModeState?.active ? "active" : ""}`}><b>{gameModeState?.active ? "Ativo nesta página" : "Aguardando sinais de jogo"}</b><span>Detecção local · {gameModeState?.score || 0} pontos</span>{gameModeState?.reasons?.length ? <small>{gameModeState.reasons.join(" · ")}</small> : null}</div>
        <label className="setting-control"><span><b>Ativação por site</b><small>A preferência fica salva somente neste computador.</small></span><select value={gameModeState?.setting.mode || "auto"} onChange={(e) => void updateGameMode({ mode: e.target.value as GameDomainSetting["mode"] })}><option value="auto">Automático</option><option value="on">Sempre ligado</option><option value="off">Desligado</option></select></label>
        <Toggle checked={Boolean(gameModeState?.setting.saveResourcesInBackground)} text="Economizar recursos em segundo plano" set={(value) => void updateGameMode({ saveResourcesInBackground: value })}/>
        <div className="media-notice"><b>Compatibilidade moderna</b><span>WebGL/WebGL2, Canvas, WebAssembly, WebSocket, WebAudio, Gamepad, fullscreen e Pointer/Keyboard Lock continuam protegidos pelas regras do Chromium.</span><small>{gameModeState?.backgroundPolicy?.continuous ? "A janela está mantendo um jogo ativo em segundo plano." : "Throttling normal quando nenhum jogo exige execução contínua."}</small></div>
        <button className="secondary" onClick={() => openInternalPage("performance")}>Abrir diagnóstico de desempenho</button>
      </section>}

      {panel === "media" && <section className="floating-panel media-panel no-drag">
        <PanelHead title="↓ Downloads" subtitle={downloadsState.active ? `${downloadsState.active} download${downloadsState.active === 1 ? "" : "s"} ativo${downloadsState.active === 1 ? "" : "s"}` : `${downloadsState.items.length} item${downloadsState.items.length === 1 ? "" : "s"} recente${downloadsState.items.length === 1 ? "" : "s"}`} close={() => setPanel(null)} />
        <div className="download-panel-tabs"><button className={downloadPanelView === "downloads" ? "active" : ""} onClick={() => setDownloadPanelView("downloads")}>Downloads</button><button className={downloadPanelView === "media" ? "active" : ""} onClick={() => setDownloadPanelView("media")}>Mídia da página{mediaItems.length > 0 && <span>{Math.min(mediaItems.length, 99)}</span>}</button></div>
        {downloadPanelView === "downloads" ? <>
          <div className="media-notice download-manager-notice"><b>{downloadsState.managerMode === "external" ? "MarshMallow Downloader Manager" : "Gerenciador integrado do MarshMallow"}</b><span>{downloadsState.managerMode === "external" ? "Novos downloads serão enviados ao Downloader Manager quando a integração estiver disponível; se a chamada falhar, o navegador usa o gerenciador integrado." : "O navegador gerencia os downloads normalmente sem depender de outro programa."}</span></div>
          <div className="download-panel-actions"><button className="secondary" onClick={() => void window.marshmallow.browser.openDownloadsFolder()}>Abrir pasta</button><button className="secondary" disabled={!downloadsState.items.some((item) => !["progressing","paused"].includes(item.state))} onClick={async () => setDownloadsState(await window.marshmallow.browser.clearDownloadHistory())}>Limpar histórico</button></div>
          <div className="download-list">{downloadsState.items.length === 0 ? <div className="chat-empty">Nenhum download nesta sessão.</div> : downloadsState.items.map((item) => <div className={`download-item state-${item.state}`} key={item.id}>
            <div className="download-kind">{item.state === "completed" ? "✓" : item.state === "cancelled" ? "×" : item.state === "interrupted" ? "!" : item.state === "paused" ? "Ⅱ" : "↓"}</div>
            <div className="download-copy"><b title={item.filename}>{item.filename}</b><span>{downloadStateLabel(item)}{item.private ? " · privado" : ""}</span><small>{item.totalBytes > 0 ? `${formatBytes(item.receivedBytes)} de ${formatBytes(item.totalBytes)}` : formatBytes(item.receivedBytes)}{item.url ? ` · ${siteOf(item.url)}` : ""}</small>{(item.state === "progressing" || item.state === "paused") && item.totalBytes > 0 && <div className="download-progress"><i style={{ width:`${item.progress}%` }}/></div>}</div>
            <div className="download-actions">{item.canPause && <button title="Pausar" onClick={() => void runDownloadAction("pause", item)}>Ⅱ</button>}{item.canResume && <button title="Continuar" onClick={() => void runDownloadAction("resume", item)}>▶</button>}{item.canCancel && <button title="Cancelar" onClick={() => void runDownloadAction("cancel", item)}>×</button>}{item.canOpen && <button title="Abrir arquivo" onClick={() => void runDownloadAction("open", item)}>Abrir</button>}{item.canShow && <button title="Mostrar na pasta" onClick={() => void runDownloadAction("show", item)}>Pasta</button>}</div>
          </div>)}</div>
        </> : <>
          <div className="media-notice"><b>Downloader de mídia</b><span>O MarshMallow lista fontes de áudio/vídeo que a própria página expõe. Conteúdo protegido por DRM não é descriptografado nem contornado.</span><small>{mediaCapabilitiesState?.note || "Verificando mecanismos disponíveis…"}</small></div>{mediaUsesMediaSource && <div className="media-notice media-source-note"><b>Player adaptativo detectado</b><span>Esta página usa MediaSource/blob. O MarshMallow não tenta baixar o blob efêmero; ele correlaciona apenas as fontes HTTP(S) observadas na rede.</span></div>}
          <button className="secondary media-refresh" onClick={() => void refreshMedia()}>↻ Atualizar detecção</button>
          <div className="media-list">{mediaItems.length === 0 ? <div className="chat-empty">Nenhuma fonte reutilizável foi detectada nesta aba.</div> : mediaItems.map((item) => <div className="media-item" key={item.id}><div className="media-kind">{item.kind === "audio" ? "♫" : item.kind === "manifest" ? "▤" : "▶"}</div><div className="media-copy"><b>{item.kind === "audio" ? "Áudio" : item.kind === "manifest" ? "Stream" : item.kind === "muxed" ? "Vídeo + áudio" : "Vídeo"}{item.resolution ? ` ${item.resolution}` : ""} — {item.container?.toUpperCase() || item.mimeType || "fonte detectada"}{item.codec ? ` / ${item.codec}` : ""}</b><span>{item.filename}{item.protected || item.drm ? " · protegido por DRM" : item.kind === "video" && item.hasAudio === false ? " · sem áudio" : ""}</span><small title={item.url}>{siteOf(item.url)}</small></div><div className="media-actions"><button disabled={mediaBusy || item.protected || item.drm} title={item.protected || item.drm ? "Conteúdo protegido por DRM" : item.manifest ? "Baixar o manifesto HLS/DASH" : "Baixar a fonte original"} onClick={() => void downloadDetectedMedia(item, "original")}>{item.manifest ? "Manifesto" : "Original"}</button>{item.kind === "video" && <button disabled={mediaBusy || item.protected || item.drm || !mediaCapabilitiesState?.ffmpeg || !mediaItems.some((x) => x.kind === "audio" && x.pageUrl === item.pageUrl && !x.protected && !x.drm)} title={mediaCapabilitiesState?.ffmpeg ? "Combinar o vídeo com um fluxo de áudio compatível" : "Requer FFmpeg"} onClick={() => void downloadDetectedMedia(item, "merge")}>Vídeo + áudio</button>}<button disabled={mediaBusy || item.protected || item.drm || !mediaCapabilitiesState?.ffmpeg} title={item.protected || item.drm ? "Conteúdo protegido por DRM" : mediaCapabilitiesState?.ffmpeg ? "Converter para MP3" : "Requer FFmpeg"} onClick={() => void downloadDetectedMedia(item, "mp3")}>MP3</button><button disabled={mediaBusy || item.protected || item.drm || !mediaCapabilitiesState?.ffmpeg} title={item.protected || item.drm ? "Conteúdo protegido por DRM" : mediaCapabilitiesState?.ffmpeg ? "Salvar/remuxar como MP4" : "Requer FFmpeg"} onClick={() => void downloadDetectedMedia(item, "mp4")}>MP4</button></div></div>)}</div>
        </>}
      </section>}

      {panel === "ai" && <section className="floating-panel ai-panel no-drag">
        <PanelHead title="✦ MarshMallow AI" subtitle={`Autonomia sob suas permissões · ${aiProvider === "cloudflare-workers-ai" ? "Workers AI" : aiProvider === "gemini" ? "Gemini" : aiProvider === "offline" ? "backend offline" : aiProvider}`} close={() => setPanel(null)} />
        <div className="ai-quick-tools"><button type="button" onClick={() => void locateSoundSource()}><span>♫</span><b>De qual aba vem o som?</b><small>Identifica áudio agora</small></button><button type="button" onClick={() => void reduceTabMemory()}><span>⚡</span><b>Diminuir consumo de RAM</b><small>Suspende todas, exceto a atual</small></button></div>
        <div className="ai-transcript" ref={aiTranscriptRef}>{aiMessages.length === 0 && <p className="panel-copy">Peça para organizar abas por assunto, site, A–Z, fechar duplicadas ou fazer uma pergunta.</p>}{aiMessages.map((m, i) => <div className={`ai-msg ${m.role}`} key={`${m.at}-${i}`}><b>{m.role === "user" ? "Você" : "MarshMallow"}</b><span>{m.text}</span></div>)}</div>
        <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Pergunte algo ou peça para organizar suas abas…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askAI(); } }}/>
        <button className="primary" disabled={aiBusy} onClick={() => void askAI()}>{aiBusy ? "Pensando…" : "Enviar"}</button>
        <div className="permission-box"><b>Permissões</b><Toggle checked={settings.permissions.organizeTabs} text="Organizar e agrupar abas" set={(v) => setSettings((c) => ({ ...c, permissions: { ...c.permissions, organizeTabs: v } }))}/><Toggle checked={settings.permissions.openPages} text="Abrir páginas" set={(v) => setSettings((c) => ({ ...c, permissions: { ...c.permissions, openPages: v } }))}/><Toggle checked={settings.permissions.readCurrentPage} text="Ler página atual quando necessário" set={(v) => setSettings((c) => ({ ...c, permissions: { ...c.permissions, readCurrentPage: v } }))}/><Toggle checked={settings.permissions.autoOrganize} text="Auto-organizar novas abas" set={(v) => setSettings((c) => ({ ...c, permissions: { ...c.permissions, autoOrganize: v } }))}/><label className="select-row"><span>Fechar abas</span><select value={settings.permissions.closeTabs} onChange={(e) => setSettings((c) => ({ ...c, permissions: { ...c.permissions, closeTabs: e.target.value as AiPermissions["closeTabs"] } }))}><option value="ask">Perguntar</option><option value="allow">Permitir</option><option value="deny">Nunca</option></select></label></div>
      </section>}

      {panel === "organizer" && <section className="floating-panel no-drag"><PanelHead title="▦ Organizador" subtitle={`${state.tabs.length} abas abertas`} close={() => setPanel(null)}/><div className="action-grid"><button onClick={() => void sortTabs("alpha")}>A–Z<span>Alfabética</span></button><button onClick={() => void sortTabs("site")}>◎<span>Por site</span></button><button onClick={() => void sortTabs("recent")}>◷<span>Uso recente</span></button><button onClick={() => void organizeBySubject()}>▦<span>Por assunto</span></button><button onClick={() => void closeDuplicates()}>≋<span>Duplicadas</span></button><button disabled={!undoSnapshot} onClick={() => void undoOrganization()}>↶<span>Desfazer</span></button></div><div className="group-list"><h3>Grupos</h3>{groupedCounts.map(([name, count]) => <div key={name}><span>{name}</span><b>{count}</b></div>)}</div>{aiLog.length > 0 && <details className="ai-log"><summary>O que a IA fez</summary>{aiLog.slice(0, 15).map((line, i) => <p key={i}>{line}</p>)}</details>}</section>}

      {toast && <div className="browser-toast no-drag">{toast}</div>}
    </div>
  );
}


function SupportPage({ showToast }: { showToast: (message:string) => void }) {
  const links = [
    { name:"APOIA.se", url:"https://apoia.se/marshmallow-browser", copy:"Apoio recorrente e comunidade no Brasil." },
    { name:"Ko-fi", url:"https://ko-fi.com/marshmallowbrowser", copy:"Apoio internacional rápido e opcional." },
    { name:"Buy Me a Coffee", url:"https://buymeacoffee.com/marshmallowbrowser", copy:"Contribuições internacionais para o desenvolvimento." },
  ];
  return <div className="internal-page support-page"><div className="internal-page-head"><div><span className="eyebrow">Software independente</span><h1>Apoie o MarshMallow ♡</h1><p>Seu apoio mantém o MarshMallow independente, vivo e evoluindo. Nenhuma destas opções é obrigatória.</p></div></div><div className="support-grid">{links.map((item)=><article key={item.url}><div><b>{item.name}</b><span>{item.copy}</span></div><button onClick={() => void window.marshmallow.browser.openSupportUrl(item.url).then((r)=>{if(!r.ok)showToast(r.error||"Não foi possível abrir o link.")})}>Abrir</button></article>)}</div><p className="settings-note">Sem pop-ups, badges ou lembretes automáticos. Os links aparecem somente quando você abre esta página.</p><p className="settings-note"><b>Criador e desenvolvedor:</b> Deivison Santos · @devsaex</p></div>;
}

function PerformancePage() {
  const [data,setData]=useState<PerformanceDiagnostics|null>(null);
  useEffect(()=>{let live=true; const load=()=>void window.marshmallow.browser.getPerformanceDiagnostics().then((x)=>{if(live)setData(x)}).catch(()=>undefined);load();const timer=window.setInterval(load,3000);return()=>{live=false;clearInterval(timer)}},[]);
  const status=(key:string)=>String(data?.featureStatus?.[key]||"unknown");
  return <div className="internal-page performance-page"><div className="internal-page-head"><div><span className="eyebrow">Diagnóstico factual</span><h1>Desempenho</h1><p>Estado real reportado pelo Electron/Chromium. “Software” e “desativado” não são apresentados como aceleração.</p></div><span className="settings-version">{data?.version||"5.0.2"}</span></div>{!data?<div className="settings-note">Coletando informações da GPU…</div>:<><div className="performance-grid"><div><span>GPU Compositing</span><b>{status("gpu_compositing")}</b></div><div><span>WebGL</span><b>{status("webgl")}</b></div><div><span>WebGL2</span><b>{status("webgl2")}</b></div><div><span>Rasterização</span><b>{status("rasterization")}</b></div><div><span>Modo Jogo</span><b>{data.gameMode.active?"Ativo":"Inativo"}</b></div><div><span>Segundo plano</span><b>{data.backgroundPolicy.continuous?"Execução contínua":"Throttling normal"}</b></div><div><span>Gamepad API</span><b>{data.gamepadAvailable?"Disponível":"Indisponível"}</b></div></div><details className="performance-details"><summary>Informações da GPU</summary><pre>{JSON.stringify(data.gpuInfo,null,2)}</pre></details></>}</div>;
}

function UpdateStatus() {
  const [state,setState]=useState<UpdateState|null>(null); const [busy,setBusy]=useState(false);
  async function check(){setBusy(true);try{setState(await window.marshmallow.browser.checkUpdate())}finally{setBusy(false)}}
  async function download(){setBusy(true);try{const r=await window.marshmallow.browser.downloadUpdate();if(!r.ok&&!r.canceled)window.alert(r.error||"Falha ao baixar atualização.");else if(r.verified)window.alert(`Instalador verificado por SHA-256 e salvo em:\n${r.path}`)}finally{setBusy(false)}}
  useEffect(()=>{void check()},[]);
  return <div className="update-status"><div><b>{state?.available?`Nova versão: ${state.version}`:state?.ok?"Você está atualizado":"Não foi possível verificar agora"}</b><span>{state?.available?"O download é opcional e será validado pelo SHA-256 publicado.":state?.message||state?.error||`Versão instalada: ${state?.currentVersion||"5.0.2"}`}</span>{state?.sha256&&<small>SHA-256: {state.sha256}</small>}</div><div className="update-actions"><button disabled={busy} onClick={()=>void check()}>Verificar</button>{state?.available&&<button disabled={busy} onClick={()=>void download()}>Baixar atualização</button>}</div></div>;
}

function ExtensionsPage({ showToast }: { showToast: (message: string) => void }) {
  const [manager, setManager] = useState<ExtensionManagerState | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setManager(await window.marshmallow.browser.listExtensions()); }
    catch (error) { showToast(String((error as Error)?.message || error)); }
  }

  useEffect(() => { void refresh(); }, []);

  async function action(run: () => Promise<any>, success?: string) {
    setBusy(true);
    try {
      const result = await run();
      if (result?.state) setManager(result.state);
      else await refresh();
      if (!result?.ok && !result?.canceled) showToast(result?.error || "A operação falhou.");
      else if (result?.ok && success) showToast(success);
    } catch (error) {
      showToast(String((error as Error)?.message || error));
    } finally { setBusy(false); }
  }

  if (!manager) return <div className="internal-page settings-page"><div className="internal-page-head"><div><span className="eyebrow">Chromium Extensions</span><h1>Extensões</h1><p>Carregando gerenciador…</p></div></div></div>;

  return <div className="internal-page extensions-page">
    <div className="internal-page-head"><div><span className="eyebrow">Chromium Extensions</span><h1>Extensões</h1><p>Gerencie extensões compatíveis e use o Modo desenvolvedor para pacotes e fontes externas.</p></div><span className="settings-version">{manager.items.length} instalada{manager.items.length === 1 ? "" : "s"}</span></div>
    <div className="extensions-warning"><b>Compatibilidade realista</b><span>{manager.electronApiNotice}</span><small>APIs atualmente expostas pelo Electron: {manager.supportedApis.join(", ")}.</small></div>
    <div className="extensions-devbar">
      <Toggle checked={manager.developerMode} text="Modo desenvolvedor" set={(value) => void action(async () => ({ ok: true, state: await window.marshmallow.browser.setExtensionSettings({ developerMode: value }) }))} />
      <Toggle checked={manager.allowExternalSources} text="Permitir fontes externas HTTPS" set={(value) => void action(async () => ({ ok: true, state: await window.marshmallow.browser.setExtensionSettings({ allowExternalSources: value }) }))} />
    </div>
    <div className="extensions-install-grid">
      <button disabled={busy || !manager.developerMode} onClick={() => void action(() => window.marshmallow.browser.loadUnpackedExtension(), "Extensão carregada.")}>Carregar descompactada</button>
      <button disabled={busy || !manager.developerMode} onClick={() => void action(() => window.marshmallow.browser.installExtensionArchive(), "Extensão instalada.")}>Instalar ZIP / CRX</button>
      <div className="extensions-url-install"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Chrome Web Store ou URL HTTPS de ZIP/CRX"/><button disabled={busy || !url.trim()} onClick={() => void action(() => window.marshmallow.browser.installExtensionUrl(url.trim()), "Extensão instalada.")}>Instalar</button></div>
    </div>
    <div className="extension-list">{manager.items.length === 0 ? <div className="extension-empty"><b>Nenhuma extensão instalada</b><span>Use a Chrome Web Store ou ative o Modo desenvolvedor.</span></div> : manager.items.map((item) => <article className={`extension-card ${item.enabled ? "" : "disabled"}`} key={item.installId}>
      <div className="extension-card-head"><div><b>{item.name}</b><span>v{item.version || "?"} · Manifest V{item.manifestVersion || "?"}</span></div><label className="extension-switch"><input type="checkbox" checked={item.enabled} disabled={busy} onChange={(event) => void action(() => window.marshmallow.browser.setExtensionEnabled(item.installId, event.target.checked))}/><span>{item.enabled ? "Ativa" : "Desativada"}</span></label></div>
      {item.description && <p>{item.description}</p>}
      <div className={`extension-compat ${item.compatibility.level}`}><b>{item.compatibility.level === "good" ? "Compatibilidade boa" : item.compatibility.level === "partial" ? "Compatibilidade parcial" : "Incompatível"}</b>{item.lastError && <span>{item.lastError}</span>}{item.compatibility.issues.map((text, index) => <span key={`i-${index}`}>{text}</span>)}{item.compatibility.warnings.map((text, index) => <small key={`w-${index}`}>{text}</small>)}</div>
      <details><summary>Permissões e origem</summary><small><b>Permissões:</b> {item.permissions.length ? item.permissions.join(", ") : "nenhuma declarada"}</small><small><b>Hosts:</b> {item.hostPermissions.length ? item.hostPermissions.join(", ") : "nenhum"}</small><small><b>Origem:</b> {item.source}</small><small><b>ID:</b> {item.runtimeId || item.installId}</small></details>
      <div className="extension-actions"><button disabled={busy} onClick={() => void action(() => window.marshmallow.browser.reloadExtension(item.installId), "Extensão recarregada.")}>Recarregar</button><button disabled={busy} onClick={() => void window.marshmallow.browser.openExtensionFolder(item.installId)}>Abrir pasta</button><button disabled={busy || !manager.developerMode} onClick={() => void action(() => window.marshmallow.browser.packExtension(item.installId), "Pacote criado.")}>Empacotar</button><label><input type="checkbox" checked={item.allowFileAccess} disabled={busy} onChange={(event) => void action(() => window.marshmallow.browser.setExtensionFileAccess(item.installId, event.target.checked))}/>Acesso a file://</label><button className="danger" disabled={busy} onClick={() => { if (confirm(`Remover ${item.name}?`)) void action(() => window.marshmallow.browser.removeExtension(item.installId), "Extensão removida."); }}>Remover</button></div>
    </article>)}</div>
  </div>;
}

type SettingsCategory = "profile" | "startup" | "appearance" | "search" | "tabs" | "privacy" | "cookies" | "permissions" | "downloads" | "languages" | "performance" | "system" | "compatibility" | "ai" | "watch" | "advanced" | "about";

const SETTINGS_CATEGORIES: Array<{ id: SettingsCategory; icon: string; label: string; keywords: string }> = [
  { id: "profile", icon: "●", label: "Perfil", keywords: "conta perfil usuário login sincronização" },
  { id: "startup", icon: "⌂", label: "Inicialização", keywords: "iniciar startup página inicial home nova guia restaurar sessão" },
  { id: "appearance", icon: "◈", label: "Aparência", keywords: "aparência tema fonte zoom interface animação imagem abas laterais" },
  { id: "search", icon: "⌕", label: "Pesquisa", keywords: "pesquisa mecanismo buscador brave google bing duckduckgo ecosia" },
  { id: "tabs", icon: "▤", label: "Abas e navegação", keywords: "abas popup pop-up janela autoplay reprodução navegação" },
  { id: "privacy", icon: "◐", label: "Privacidade e segurança", keywords: "privacidade segurança dnt gpc limpar cookies cache webrtc rastreamento" },
  { id: "cookies", icon: "◌", label: "Cookies e dados", keywords: "cookies sessão login salvar importar exportar backup dados sites armazenamento" },
  { id: "permissions", icon: "◉", label: "Permissões de sites", keywords: "câmera microfone localização notificações clipboard midi tela cheia permissões" },
  { id: "downloads", icon: "↓", label: "Downloads", keywords: "download baixar salvar pasta perguntar" },
  { id: "languages", icon: "文", label: "Idiomas", keywords: "idioma linguagem corretor ortográfico spellcheck tradução português" },
  { id: "performance", icon: "↯", label: "Desempenho", keywords: "desempenho memória energia aceleração hardware gpu throttling segundo plano" },
  { id: "system", icon: "⚙", label: "Sistema e rede", keywords: "sistema rede proxy navegador padrão windows conexão" },
  { id: "compatibility", icon: "◎", label: "Compatibilidade", keywords: "google login autenticação oauth edge chrome navegador nativo compatibilidade conta" },
  { id: "ai", icon: "✦", label: "MarshMallow AI", keywords: "ia inteligência artificial permissão organizar abas abrir páginas" },
  { id: "watch", icon: "🔥", label: "Watch Together", keywords: "watch together chat nome balão transmissão" },
  { id: "advanced", icon: "◇", label: "Avançado", keywords: "avançado devtools dados extensões senhas autofill certificados dns https sync" },
  { id: "about", icon: "ⓘ", label: "Sobre", keywords: "sobre versão atualização chromium electron marshmallow" },
];

function normalizeSettingSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function WallpaperChoices({ settings, update, onWallpaper, close, compact = false }: { settings: Settings; update: (patch: Partial<Settings>) => void; onWallpaper(file?: File): void; close?: () => void; compact?: boolean }) {
  const pool = wallpaperPool(settings.wallpaperCollection);
  const gallery = useMemo(() => shuffledWallpapers(pool), [settings.wallpaperCollection]);
  const selected = WALLPAPER_PRESETS.find((item) => settings.wallpaperMode === "fixed" && item.src === settings.customWallpaper);
  const randomNow = () => {
    const choice = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
    if (choice) update({ customWallpaper: choice.src, wallpaperMode: "fixed" });
  };
  return <div className={`wallpaper-choice-panel ${compact ? "compact" : ""}`}>
    <div className="wallpaper-choice-head"><div><b>Personalizar nova aba</b><span>Fotografia, coleção offline, imagem própria ou rotação automática.</span></div>{close && <button type="button" onClick={close}>×</button>}</div>
    <div className="wallpaper-mode-grid">
      <button type="button" className={settings.wallpaperMode === "none" ? "selected" : ""} onClick={() => update({ wallpaperMode: "none" })}><b>Sem imagem</b><small>Nova aba limpa</small></button>
      <button type="button" className={settings.wallpaperMode === "shuffle" ? "selected" : ""} onClick={() => update({ wallpaperMode: "shuffle" })}><b>Surpreenda-me</b><small>Troca a cada nova aba</small></button>
      <button type="button" className={settings.wallpaperMode === "daily" ? "selected" : ""} onClick={() => update({ wallpaperMode: "daily" })}><b>Imagem do dia</b><small>Uma imagem por dia</small></button>
    </div>
    <div className="wallpaper-collection-tabs" role="tablist" aria-label="Coleção de wallpapers">
      <button type="button" className={settings.wallpaperCollection === "photographic" ? "selected" : ""} onClick={() => update({ wallpaperCollection: "photographic" })}>Fotográfico <span>online</span></button>
      <button type="button" className={settings.wallpaperCollection === "studio" ? "selected" : ""} onClick={() => update({ wallpaperCollection: "studio" })}>MarshMallow Studio <span>offline</span></button>
    </div>
    {settings.wallpaperCollection === "photographic" && <p className="wallpaper-online-note">Coleção curada de fotografias em alta resolução. As imagens são carregadas da Unsplash somente quando esta coleção é usada.</p>}
    <div className="wallpaper-suggestion-grid premium">
      {gallery.map((item) => <button key={item.id} className={selected?.id === item.id ? "selected" : ""} title={`${item.name}${item.author ? ` — ${item.author}` : ""}`} type="button" onClick={() => update({ customWallpaper: item.src, wallpaperMode: "fixed", wallpaperCollection: item.collection })}><span style={{ backgroundImage: `url("${wallpaperThumbnail(item)}")` }}/><b>{item.name}</b>{item.author && <small>{item.author}</small>}</button>)}
    </div>
    <div className="wallpaper-choice-actions">
      <button type="button" onClick={randomNow}>Escolher uma aleatória agora</button>
      <label><span>Usar imagem do computador</span><input type="file" accept="image/*" onChange={(e) => { onWallpaper(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label>
      {settings.wallpaperMode !== "none" && <button className="remove" type="button" onClick={() => update({ wallpaperMode: "none" })}>Desativar wallpaper</button>}
    </div>
  </div>;
}

function resolveNewTabWallpaper(settings: Settings, shuffleNonce: number) {
  if (settings.wallpaperMode === "none") return undefined;
  if (settings.wallpaperMode === "fixed") {
    if (!settings.customWallpaper) return undefined;
    return WALLPAPER_PRESETS.find((item) => item.src === settings.customWallpaper) || { id: "custom", name: "Wallpaper personalizado", src: settings.customWallpaper, collection: settings.wallpaperCollection } as WallpaperPreset;
  }
  const pool = wallpaperPool(settings.wallpaperCollection);
  if (!pool.length) return undefined;
  if (settings.wallpaperMode === "daily") return pool[deterministicDailyIndex(pool.length)];
  const seed = Math.abs(Math.floor(shuffleNonce * 1_000_000));
  return pool[seed % pool.length];
}

function NewTabPage({ settings, onWallpaper, onWallpaperAction, update, openThemes, openPdf, privateMode, isWindows }: { settings: Settings; onWallpaper(file?: File): void; onWallpaperAction(action: "download" | "desktop" | "lockscreen", source: string, name?: string): void; update: (patch: Partial<Settings>) => void; openThemes(): void; openPdf(): void; privateMode: boolean; isWindows: boolean }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shuffleNonce, setShuffleNonce] = useState(() => Math.random());
  const wallpaper = useMemo(() => resolveNewTabWallpaper(settings, shuffleNonce), [settings.wallpaperMode, settings.wallpaperCollection, settings.customWallpaper, shuffleNonce]);
  const fallback = useMemo(() => STUDIO_WALLPAPERS[Math.floor(shuffleNonce * STUDIO_WALLPAPERS.length) % STUDIO_WALLPAPERS.length], [shuffleNonce]);
  const [wallpaperSrc, setWallpaperSrc] = useState(wallpaper?.src || "");
  useEffect(() => { setWallpaperSrc(wallpaper?.src || ""); }, [wallpaper?.src]);
  const hasWallpaper = Boolean(wallpaperSrc && settings.wallpaperMode !== "none");
  const wallpaperOpacity = Math.max(0.54, Math.min(1, settings.wallpaperOpacity / 100));
  const reroll = () => setShuffleNonce(Math.random());

  return (
    <div className={`newtab-page ${hasWallpaper ? "has-wallpaper" : "no-wallpaper"} ${privateMode ? "private-newtab" : ""}`}>
      {hasWallpaper && <img className="newtab-wallpaper" src={wallpaperSrc} alt="" draggable={false} style={{ opacity: wallpaperOpacity, filter: `blur(${settings.wallpaperBlur}px)` }} onError={() => { if (wallpaper?.online && fallback) setWallpaperSrc(fallback.src); else setWallpaperSrc(""); }}/>} 
      <div className="newtab-shade"/>
      {privateMode && <div className="newtab-private-badge">◐ Aba privada</div>}
      {!privateMode && !hasWallpaper && !pickerOpen && <aside className="newtab-personalize-card">
        <span className="newtab-personalize-icon">◈</span>
        <div className="newtab-personalize-copy"><b>Deixe o MarshMallow com a sua cara</b><span>Escolha uma fotografia, use sua própria imagem ou deixe o fundo mudar automaticamente.</span></div>
        <button className="newtab-wallpaper-action" type="button" onClick={() => { update({ wallpaperMode: "shuffle", wallpaperCollection: "photographic" }); reroll(); }}>Experimentar aleatórios</button>
        <button className="newtab-themes-action" type="button" onClick={() => setPickerOpen(true)}>Personalizar</button>
      </aside>}
      {!privateMode && pickerOpen && <div className="newtab-wallpaper-picker"><WallpaperChoices settings={settings} update={update} onWallpaper={onWallpaper} close={() => setPickerOpen(false)} compact/></div>}
      {!privateMode && hasWallpaper && !pickerOpen && <div className="newtab-wallpaper-controls">
        {settings.wallpaperMode === "shuffle" && <button type="button" onClick={reroll}>↻ Outra imagem</button>}
        <button type="button" onClick={() => void onWallpaperAction("download", wallpaperSrc, wallpaper?.name || "MarshMallow Wallpaper")}>↓ Baixar</button>
        {isWindows && <>
          <button type="button" title="Usar este wallpaper na área de trabalho do Windows" onClick={() => void onWallpaperAction("desktop", wallpaperSrc, wallpaper?.name || "MarshMallow Wallpaper")}>▣ Windows</button>
          <button type="button" title="Usar este wallpaper na tela de bloqueio do Windows" onClick={() => void onWallpaperAction("lockscreen", wallpaperSrc, wallpaper?.name || "MarshMallow Wallpaper")}>▱ Bloqueio</button>
        </>}
        <button type="button" onClick={() => setPickerOpen(true)}>◈ Personalizar</button>
      </div>}
      {!privateMode && hasWallpaper && wallpaper?.online && wallpaperSrc === wallpaper.src && <div className="newtab-photo-credit">Foto: {wallpaper.author || "Unsplash"} · Unsplash</div>}
      {!privateMode && !hasWallpaper && !pickerOpen && <button className="newtab-themes-link" type="button" onClick={openThemes}>Ver temas</button>}
      {!privateMode && <button className="newtab-pdf-button" type="button" title="Abrir PDF Reader" onClick={openPdf}><b>PDF</b><span>Reader</span></button>}
    </div>
  );
}

function InternalPageHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return <header className="internal-page-header"><span className="internal-page-badge">{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></header>;
}

function LibraryPage({ bookmarks, history, openUrl, removeBookmark, clearHistory }: {
  bookmarks: Bookmark[]; history: HistoryEntry[]; openUrl: (url: string) => void; removeBookmark: (url: string) => void; clearHistory: () => void;
}) {
  const [section, setSection] = useState<"bookmarks" | "history">("bookmarks");
  const [query, setQuery] = useState("");
  const q = normalizeText(query.trim());
  const filteredBookmarks = bookmarks.filter((item) => !q || normalizeText(`${item.title} ${item.url}`).includes(q));
  const filteredHistory = history.filter((item) => !q || normalizeText(`${item.title} ${item.url}`).includes(q));
  return <section className="internal-page no-drag">
    <InternalPageHeader icon="★" title="Favoritos e histórico" subtitle="Sua biblioteca local do MarshMallow"/>
    <div className="internal-page-toolbar"><div className="internal-segment"><button className={section === "bookmarks" ? "active" : ""} onClick={() => setSection("bookmarks")}>Favoritos <span>{bookmarks.length}</span></button><button className={section === "history" ? "active" : ""} onClick={() => setSection("history")}>Histórico <span>{history.length}</span></button></div><label className="internal-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar favoritos e histórico"/></label></div>
    <div className="internal-page-scroll">
      {section === "bookmarks" ? <div className="library-page-list">
        {filteredBookmarks.length === 0 && <div className="internal-empty"><b>{bookmarks.length ? "Nenhum favorito encontrado" : "Nenhum favorito ainda"}</b><span>{bookmarks.length ? "Tente outra pesquisa." : "Use ☆ na barra de endereço para salvar uma página."}</span></div>}
        {filteredBookmarks.map((item) => <article className="library-page-row" key={item.url}><button className="library-page-main" onClick={() => openUrl(item.url)}><span className="library-page-icon">★</span><div><b>{item.title}</b><small>{item.url}</small></div></button><button className="library-page-remove" title="Remover dos favoritos" onClick={() => removeBookmark(item.url)}>×</button></article>)}
      </div> : <div className="library-page-list">
        <div className="history-page-actions"><span>{filteredHistory.length} item(ns)</span><button disabled={!history.length} onClick={clearHistory}>Limpar histórico</button></div>
        {filteredHistory.length === 0 && <div className="internal-empty"><b>{history.length ? "Nenhum item encontrado" : "Seu histórico está vazio"}</b><span>{history.length ? "Tente outra pesquisa." : "As páginas visitadas aparecerão aqui."}</span></div>}
        {filteredHistory.map((item) => <article className="library-page-row history-page-row" key={`${item.url}-${item.at}`}><button className="library-page-main" onClick={() => openUrl(item.url)}><span className="library-page-icon">◷</span><div><b>{item.title}</b><small>{friendlyTime(item.at)} · {item.url}</small></div></button></article>)}
      </div>}
    </div>
  </section>;
}

function ThemesPage({ settings, update, onWallpaper }: { settings: Settings; update: (patch: Partial<Settings>) => void; onWallpaper: (file?: File) => void }) {
  return <section className="internal-page no-drag">
    <InternalPageHeader icon="◈" title="Temas" subtitle="Personalize o MarshMallow sem cobrir a página atual"/>
    <div className="internal-page-scroll themes-page-scroll">
      <section className="themes-page-section"><h2>Tema do navegador</h2><p>Escolha a identidade visual da interface.</p><div className="theme-grid theme-grid-page">{THEMES.map((theme) => <button key={theme.id} className={settings.theme === theme.id ? "selected" : ""} data-preview={theme.id} onClick={() => update({ theme: theme.id })}><span>{theme.glyph}</span><b>{theme.name}</b><small>{theme.description}</small></button>)}</div></section>
      <section className="themes-page-section"><h2>Wallpaper</h2><p>Uma nova aba limpa, com opção de fotografia em alta resolução, rotação aleatória, imagem diária, coleção offline ou imagem própria.</p><WallpaperChoices settings={settings} update={update} onWallpaper={onWallpaper}/><label className="range-row"><span>Intensidade <b>{settings.wallpaperOpacity}%</b></span><input type="range" min="45" max="100" value={settings.wallpaperOpacity} onChange={(e) => update({ wallpaperOpacity: Number(e.target.value) })}/></label><label className="range-row"><span>Desfoque <b>{settings.wallpaperBlur}px</b></span><input type="range" min="0" max="18" value={settings.wallpaperBlur} onChange={(e) => update({ wallpaperBlur: Number(e.target.value) })}/></label></section>
    </div>
  </section>;
}

function DownloaderManagerSettings({ preferences, updatePreferences, isWindows }: { preferences: BrowserPreferences; updatePreferences: (patch: Partial<BrowserPreferences>) => void; isWindows: boolean }) {
  const [manager, setManager] = useState<DownloaderManagerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isWindows) return;
    let alive = true;
    void window.marshmallow.browser.getDownloaderManager().then((state) => {
      if (alive) setManager(state);
    }).catch((error) => {
      if (alive) setMessage(String((error as Error)?.message || error || "Não foi possível consultar a integração."));
    });
    return () => { alive = false; };
  }, [isWindows]);

  async function refreshDownloaderManager() {
    setBusy(true);
    setMessage("");
    try {
      const state = await window.marshmallow.browser.refreshDownloaderManager();
      setManager(state);
      if (!state.available) setMessage(state.error || "Em desenvolvimento. O gerenciador integrado continua disponível normalmente.");
    } catch (error) {
      setMessage(String((error as Error)?.message || error || "Não foi possível verificar a disponibilidade."));
    } finally {
      setBusy(false);
    }
  }

  async function installDownloaderManager() {
    setBusy(true);
    setMessage("");
    try {
      const result = await window.marshmallow.browser.openDownloaderManagerInstaller();
      if (!result.ok) {
        setMessage(result.error || "O MarshMallow Downloader Manager ainda não está disponível.");
        return;
      }
      setMessage(`Instalador oficial ${result.version || ""} aberto. Após instalar, escolha “MarshMallow Downloader Manager” abaixo.`.trim());
    } catch (error) {
      setMessage(String((error as Error)?.message || error || "Não foi possível abrir o instalador."));
    } finally {
      setBusy(false);
    }
  }

  const externalAvailable = Boolean(isWindows && manager?.ok && manager.available && manager.url);

  if (!isWindows) return <div className="downloader-manager-card">
    <div className="downloader-manager-head"><div><b>Gerenciador de downloads</b><small>No Linux, o gerenciador integrado do MarshMallow é usado para todos os downloads.</small></div><span className="available">Integrado</span></div>
    <div className="download-manager-options"><button className="download-manager-option active" onClick={() => updatePreferences({ downloadManagerMode:"builtin" })}><b>Gerenciador integrado</b><small>Compatível com Linux: histórico, progresso, pausar, continuar e cancelar.</small></button></div>
    {preferences.downloadManagerMode === "external" && <div className="download-manager-warning"><b>Integração externa indisponível no Linux</b><span>O aplicativo independente atual usa instalador Windows. O MarshMallow continuará usando o gerenciador integrado.</span><button onClick={() => updatePreferences({ downloadManagerMode:"builtin" })}>Usar gerenciador integrado</button></div>}
  </div>;

  return <div className="downloader-manager-card">
    <div className="downloader-manager-head">
      <div><b>Gerenciador de downloads</b><small>O MarshMallow funciona sozinho. O Downloader Manager é uma integração opcional.</small></div>
      <span className={externalAvailable ? "available" : "development"}>{externalAvailable ? `Disponível ${manager?.version || ""}`.trim() : "Em desenvolvimento"}</span>
    </div>
    <div className="download-manager-options">
      <button className={`download-manager-option ${preferences.downloadManagerMode === "builtin" ? "active" : ""}`} onClick={() => updatePreferences({ downloadManagerMode:"builtin" })}>
        <b>Gerenciador integrado</b><small>Padrão do MarshMallow. Baixa arquivos normalmente e mantém histórico, progresso, pausar, continuar e cancelar.</small>
      </button>
      <button className={`download-manager-option ${preferences.downloadManagerMode === "external" ? "active" : ""}`} disabled={!externalAvailable} onClick={() => updatePreferences({ downloadManagerMode:"external" })}>
        <b>MarshMallow Downloader Manager</b><small>{externalAvailable ? "Enviar novos downloads ao aplicativo independente por integração nativa." : "Será opcional quando o instalador oficial estiver disponível."}</small>
      </button>
    </div>
    {preferences.downloadManagerMode === "external" && !externalAvailable && <div className="download-manager-warning"><b>Integração indisponível</b><span>Novos downloads continuarão seguros no gerenciador integrado. Você pode restaurá-lo como padrão abaixo.</span><button onClick={() => updatePreferences({ downloadManagerMode:"builtin" })}>Usar gerenciador integrado</button></div>}
    <div className="download-manager-actions">
      <button disabled={busy} onClick={() => void refreshDownloaderManager()}>{busy ? "Verificando…" : "Verificar disponibilidade"}</button>
      {externalAvailable && <button disabled={busy} onClick={() => void installDownloaderManager()}>Baixar e integrar Downloader Manager</button>}
    </div>
    {message && <p className="download-manager-message">{message}</p>}
    <small className="download-manager-note">Por privacidade, downloads em janela privada permanecem no gerenciador integrado e nunca são encaminhados automaticamente a um aplicativo externo.</small>
  </div>;
}

function SettingsCenter({
  version, account, settings, preferences, restartRequired, embedded = false, logout, updateUi, updatePreferences, updatePermission,
  chooseDownloadFolder, clearBrowsingData, openDownloadsFolder, isWindows, openDefaultApps, reopenTab, openDevTools, newPrivateTab, onWallpaper,
}: {
  version: string;
  account: AccountProfile;
  settings: Settings;
  preferences: BrowserPreferences;
  restartRequired: boolean;
  embedded?: boolean;
  logout: () => void;
  updateUi: (patch: Partial<Settings>) => void;
  updatePreferences: (patch: Partial<BrowserPreferences>) => void;
  updatePermission: (name: keyof BrowserPreferences["permissionDefaults"], value: PermissionMode) => void;
  chooseDownloadFolder: () => void;
  clearBrowsingData: () => void;
  openDownloadsFolder: () => void;
  isWindows: boolean;
  openDefaultApps: () => void;
  reopenTab: () => void;
  openDevTools: () => void;
  newPrivateTab: () => void;
  onWallpaper: (file?: File) => void;
}) {
  const [category, setCategory] = useState<SettingsCategory>("profile");
  const [query, setQuery] = useState("");
  const [popupSiteDraft, setPopupSiteDraft] = useState("");
  const search = normalizeSettingSearch(query);
  const visible = (id: SettingsCategory, keywords: string) => !search ? category === id : normalizeSettingSearch(`${SETTINGS_CATEGORIES.find((item) => item.id === id)?.label || ""} ${keywords}`).includes(search);
  const permissionOptions = <><option value="ask">Perguntar</option><option value="allow">Permitir</option><option value="block">Bloquear</option></>;

  return <section className={`${embedded ? "settings-center settings-center-page" : "floating-panel settings-center"} no-drag`}>
    <div className="settings-topbar">
      <div><b>⚙ Configurações</b><small>MarshMallow {version}</small></div>
      <label className="settings-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar configurações"/></label>
      <span className="settings-close-placeholder"/>
    </div>
    {restartRequired && <div className="settings-restart">Algumas alterações (hardware, fontes padrão ou autoplay) entram completamente em vigor após reiniciar o MarshMallow.</div>}
    <div className="settings-layout">
      <nav className="settings-nav">
        {SETTINGS_CATEGORIES.map((item) => <button key={item.id} className={!search && category === item.id ? "active" : ""} onClick={() => { setCategory(item.id); setQuery(""); }}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="settings-content">
        {search && <div className="settings-search-caption">Resultados para <b>“{query}”</b></div>}

        {visible("profile", "conta perfil nome usuário login sair") && <SettingsSection title="Perfil" description="Conta local do MarshMallow e identidade no navegador.">
          <div className="account-summary settings-account"><span className="account-avatar">{(account.displayName || account.username).slice(0, 1).toUpperCase()}</span><div><b>{account.displayName}</b><small>@{account.username}</small></div><button onClick={logout}>Sair</button></div>
          <div className="settings-info-grid"><div><span>Provedor</span><b>{account.provider === "google" ? "Google" : account.provider === "microsoft" ? "Microsoft" : "Conta local"}</b></div><div><span>Perfil criado</span><b>{account.createdAt ? new Date(account.createdAt).toLocaleDateString("pt-BR") : "—"}</b></div></div>
          <p className="settings-note">Sincronização entre dispositivos, perfis múltiplos e importação de dados terão uma camada própria. Esta tela já reserva a arquitetura para esses módulos.</p>
        </SettingsSection>}

        {visible("startup", "inicialização startup restaurar sessão continuar manter abas abertas reiniciar home página inicial nova guia páginas específicas") && <SettingsSection title="Inicialização, página inicial e nova guia" description="Controle o que abre quando o navegador inicia e quando você cria uma aba.">
          <Toggle checked={preferences.startupMode === "continue"} text="Manter as abas abertas para usá-las após reiniciar o MarshMallow" set={(v) => updatePreferences({ startupMode: v ? "continue" : "newtab" })}/>
          {preferences.startupMode === "continue" ? <p className="settings-note">As abas normais abertas são salvas localmente e restauradas na próxima inicialização. Abas privadas nunca são salvas. A sessão também é atualizada durante o uso para melhorar a recuperação após travamentos.</p> : <label className="setting-control"><span><b>Quando a restauração estiver desativada</b><small>Escolha o que abrir ao iniciar.</small></span><select value={preferences.startupMode} onChange={(e) => updatePreferences({ startupMode: e.target.value as BrowserPreferences["startupMode"] })}><option value="newtab">Abrir nova guia</option><option value="home">Abrir página inicial</option><option value="custom">Abrir páginas específicas</option></select></label>}
          {preferences.startupMode === "custom" && <label className="setting-field"><span>Páginas de inicialização <small>Uma URL por linha, até 12 páginas.</small></span><textarea rows={4} value={preferences.startupPages.join("\n")} onChange={(e) => updatePreferences({ startupPages: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) })}/></label>}
          <Toggle checked={preferences.showHomeButton} text="Mostrar botão Página inicial na barra" set={(v) => updatePreferences({ showHomeButton: v })}/><label className="setting-field"><span>Página inicial</span><input value={preferences.homePage} onChange={(e) => updatePreferences({ homePage: e.target.value })}/></label>
          <label className="setting-field"><span>Página da nova guia</span><input value={preferences.newTabPage} onChange={(e) => updatePreferences({ newTabPage: e.target.value })}/></label>
        </SettingsSection>}

        {visible("appearance", "aparência tema wallpaper papel de parede remover trocar abas laterais fonte interface zoom página tamanho fonte animação gif imagens") && <SettingsSection title="Aparência" description="Tamanho, leitura e comportamento visual do navegador.">
          <Toggle checked={settings.compactTabs} text="Abas laterais compactas" set={(v) => updateUi({ compactTabs: v })}/>
          <div className="settings-wallpaper-quick"><div><b>Wallpaper da nova aba</b><small>{settings.wallpaperMode === "none" ? "Desativado — a nova aba fica limpa." : settings.wallpaperMode === "shuffle" ? `Aleatório a cada nova aba · ${settings.wallpaperCollection === "photographic" ? "Fotográfico" : "Studio"}` : settings.wallpaperMode === "daily" ? `Imagem do dia · ${settings.wallpaperCollection === "photographic" ? "Fotográfico" : "Studio"}` : "Imagem fixa selecionada."}</small></div><label><span>Usar imagem própria</span><input type="file" accept="image/*" onChange={(e) => { onWallpaper(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label>{settings.wallpaperMode !== "none" && <button type="button" onClick={() => updateUi({ wallpaperMode: "none" })}>Desativar</button>}</div>
          <label className="range-row settings-range"><span>Tamanho da interface <b>{settings.interfaceFontScale}%</b></span><input type="range" min="100" max="160" step="5" value={settings.interfaceFontScale} onChange={(e) => updateUi({ interfaceFontScale: Number(e.target.value) })}/></label>
          <label className="range-row settings-range"><span>Zoom padrão das páginas <b>{preferences.defaultPageZoom}%</b></span><input type="range" min="50" max="200" step="5" value={preferences.defaultPageZoom} onChange={(e) => updatePreferences({ defaultPageZoom: Number(e.target.value) })}/></label>
          <div className="settings-two"><label className="setting-field"><span>Fonte padrão dos sites</span><input type="number" min="10" max="28" value={preferences.defaultFontSize} onChange={(e) => updatePreferences({ defaultFontSize: Number(e.target.value) })}/></label><label className="setting-field"><span>Fonte mínima</span><input type="number" min="0" max="24" value={preferences.minimumFontSize} onChange={(e) => updatePreferences({ minimumFontSize: Number(e.target.value) })}/></label></div>
          <label className="setting-control"><span><b>Animações de imagens/GIFs</b><small>Útil também como opção de acessibilidade.</small></span><select value={preferences.imageAnimationPolicy} onChange={(e) => updatePreferences({ imageAnimationPolicy: e.target.value as BrowserPreferences["imageAnimationPolicy"] })}><option value="animate">Animar sempre</option><option value="animateOnce">Animar uma vez</option><option value="noAnimation">Não animar</option></select></label>
          <p className="settings-note">Temas e wallpaper ficam disponíveis em uma aba própria pelo botão ◈ da barra lateral.</p>
        </SettingsSection>}

        {visible("search", "pesquisa mecanismo buscador barra endereço autocomplete autocompletar sugestão histórico favoritos brave google bing duckduckgo ecosia") && <SettingsSection title="Pesquisa e preenchimento inteligente" description="Controle o buscador e as sugestões locais exibidas enquanto você digita na barra de endereço.">
          <label className="setting-control"><span><b>Pesquisa padrão</b><small>Usada para texto que não é reconhecido como URL.</small></span><select value={preferences.searchEngine} onChange={(e) => updatePreferences({ searchEngine: e.target.value as BrowserPreferences["searchEngine"] })}><option value="brave">Brave Search</option><option value="google">Google</option><option value="bing">Bing</option><option value="duckduckgo">DuckDuckGo</option><option value="ecosia">Ecosia</option></select></label>
          <Toggle checked={preferences.addressSuggestionsEnabled} text="Sugerir páginas visitadas, favoritos e abas abertas" set={(v) => updatePreferences({ addressSuggestionsEnabled: v })}/>
          <p className="settings-note">As sugestões são calculadas localmente. O MarshMallow aprende por domínio, título, frequência e recência: por exemplo, “go” pode sugerir Google e “gm” pode sugerir Gmail depois que esses sites fizerem parte do seu histórico/favoritos. Use ↑/↓ para escolher, Tab para preencher e Enter para abrir.</p>
        </SettingsSection>}

        {visible("tabs", "abas navegação popup pop-up redirecionamento autoplay reprodução automática nova aba privada reabrir") && <SettingsSection title="Abas e navegação" description="Comportamento de pop-ups, mídia e ações das abas.">
          <label className="setting-control"><span><b>Pop-ups e novas janelas</b><small>O modo inteligente bloqueia tentativas suspeitas e libera sites que você marcou como confiáveis.</small></span><select value={preferences.popupMode} onChange={(e) => updatePreferences({ popupMode: e.target.value as BrowserPreferences["popupMode"] })}><option value="smart">Inteligente (recomendado)</option><option value="block">Bloquear</option><option value="allow">Permitir</option></select></label>
          <div className="trusted-popup-sites"><div className="trusted-popup-sites-head"><div><b>Sites autorizados a abrir pop-ups</b><small>Usados no modo Inteligente. Você decide quais sites merecem essa confiança.</small></div><div className="trusted-popup-add"><input value={popupSiteDraft} onChange={(e) => setPopupSiteDraft(e.target.value)} placeholder="exemplo.com"/><button type="button" onClick={() => { const host = normalizeTrustedPopupSite(popupSiteDraft); if (!host) return; updatePreferences({ trustedPopupSites: [...new Set([...(preferences.trustedPopupSites || []), host])].sort() }); setPopupSiteDraft(""); }}>Adicionar</button></div></div>
            {(preferences.trustedPopupSites || []).length === 0 ? <div className="trusted-popup-empty">Nenhum site autorizado ainda. Quando o MarshMallow bloquear um pop-up, você também poderá escolher “Sempre permitir neste site”.</div> : <div className="trusted-popup-list">{preferences.trustedPopupSites.map((site) => <div className="trusted-popup-row" key={site}><span>{site}</span><button type="button" onClick={() => updatePreferences({ trustedPopupSites: preferences.trustedPopupSites.filter((item) => item !== site) })}>Remover</button></div>)}</div>}
          </div>
          <label className="setting-control"><span><b>Reprodução automática</b><small>Aplicada integralmente em novas abas ou após reiniciar.</small></span><select value={preferences.autoplayPolicy} onChange={(e) => updatePreferences({ autoplayPolicy: e.target.value as BrowserPreferences["autoplayPolicy"] })}><option value="allow">Permitir áudio/vídeo automático</option><option value="user-gesture">Exigir interação do usuário</option></select></label>
          <div className="settings-button-grid"><button onClick={reopenTab}>Reabrir aba fechada</button><button onClick={newPrivateTab}>Nova aba privada</button></div>
        </SettingsSection>}

        {visible("privacy", "privacidade segurança rastreamento do not track dnt gpc cookies cache limpar saída webrtc ip") && <SettingsSection title="Privacidade e segurança" description="Controles de privacidade aplicados ao perfil persistente do navegador.">
          <Toggle checked={preferences.doNotTrack} text="Enviar sinal Do Not Track (DNT)" set={(v) => updatePreferences({ doNotTrack: v })}/>
          <Toggle checked={preferences.globalPrivacyControl} text="Enviar Global Privacy Control (Sec-GPC)" set={(v) => updatePreferences({ globalPrivacyControl: v })}/>
          <Toggle checked={preferences.clearBrowsingDataOnExit} text="Limpar cookies, cache e dados de sites ao sair" set={(v) => updatePreferences({ clearBrowsingDataOnExit: v })}/>
          <label className="setting-control"><span><b>Cookies entre sites</b><small>Necessários para alguns logins federados e conteúdo incorporado. Bloquear pode quebrar autenticação.</small></span><select value={preferences.thirdPartyCookieAccess} onChange={(e) => updatePreferences({ thirdPartyCookieAccess: e.target.value as BrowserPreferences["thirdPartyCookieAccess"] })}><option value="allow">Permitir quando o site solicitar</option><option value="block">Bloquear</option></select></label>
          <label className="setting-control"><span><b>Proteção de endereço IP no WebRTC</b><small>Modos mais restritos podem afetar chamadas P2P.</small></span><select value={preferences.webrtcPolicy} onChange={(e) => updatePreferences({ webrtcPolicy: e.target.value as BrowserPreferences["webrtcPolicy"] })}><option value="default">Padrão / compatibilidade máxima</option><option value="default_public_interface_only">Ocultar IP local</option><option value="disable_non_proxied_udp">Restringir UDP não-proxy</option></select></label>
          <div className="settings-button-grid"><button className="danger-soft" onClick={clearBrowsingData}>Limpar dados de navegação agora</button></div>
          <p className="settings-note">O MarshMallow usa um perfil persistente do Chromium. Cookies, IndexedDB, localStorage e service workers permanecem entre reinicializações, a menos que você escolha limpar ao sair.</p>
        </SettingsSection>}

        {visible("cookies", "cookies sessão login salvar importar exportar backup dados sites armazenamento") && <CookieManagerSection/>}

        {visible("permissions", "permissões sites câmera microfone localização notificações clipboard área transferência midi fullscreen tela cheia") && <SettingsSection title="Permissões de sites" description="Defina o comportamento padrão. “Perguntar” abre uma caixa nativa antes de conceder acesso.">
          <PermissionRow label="Câmera" value={preferences.permissionDefaults.camera} set={(v) => updatePermission("camera", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="Microfone" value={preferences.permissionDefaults.microphone} set={(v) => updatePermission("microphone", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="Localização" value={preferences.permissionDefaults.location} set={(v) => updatePermission("location", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="Notificações" value={preferences.permissionDefaults.notifications} set={(v) => updatePermission("notifications", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="Área de transferência" value={preferences.permissionDefaults.clipboard} set={(v) => updatePermission("clipboard", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="MIDI" value={preferences.permissionDefaults.midi} set={(v) => updatePermission("midi", v)}>{permissionOptions}</PermissionRow>
          <PermissionRow label="Tela cheia" value={preferences.permissionDefaults.fullscreen} set={(v) => updatePermission("fullscreen", v)}>{permissionOptions}</PermissionRow>
          <p className="settings-note">A próxima camada será a lista de exceções por site (Permitir/Bloquear apenas para um domínio), como nos grandes navegadores.</p>
        </SettingsSection>}

        {visible("downloads", "downloads baixar salvar pasta perguntar localização arquivos") && <SettingsSection title="Downloads" description="Escolha onde arquivos baixados serão salvos.">
          <Toggle checked={preferences.downloadsAskWhere} text="Perguntar onde salvar cada arquivo" set={(v) => updatePreferences({ downloadsAskWhere: v })}/>
          <label className="setting-field"><span>Pasta padrão</span><input readOnly value={preferences.downloadPath || (isWindows ? "Pasta Downloads do Windows" : "Pasta Downloads do sistema")}/></label>
          <div className="settings-button-grid"><button onClick={chooseDownloadFolder}>Alterar pasta</button><button onClick={openDownloadsFolder}>Abrir pasta de downloads</button></div>
          <DownloaderManagerSettings preferences={preferences} updatePreferences={updatePreferences} isWindows={isWindows}/>
        </SettingsSection>}

        {visible("languages", "idiomas corretor ortográfico spellcheck accept language tradução português inglês") && <SettingsSection title="Idiomas" description="Idiomas enviados aos sites e usados pelo corretor ortográfico do Chromium.">
          <Toggle checked={preferences.spellcheckEnabled} text="Usar corretor ortográfico" set={(v) => updatePreferences({ spellcheckEnabled: v })}/>
          <label className="setting-field"><span>Idiomas do corretor <small>Separe por vírgula, por exemplo: pt-BR,en-US.</small></span><input value={preferences.spellcheckLanguages.join(",")} onChange={(e) => updatePreferences({ spellcheckLanguages: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}/></label>
          <label className="setting-field"><span>Accept-Language <small>Preferência enviada aos sites.</small></span><input value={preferences.acceptLanguages} onChange={(e) => updatePreferences({ acceptLanguages: e.target.value })}/></label>
          <p className="settings-note">Palavras possivelmente incorretas ficam sublinhadas pelo Chromium. Clique com o botão direito para ver correções sugeridas, substituir a palavra ou adicioná-la ao dicionário — comportamento semelhante ao corretor dos teclados Android. “Traduzir para o português” continua disponível no menu da página.</p>
        </SettingsSection>}

        {visible("performance", "desempenho memória energia aceleração hardware gpu segundo plano throttling bateria") && <SettingsSection title="Desempenho" description="Ajustes do Chromium/Electron que afetam memória, energia e renderização.">
          <Toggle checked={preferences.backgroundThrottling} text="Economizar recursos em abas em segundo plano" set={(v) => updatePreferences({ backgroundThrottling: v })}/>
          <Toggle checked={preferences.deferBackgroundMediaUntilActivated} text="Não reproduzir mídia de novas abas em segundo plano até eu abri-las" set={(v) => updatePreferences({ deferBackgroundMediaUntilActivated: v })}/>
          <Toggle checked={preferences.hardwareAcceleration} text="Usar aceleração de hardware quando disponível" set={(v) => updatePreferences({ hardwareAcceleration: v })}/>
          <p className="settings-note">Aceleração por hardware exige reiniciar. Economia de memória avançada (suspensão automática de abas) será implementada separadamente para não matar streams, Watch Together ou páginas com áudio.</p>
        </SettingsSection>}

        {visible("system", "sistema rede proxy windows linux navegador padrão conexão") && <SettingsSection title="Sistema e rede" description={isWindows ? "Integração com o Windows e configuração de proxy." : "Integração com o Linux e configuração de proxy."}>
          <label className="setting-control"><span><b>Proxy</b><small>Use o sistema, conexão direta ou regras manuais.</small></span><select value={preferences.proxyMode} onChange={(e) => updatePreferences({ proxyMode: e.target.value as BrowserPreferences["proxyMode"] })}><option value="system">Usar proxy do sistema</option><option value="direct">Conexão direta</option><option value="custom">Proxy personalizado</option></select></label>
          {preferences.proxyMode === "custom" && <label className="setting-field"><span>Regras de proxy <small>Ex.: http=127.0.0.1:8080;https=127.0.0.1:8080</small></span><input value={preferences.proxyRules} onChange={(e) => updatePreferences({ proxyRules: e.target.value })}/></label>}
          <div className="settings-button-grid"><button onClick={openDefaultApps}>{isWindows ? "Abrir configurações de navegador padrão" : "Tornar MarshMallow navegador padrão"}</button></div>
        </SettingsSection>}

        {visible("compatibility", "google login autenticação oauth edge chrome navegador nativo compatibilidade conta") && <SettingsSection title="Compatibilidade de login" description="Logins iniciados por uma página permanecem na própria aba do MarshMallow. Um navegador externo só é aberto quando você pedir manualmente.">
          <div className="settings-info-grid"><div><span>Login em sites</span><b>Dentro do MarshMallow</b></div><div><span>Redirecionamento automático</span><b>Desativado</b></div></div>
          <label className="setting-control"><span><b>Navegador externo para abertura manual</b><small>Usado somente pelos botões abaixo ou pela opção “Abrir no navegador nativo” do menu de contexto.</small></span><select value={preferences.nativeBrowser} onChange={(e) => updatePreferences({ nativeBrowser: e.target.value as BrowserPreferences["nativeBrowser"] })}><option value="edge">Microsoft Edge</option><option value="chrome">Google Chrome</option><option value="system">{isWindows ? "Navegador padrão do Windows" : "Navegador padrão do sistema"}</option></select></label>
          <div className="settings-button-grid"><button onClick={() => void window.marshmallow.browser.openNativeUrl("https://accounts.google.com/")}>Abrir login Google externamente</button><button onClick={() => void window.marshmallow.browser.openNativeUrl("https://www.google.com/")}>Abrir Google externamente</button></div>
          <p className="settings-note"><b>4.0.4:</b> o login do Google/YouTube permanece dentro da aba e o MarshMallow permite as permissões Storage Access usadas por logins que dependem de cookies entre sites. Popups de autenticação Google iniciados pelo YouTube são mantidos na aba atual para não perder o contexto do login.</p>
        </SettingsSection>}

        {visible("ai", "marshmallow ai inteligência artificial autonomia permissão organizar abas abrir páginas ler página fechar") && <SettingsSection title="MarshMallow AI" description="A IA só executa ações dentro das permissões concedidas aqui.">
          <Toggle checked={settings.permissions.organizeTabs} text="Organizar e agrupar abas" set={(v) => updateUi({ permissions: { ...settings.permissions, organizeTabs: v } })}/>
          <Toggle checked={settings.permissions.openPages} text="Abrir páginas" set={(v) => updateUi({ permissions: { ...settings.permissions, openPages: v } })}/>
          <Toggle checked={settings.permissions.readCurrentPage} text="Ler a página atual quando necessário" set={(v) => updateUi({ permissions: { ...settings.permissions, readCurrentPage: v } })}/>
          <Toggle checked={settings.permissions.autoOrganize} text="Auto-organizar novas abas" set={(v) => updateUi({ permissions: { ...settings.permissions, autoOrganize: v } })}/>
          <label className="setting-control"><span><b>Fechar abas</b><small>Controle explícito de autonomia.</small></span><select value={settings.permissions.closeTabs} onChange={(e) => updateUi({ permissions: { ...settings.permissions, closeTabs: e.target.value as AiPermissions["closeTabs"] } })}><option value="ask">Perguntar</option><option value="allow">Permitir</option><option value="deny">Nunca</option></select></label>
        </SettingsSection>}

        {visible("watch", "watch together transmissão chat nome balão ocultar") && <SettingsSection title="Watch Together" description="Identidade e comportamento do chat durante transmissões.">
          <label className="setting-field"><span>Nome no Watch Together</span><input value={settings.displayName} maxLength={36} onChange={(e) => updateUi({ displayName: e.target.value || account.displayName })}/></label>
          <Toggle checked={settings.chatBubblePersistentHidden} text="Manter o balão do chat oculto" set={(v) => updateUi({ chatBubblePersistentHidden: v })}/>
        </SettingsSection>}

        {visible("advanced", "avançado devtools dados extensões senhas autofill preenchimento certificados dns https sincronização importar") && <SettingsSection title="Avançado" description="Ferramentas de diagnóstico e módulos que transformarão o MarshMallow num navegador completo.">
          <div className="settings-button-grid"><button onClick={openDevTools}>DevTools da página atual</button><button onClick={clearBrowsingData}>Limpar dados de sites</button></div>
          <div className="settings-roadmap"><b>Arquitetura reservada para as próximas camadas</b><span>Gerenciador de senhas e preenchimento automático</span><span>Extensões Chromium</span><span>Exceções de permissões por site</span><span>Proteção avançada contra rastreamento e exceções por site</span><span>HTTPS-Only, DNS seguro e certificados</span><span>Perfis, importação e sincronização entre dispositivos</span><span>Economia de memória com descarte inteligente de abas</span></div>
        </SettingsSection>}

        {visible("about", "sobre versão atualização chromium electron backend licença apoio") && <SettingsSection title="Sobre o MarshMallow" description="Informações da instalação atual.">
          <div className="about-marshmallow"><img src="./icon.png" alt=""/><div><b>MarshMallow</b><span>Versão {version}</span><small>MarshMallow 5.0 · Chromium/Electron · {isWindows ? "Windows" : "Linux"}</small></div></div>
          <p className="settings-note"><b>Criador e desenvolvedor:</b> Deivison Santos · @devsaex</p>
          <p className="settings-note">Backend oficial: marshmallow-gateway.marshmallow-browser-br.workers.dev</p>
          <UpdateStatus/>
          <div className="settings-button-grid"><button onClick={() => void window.marshmallow.browser.newInternalTab("support")}>♡ Apoiar o projeto</button><button onClick={() => void window.marshmallow.browser.newInternalTab("performance")}>⚡ Diagnóstico de desempenho</button></div>
        </SettingsSection>}

        {search && !SETTINGS_CATEGORIES.some((item) => normalizeSettingSearch(`${item.label} ${item.keywords}`).includes(search)) && <div className="settings-empty"><b>Nenhuma configuração encontrada.</b><span>Tente palavras como “fonte”, “download”, “Google”, “compatibilidade”, “privacidade” ou “IA”.</span></div>}
      </div>
    </div>
  </section>;
}

function CookieManagerSection() {
  const [cookies, setCookies] = useState<BrowserCookieSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [storagePath, setStoragePath] = useState("");
  const [query, setQuery] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async (nextQuery = query) => {
    try {
      const result = await window.marshmallow.browser.listCookies(nextQuery);
      setCookies(result.cookies || []);
      setTotal(Number(result.count || 0));
      setStoragePath(result.storagePath || "");
    } catch (error) {
      setMessage(`Falha ao ler cookies: ${String((error as Error)?.message || error)}`);
    }
  };

  useEffect(() => { void refresh(""); }, []);

  const saveNow = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await window.marshmallow.browser.saveCookies();
      setMessage(result.ok ? `${result.count} cookies gravados no perfil persistente.` : "Não foi possível salvar os cookies.");
      await refresh();
    } finally { setBusy(false); }
  };

  const clearAll = async () => {
    if (!window.confirm("Apagar todos os cookies do perfil normal do MarshMallow? Isso encerrará sessões em sites.")) return;
    setBusy(true); setMessage("");
    try {
      await window.marshmallow.browser.clearCookies();
      setMessage("Todos os cookies foram apagados.");
      await refresh("");
    } finally { setBusy(false); }
  };

  const exportBackup = async () => {
    if (backupPassword.length < 8) { setMessage("Use uma senha de backup com pelo menos 8 caracteres."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await window.marshmallow.browser.exportCookies(backupPassword);
      if (result.canceled) return;
      setMessage(result.ok ? `Backup seguro criado com ${result.count || 0} cookies.` : (result.error || "Falha ao exportar cookies."));
    } finally { setBusy(false); }
  };

  const importBackup = async () => {
    if (backupPassword.length < 8) { setMessage("Informe a senha do backup (mínimo de 8 caracteres)."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await window.marshmallow.browser.importCookies(backupPassword);
      if (result.canceled) return;
      setMessage(result.ok ? `${result.imported || 0} cookies importados${result.skipped ? `; ${result.skipped} ignorados` : ""}.` : (result.error || "Falha ao importar cookies."));
      if (result.ok) await refresh("");
    } finally { setBusy(false); }
  };

  const removeOne = async (cookie: BrowserCookieSummary) => {
    await window.marshmallow.browser.removeCookie(cookie);
    await refresh();
  };

  return <SettingsSection title="Cookies e dados de sites" description="Gerencie o perfil persistente usado pelas abas normais do MarshMallow.">
    <div className="settings-info-grid cookie-info-grid"><div><span>Cookies armazenados</span><b>{total}</b></div><div><span>Persistência</span><b>Ativa</b></div></div>
    <p className="settings-note">Cookies normais são salvos automaticamente no perfil <code>persist:marshmallow</code>. O botão “Salvar agora” força a gravação imediata no disco. Abas privadas continuam usando armazenamento temporário separado.</p>
    {storagePath && <label className="setting-field"><span>Pasta do perfil Chromium</span><input readOnly value={storagePath}/></label>}
    <div className="settings-button-grid"><button disabled={busy} onClick={() => void saveNow()}>Salvar cookies agora</button><button className="danger-soft" disabled={busy} onClick={() => void clearAll()}>Apagar todos os cookies</button></div>
    <div className="cookie-backup-box">
      <b>Backup/importação segura</b>
      <p>O arquivo <code>.mmcookies</code> é criptografado com AES-256-GCM e a senha que você escolher. Ele pode ser importado em outra instalação do MarshMallow com a mesma senha.</p>
      <label className="setting-field"><span>Senha do backup</span><input type="password" value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password"/></label>
      <div className="settings-button-grid"><button disabled={busy} onClick={() => void exportBackup()}>Exportar cookies</button><button disabled={busy} onClick={() => void importBackup()}>Importar cookies</button></div>
      <small className="cookie-security-note">O arquivo contém dados de sessão sensíveis, porém permanece criptografado. Não compartilhe a senha nem o arquivo com terceiros.</small>
    </div>
    <div className="cookie-manager-toolbar"><label className="internal-search"><span>⌕</span><input value={query} onChange={(e) => { const value = e.target.value; setQuery(value); void refresh(value); }} placeholder="Pesquisar domínio ou cookie"/></label><button disabled={busy} onClick={() => void refresh()}>Atualizar</button></div>
    {message && <div className="cookie-manager-message">{message}</div>}
    <div className="cookie-table-wrap">
      <table className="cookie-table"><thead><tr><th>Site</th><th>Cookie</th><th>Tipo</th><th>Expira</th><th></th></tr></thead><tbody>
        {cookies.length === 0 ? <tr><td colSpan={5} className="cookie-empty">Nenhum cookie encontrado.</td></tr> : cookies.map((cookie, index) => <tr key={`${cookie.domain}|${cookie.path}|${cookie.name}|${index}`}><td><b>{cookie.domain}</b><small>{cookie.path}</small></td><td>{cookie.name}</td><td><span>{cookie.httpOnly ? "HttpOnly" : "Web"}</span>{cookie.secure && <small>Secure</small>}</td><td>{cookie.session ? "Sessão" : cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleDateString("pt-BR") : "—"}</td><td><button className="cookie-delete" title="Apagar este cookie" onClick={() => void removeOne(cookie)}>×</button></td></tr>)}
      </tbody></table>
    </div>
    {cookies.length >= 2000 && <p className="settings-note">A lista visual mostra no máximo 2.000 cookies por pesquisa, mas exportação e limpeza operam sobre todo o perfil.</p>}
  </SettingsSection>;
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="settings-section"><header><h2>{title}</h2><p>{description}</p></header><div className="settings-section-body">{children}</div></section>;
}

function PermissionRow({ label, value, set, children }: { label: string; value: PermissionMode; set: (value: PermissionMode) => void; children: ReactNode }) {
  return <label className="setting-control"><span><b>{label}</b></span><select value={value} onChange={(e) => set(e.target.value as PermissionMode)}>{children}</select></label>;
}

function AuthWindowControls({ maximized }: { maximized: boolean }) {
  return <div className="auth-windowbar">
    <div className="auth-window-drag"><span>MarshMallow</span></div>
    <div className="auth-window-buttons no-drag">
      <button title="Minimizar" onClick={() => void window.marshmallow.window.minimize()}>−</button>
      <button title={maximized ? "Restaurar" : "Maximizar"} onClick={() => void window.marshmallow.window.maximizeToggle()}>{maximized ? "↙" : "↗"}</button>
      <button className="auth-window-close" title="Fechar" onClick={() => void window.marshmallow.window.close()}>×</button>
    </div>
  </div>;
}

function PanelHead({ title, subtitle, close }: { title: string; subtitle: string; close: () => void }) { return <div className="panel-head"><div><b>{title}</b><small>{subtitle}</small></div><button onClick={close}>×</button></div>; }
function Toggle({ checked, text, set }: { checked: boolean; text: string; set: (value: boolean) => void }) { return <label className="toggle-row"><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)}/><span>{text}</span></label>; }
