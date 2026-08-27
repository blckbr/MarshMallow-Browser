export type PermissionMode = "ask" | "allow" | "block";
export type StartupMode = "continue" | "newtab" | "home" | "custom";
export type SearchEngineId = "brave" | "google" | "bing" | "duckduckgo" | "ecosia";
export type PopupMode = "smart" | "block" | "allow";
export type ProxyMode = "system" | "direct" | "custom";
export type WebRtcPolicy = "default" | "default_public_interface_only" | "disable_non_proxied_udp";
export type ImageAnimationPolicy = "animate" | "animateOnce" | "noAnimation";
export type NativeAuthMode = "auto" | "off";
export type NativeBrowserId = "edge" | "chrome" | "system";
export type DownloadManagerMode = "builtin" | "external";
export type GameModePreference = "auto" | "on" | "off";
export type GameDomainSetting = { mode: GameModePreference; saveResourcesInBackground: boolean };
export type GameModeState = { host: string; setting: GameDomainSetting; active: boolean; score: number; reasons: string[]; backgroundPolicy?: { continuous: boolean; demandingTabIds: string[] } };
export type NavigationMenuEntry = { index: number; url: string; title: string; favicon?: string; current?: boolean };
export type PerformanceDiagnostics = { version: string; gpuInfo: any; featureStatus: Record<string,string>; gameMode: GameModeState; backgroundPolicy: { continuous:boolean; demandingTabIds:string[] }; gamepadAvailable:boolean };
export type UpdateState = { ok:boolean; currentVersion:string; available:boolean; version?:string; url?:string; sha256?:string; size?:number; releaseUrl?:string; updateMode?:string; message?:string; error?:string };
export type DownloadRecord = { id:string; url:string; filename:string; savePath:string; state:"progressing"|"paused"|"completed"|"cancelled"|"interrupted"; receivedBytes:number; totalBytes:number; progress:number; startedAt:number; updatedAt:number; private:boolean; canPause:boolean; canResume:boolean; canCancel:boolean; canOpen:boolean; canShow:boolean };
export type DownloadSnapshot = { items:DownloadRecord[]; active:number; managerMode:DownloadManagerMode };
export type DownloaderManagerState = { ok:boolean; available:boolean; version:string; url:string; protocol:string; checkedAt?:number; metadataUrl?:string; error?:string };

export type BrowserPreferences = {
  startupMode: StartupMode;
  startupPages: string[];
  homePage: string;
  newTabPage: string;
  searchEngine: SearchEngineId;
  addressSuggestionsEnabled: boolean;
  showHomeButton: boolean;
  defaultPageZoom: number;
  defaultFontSize: number;
  minimumFontSize: number;
  popupMode: PopupMode;
  trustedPopupSites: string[];
  downloadsAskWhere: boolean;
  downloadPath: string;
  downloadManagerMode: DownloadManagerMode;
  doNotTrack: boolean;
  globalPrivacyControl: boolean;
  clearBrowsingDataOnExit: boolean;
  thirdPartyCookieAccess: "allow" | "block";
  spellcheckEnabled: boolean;
  spellcheckLanguages: string[];
  acceptLanguages: string;
  autoplayPolicy: "allow" | "user-gesture";
  backgroundThrottling: boolean;
  deferBackgroundMediaUntilActivated: boolean;
  hardwareAcceleration: boolean;
  proxyMode: ProxyMode;
  proxyRules: string;
  webrtcPolicy: WebRtcPolicy;
  imageAnimationPolicy: ImageAnimationPolicy;
  nativeAuthMode: NativeAuthMode;
  nativeBrowser: NativeBrowserId;
  gameModeByDomain: Record<string, GameDomainSetting>;
  permissionDefaults: {
    camera: PermissionMode;
    microphone: PermissionMode;
    location: PermissionMode;
    notifications: PermissionMode;
    clipboard: PermissionMode;
    midi: PermissionMode;
    fullscreen: PermissionMode;
  };
};


export type BrowserCookieSummary = {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  expirationDate?: number;
  sameSite: string;
  hostOnly: boolean;
};

export type InternalPageId = "newtab" | "library" | "themes" | "settings" | "extensions" | "performance" | "support" | "pdf";
export type PdfSource = { kind: "url"; url: string; name?: string };

export type ExtensionCompatibility = { level: "good" | "partial" | "incompatible"; issues: string[]; warnings: string[]; supportedApis: string[] };
export type BrowserExtension = { installId: string; runtimeId: string; name: string; version: string; description: string; manifestVersion: number; permissions: string[]; hostPermissions: string[]; enabled: boolean; allowFileAccess: boolean; installType: "managed" | "unpacked"; source: string; path: string; lastError: string; compatibility: ExtensionCompatibility };
export type ExtensionManagerState = { developerMode: boolean; allowExternalSources: boolean; electronApiNotice: string; supportedApis: string[]; items: BrowserExtension[] };
export type MediaCandidate = { id: string; url: string; kind: "audio" | "video" | "muxed" | "manifest"; manifest: boolean; mimeType: string; filename: string; source: string; detectedAt: number; contentLength: number; pageUrl: string; resolution?: string; container?: string; codec?: string; bitrate?: number; streamGroupId?: string; hasAudio?: boolean; hasVideo?: boolean; direct?: boolean; drm?: boolean; protected?: boolean };
export type MediaCapabilities = { directDownload: boolean; ffmpeg: boolean; ffmpegPath: string; note: string };

export type BrowserTab = {
  id: string;
  title: string;
  url: string;
  favicon: string;
  loading: boolean;
  audible: boolean;
  muted: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  active: boolean;
  private: boolean;
  sleeping?: boolean;
  lastActiveAt: number;
  internalPage?: InternalPageId;
  pdfSource?: PdfSource;
  gameMode?: GameModeState;
};

export type BrowserState = {
  version: string;
  platform: string;
  activeTabId: string | null;
  tabs: BrowserTab[];
};

export type WatchSession = {
  room: string;
  hostToken: string;
  chatToken: string;
  inviteUrl: string;
};

export type WatchStatus = {
  phase: string;
  message: string;
  frameUrl?: string;
  media?: unknown;
  videoTracks?: number;
  audioTracks?: number;
};

export type PageExtract = { title: string; url: string; text: string };

declare global {
  interface Window {
    marshmallow: {
      version: string;
      browser: {
        getState(): Promise<BrowserState>;
        newTab(url?: string): Promise<string>;
        newPrivateTab(url?: string): Promise<string>;
        newInternalTab(page: InternalPageId): Promise<string>;
        activateTab(id: string): Promise<void>;
        closeTab(id: string): Promise<void>;
        reopenTab(): Promise<void>;
        navigate(input: string): Promise<void>;
        action(action: string): Promise<void>;
        setMuted(id: string, muted: boolean): Promise<void>;
        setLayout(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
        setToolbarOverflow(payload: {
          open: boolean;
          anchor?: { left: number; top: number; right: number; bottom: number };
        }): Promise<boolean>;
        onToolbarOverflowState(callback: (open: boolean) => void): () => void;
        setDock(payload: { mode: "none"|"ai"|"watch"|"media"|"game"|"organizer"; width: number }): Promise<{ mode:string; width:number; pageBounds:any }>;
        getNavigationHistory(direction: "back"|"forward"): Promise<{ currentIndex:number; items:NavigationMenuEntry[] }>;
        goNavigationIndex(index: number): Promise<BrowserState>;
        getGameMode(): Promise<GameModeState>;
        setGameMode(setting: GameDomainSetting): Promise<GameModeState>;
        reportGameSignals(signals: Record<string, unknown>): Promise<GameModeState>;
        getPerformanceDiagnostics(): Promise<PerformanceDiagnostics>;
        openSupportUrl(url: string): Promise<{ok:boolean;error?:string}>;
        checkUpdate(): Promise<UpdateState>;
        downloadUpdate(): Promise<{ok:boolean;verified?:boolean;path?:string;sha256?:string;version?:string;error?:string;canceled?:boolean}>;
        reorderTabs(ids: string[]): Promise<BrowserState>;
        extractText(): Promise<PageExtract>;
        setChatBubble(state: { visible: boolean; unread: number }): Promise<{ visible: boolean; unread: number }>;
        setShellOnly(value: boolean): Promise<boolean>;
        devTools(): Promise<void>;
        getPreferences(): Promise<BrowserPreferences>;
        setPreferences(prefs: BrowserPreferences): Promise<{ preferences: BrowserPreferences; restartRequired: boolean }>;
        chooseDownloadFolder(): Promise<string>;
        clearBrowsingData(): Promise<{ ok: boolean }>;
        listCookies(query?: string): Promise<{ count: number; storagePath: string; cookies: BrowserCookieSummary[] }>;
        saveCookies(): Promise<{ ok: boolean; count: number; storagePath: string }>;
        removeCookie(cookie: Pick<BrowserCookieSummary, "name" | "domain" | "path" | "secure" | "sameSite">): Promise<{ ok: boolean; error?: string }>;
        clearCookies(): Promise<{ ok: boolean }>;
        exportCookies(passphrase: string): Promise<{ ok: boolean; canceled?: boolean; path?: string; count?: number; error?: string }>;
        importCookies(passphrase: string): Promise<{ ok: boolean; canceled?: boolean; imported?: number; skipped?: number; sourceVersion?: string; error?: string; detail?: string }>;
        saveWallpaper(payload: { source: string; name?: string }): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
        applyWallpaper(payload: { source: string; name?: string; target: "desktop" | "lockscreen" }): Promise<{ ok: boolean; target?: string; path?: string; error?: string }>;
        findAudibleTabs(): Promise<{ count: number; tabs: Array<{ id: string; title: string; url: string; active: boolean }> }>;
        sleepBackgroundTabs(): Promise<{ ok: boolean; suspended: number; alreadySleeping: number; skipped: number }>;
        getDownloads(): Promise<DownloadSnapshot>;
        pauseDownload(id: string): Promise<{ok:boolean;error?:string}>;
        resumeDownload(id: string): Promise<{ok:boolean;error?:string}>;
        cancelDownload(id: string): Promise<{ok:boolean;error?:string}>;
        openDownload(id: string): Promise<{ok:boolean;error?:string}>;
        showDownload(id: string): Promise<{ok:boolean;error?:string}>;
        clearDownloadHistory(): Promise<DownloadSnapshot>;
        getDownloaderManager(): Promise<DownloaderManagerState>;
        refreshDownloaderManager(): Promise<DownloaderManagerState>;
        openDownloaderManagerInstaller(): Promise<{ok:boolean;available?:boolean;url?:string;version?:string;error?:string}>;
        openDownloadsFolder(): Promise<void>;
        openDefaultApps(): Promise<void | { ok?: boolean; error?: string }>;
        makeDefaultBrowser(): Promise<{ ok: boolean; requiresSettings?: boolean; message?: string; error?: string }>;
        openNativeUrl(url: string): Promise<{ ok: boolean; engine?: string; error?: string }>;
        getNativeEngine(): Promise<{ preferred: string; available: Array<{ id: string; name: string; available: boolean }> }>;
        listExtensions(): Promise<ExtensionManagerState>;
        setExtensionSettings(patch: { developerMode?: boolean; allowExternalSources?: boolean }): Promise<ExtensionManagerState>;
        loadUnpackedExtension(): Promise<{ ok: boolean; canceled?: boolean; error?: string; extension?: BrowserExtension }>;
        installExtensionArchive(): Promise<{ ok: boolean; canceled?: boolean; error?: string; extension?: BrowserExtension }>;
        installExtensionUrl(url: string): Promise<{ ok: boolean; error?: string; extension?: BrowserExtension }>;
        setExtensionEnabled(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string; state?: ExtensionManagerState }>;
        reloadExtension(id: string): Promise<{ ok: boolean; error?: string; state?: ExtensionManagerState }>;
        setExtensionFileAccess(id: string, allow: boolean): Promise<{ ok: boolean; error?: string; state?: ExtensionManagerState }>;
        removeExtension(id: string): Promise<{ ok: boolean; error?: string; state?: ExtensionManagerState }>;
        openExtensionFolder(id: string): Promise<string>;
        packExtension(id: string): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
        listMedia(): Promise<{ count: number; items: MediaCandidate[]; private?: boolean; usesMediaSource?: boolean }>;
        mediaCapabilities(): Promise<MediaCapabilities>;
        downloadMedia(id: string, format: "original" | "mp3" | "mp4" | "merge"): Promise<{ ok: boolean; canceled?: boolean; started?: boolean; path?: string; filename?: string; error?: string }>;
        onMediaChanged(callback: (payload: { tabId: string; count: number }) => void): () => void;
        onDownloadsChanged(callback: (payload: DownloadSnapshot) => void): () => void;
        onState(callback: (state: BrowserState) => void): () => void;
      };
      pdf: {
        fetchUrl(url: string): Promise<{ ok: boolean; bytes?: Uint8Array; name?: string; mimeType?: string; error?: string }>;
        save(bytes: Uint8Array, suggestedName?: string): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
      };
      backend: {
        request(request: {
          path: string;
          method?: "GET" | "POST";
          headers?: Record<string, string>;
          body?: string;
        }): Promise<{
          ok: boolean;
          status: number;
          body: string;
          error?: string;
          contentType?: string;
          url?: string;
        }>;
      };
      window: {
        minimize(): Promise<void>;
        maximizeToggle(): Promise<boolean>;
        close(): Promise<void>;
        onMaximized(callback: (value: boolean) => void): () => void;
      };
      watch: {
        startMedia(config: {
          apiUrl: string;
          room: string;
          hostToken: string;
          name: string;
        }): Promise<{ ok: boolean; error?: string; frameUrl?: string; hasVideo?: boolean; cleanApplied?: boolean }>;
        stopMedia(): Promise<void>;
        onStatus(callback: (status: WatchStatus) => void): () => void;
      };
      ui: {
        onFocusAddress(callback: () => void): () => void;
        onOpenAI(callback: () => void): () => void;
        onOpenDownloads(callback: () => void): () => void;
        onPopupBlocked(callback: (payload: { tabId?: string; url?: string; openerUrl?: string }) => void): () => void;
        onPageContext(callback: () => void): () => void;
        onOpenWatchChat(callback: () => void): () => void;
        onNativeAuthOpened(callback: (payload: { url?: string; engine?: string; reason?: string }) => void): () => void;
        onHideWatchChat(callback: () => void): () => void;
      };
    };
  }
}

export {};
