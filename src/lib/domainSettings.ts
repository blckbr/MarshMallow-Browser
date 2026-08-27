export type GameModePreference = "auto" | "on" | "off";
export type GameDomainSetting = { mode: GameModePreference; saveResourcesInBackground: boolean };
export const DEFAULT_GAME_DOMAIN_SETTING: GameDomainSetting = { mode: "auto", saveResourcesInBackground: false };
export function sanitizeGameDomainSetting(value: Partial<GameDomainSetting> | null | undefined): GameDomainSetting {
  return { mode: value?.mode === "on" || value?.mode === "off" ? value.mode : "auto", saveResourcesInBackground: Boolean(value?.saveResourcesInBackground) };
}
