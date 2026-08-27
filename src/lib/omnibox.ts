import type { BrowserTab } from "../types";

export type OmniboxSource = "history" | "bookmark" | "tab" | "search" | "url";
export type OmniboxSuggestion = { id: string; url: string; title: string; subtitle: string; source: OmniboxSource; score: number };
export type OmniboxHistoryEntry = { url: string; title: string; at: number; visits?: number };
export type OmniboxBookmark = { url: string; title: string };

const SMART_SITE_ALIASES: Array<{ test: RegExp; aliases: string[] }> = [
  { test: /(^|\.)google\./i, aliases: ["go", "google"] },
  { test: /(^|\.)(gmail\.com|mail\.google\.com)$/i, aliases: ["gm", "gmail"] },
  { test: /(^|\.)youtube\.com$/i, aliases: ["yt", "youtube"] },
  { test: /(^|\.)instagram\.com$/i, aliases: ["ig", "insta", "instagram"] },
  { test: /(^|\.)facebook\.com$/i, aliases: ["fb", "facebook"] },
  { test: /(^|\.)github\.com$/i, aliases: ["gh", "github"] },
  { test: /(^|\.)whatsapp\.com$/i, aliases: ["wa", "whatsapp"] },
  { test: /(^|\.)reddit\.com$/i, aliases: ["rd", "reddit"] },
  { test: /(^|\.)twitch\.tv$/i, aliases: ["tw", "twitch"] },
];

function normalizeText(value: string) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function compactMatchText(value: string) { return normalizeText(value).replace(/[^a-z0-9]+/g, ""); }
function siteOf(value: string) { try { return new URL(value).hostname.replace(/^www\./i, ""); } catch { return value; } }
function isGoogleVerificationUrl(value: string) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    const google = host === "google.com" || host.endsWith(".google.com") || host === "google.com.br" || host.endsWith(".google.com.br");
    return google && url.pathname.startsWith("/sorry/");
  } catch { return false; }
}
export function looksLikeAddress(value: string) { return /^(?:[a-z][a-z0-9+.-]*:\/\/|localhost(?::\d+)?(?:\/|$)|[^\s]+\.[a-z]{2,}(?:[/:?#]|$))/i.test(value.trim()); }

function scoreAddressCandidate(query: string, title: string, url: string) {
  const q = normalizeText(query.trim());
  const qc = compactMatchText(query);
  if (!q) return 0;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./i, ""); } catch {}
  const hn = normalizeText(host), hc = compactMatchText(host), tn = normalizeText(title || ""), tc = compactMatchText(title || ""), un = normalizeText(url);
  let score = 0;
  if (hn === q || hc === qc) score = Math.max(score, 320);
  if (hn.startsWith(q)) score = Math.max(score, 290);
  if (hc.startsWith(qc)) score = Math.max(score, 280);
  if (tn.startsWith(q)) score = Math.max(score, 260);
  if (tc.startsWith(qc)) score = Math.max(score, 250);
  if (hn.split(".").some((part) => part.startsWith(q))) score = Math.max(score, 240);
  const aliasHit = SMART_SITE_ALIASES.find((item) => item.test.test(host) && item.aliases.some((alias) => alias === q || alias.startsWith(q)));
  if (aliasHit) score = Math.max(score, aliasHit.aliases.includes(q) ? 340 : 300);
  if (tn.includes(q)) score = Math.max(score, 175);
  if (un.includes(q)) score = Math.max(score, 145);
  return score;
}

export function buildAddressSuggestions(query: string, history: OmniboxHistoryEntry[], bookmarks: OmniboxBookmark[], tabs: BrowserTab[], privateMode: boolean, now = Date.now()): OmniboxSuggestion[] {
  const raw = query.trim();
  if (!raw) return [];
  const merged = new Map<string, { url: string; title: string; at: number; visits: number; bookmark: boolean; tab: boolean; history: boolean }>();
  const add = (url: string, title: string, extra: Partial<{ at: number; visits: number; bookmark: boolean; tab: boolean; history: boolean }>) => {
    if (!/^https?:/i.test(url) || isGoogleVerificationUrl(url)) return;
    const current = merged.get(url) || { url, title: title || url, at: 0, visits: 0, bookmark: false, tab: false, history: false };
    current.title = title || current.title || url;
    current.at = Math.max(current.at, Number(extra.at || 0));
    current.visits = Math.max(current.visits, Number(extra.visits || 0));
    current.bookmark ||= Boolean(extra.bookmark);
    current.tab ||= Boolean(extra.tab);
    current.history ||= Boolean(extra.history);
    merged.set(url, current);
  };
  for (const bookmark of bookmarks) add(bookmark.url, bookmark.title, { bookmark: true });
  for (const tab of tabs) if (!tab.internalPage && tab.private === privateMode) add(tab.url, tab.title, { tab: true, at: tab.lastActiveAt });
  if (!privateMode) for (const item of history) add(item.url, item.title, { history: true, at: item.at, visits: item.visits || 1 });

  const candidates: OmniboxSuggestion[] = [];
  for (const item of merged.values()) {
    let score = scoreAddressCandidate(raw, item.title, item.url);
    if (!score) continue;
    if (item.bookmark) score += 40;
    if (item.tab) score += 34;
    if (item.history) score += Math.min(38, Math.log2(Math.max(1, item.visits) + 1) * 9);
    if (item.at) {
      const ageHours = Math.max(0, (now - item.at) / 3_600_000);
      score += Math.max(0, 34 - Math.log2(ageHours + 1) * 5);
    }
    const source: OmniboxSource = item.tab ? "tab" : item.bookmark ? "bookmark" : "history";
    const subtitle = item.tab ? `Aba aberta · ${siteOf(item.url)}` : item.bookmark ? `Favorito · ${siteOf(item.url)}` : `${item.visits || 1} visita${(item.visits || 1) === 1 ? "" : "s"} · ${siteOf(item.url)}`;
    candidates.push({ id: `${source}:${item.url}`, url: item.url, title: item.title || siteOf(item.url), subtitle, source, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"));
  const result = candidates.slice(0, 7);
  if (looksLikeAddress(raw)) {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!result.some((item) => item.url === normalized)) result.unshift({ id: `url:${normalized}`, url: normalized, title: `Ir para ${raw}`, subtitle: "Endereço digitado", source: "url", score: 999 });
  } else {
    result.push({ id: `search:${raw}`, url: raw, title: `Pesquisar “${raw}”`, subtitle: "Usar mecanismo de pesquisa padrão", source: "search", score: 1 });
  }
  return result.slice(0, 8);
}
