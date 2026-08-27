export function runtimePlatformInfo(platform = process.platform) {
  const normalized = String(platform || "unknown");
  return {
    platform: normalized,
    isWindows: normalized === "win32",
    isLinux: normalized === "linux",
    isMac: normalized === "darwin",
  };
}

export function appIconFilename(platform = process.platform) {
  return String(platform) === "win32" ? "icon.ico" : "icon.png";
}

export function cleanUserAgentPlatform(platform = process.platform) {
  switch (String(platform)) {
    case "linux":
      return "X11; Linux x86_64";
    case "darwin":
      return "Macintosh; Intel Mac OS X 10_15_7";
    default:
      return "Windows NT 10.0; Win64; x64";
  }
}

export function defaultNativeBrowser(platform = process.platform) {
  return String(platform) === "win32" ? "edge" : "system";
}


export function nativeBrowserCandidatesForPlatform(platform = process.platform, env = process.env) {
  const normalized = String(platform || "unknown");
  if (normalized === "linux") {
    return {
      edge: [
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
        "/opt/microsoft/msedge/msedge",
      ],
      chrome: [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ],
    };
  }
  if (normalized !== "win32") return { edge: [], chrome: [] };

  const pf = env.PROGRAMFILES || "C:\\Program Files";
  const pfx86 = env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const local = env.LOCALAPPDATA || "";
  return {
    edge: [
      `${pfx86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    chrome: [
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pfx86}\\Google\\Chrome\\Application\\chrome.exe`,
      local ? `${local}\\Google\\Chrome\\Application\\chrome.exe` : "",
    ],
  };
}

export function nativeSystemBrowserLabel(platform = process.platform) {
  return String(platform) === "win32" ? "Navegador padrão do Windows" : "Navegador padrão do sistema";
}

export function updatePolicyForPlatform(platform = process.platform) {
  return String(platform) === "win32"
    ? { mode: "windows-installer", canDownloadInstaller: true }
    : { mode: "package-manager", canDownloadInstaller: false };
}

export function linuxDefaultBrowserCommands(desktopFile = "marshmallow-browser.desktop") {
  const desktop = String(desktopFile || "marshmallow-browser.desktop");
  return [
    ["xdg-settings", ["set", "default-web-browser", desktop]],
    ["xdg-mime", ["default", desktop, "x-scheme-handler/http"]],
    ["xdg-mime", ["default", desktop, "x-scheme-handler/https"]],
    ["xdg-mime", ["default", desktop, "x-scheme-handler/marshmallow"]],
  ];
}
