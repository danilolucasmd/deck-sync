import { callable } from "@decky/api";

export interface Provider {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  app_id: number;
  name: string;
  local_path: string;
  remote_path: string;
  last_sync: number | null;
}

export type GameDraft = Omit<Game, "id" | "last_sync"> & { id?: string };

export interface PluginState {
  provider: string | null;
  credentials: Record<string, string>;
  providers: Provider[];
  connected: boolean;
  needs_signin: boolean;
  notify: boolean;
  two_way: boolean;
  history_limit: number;
  history_limits: number[];
  games: Game[];
  syncing: boolean;
  home: string;
}

export type SyncAction = "uploaded" | "downloaded" | "unchanged" | "skipped" | "failed";
export type SyncTrigger = "manual" | "launch" | "exit";

export interface SyncResult {
  game_id: string;
  name: string;
  action: SyncAction;
  files: number;
  error: string | null;
}

export type Option = "notify" | "two_way";

export const getState = callable<[], PluginState>("get_state");
export const setOption = callable<[key: Option, value: boolean], void>("set_option");
export const setHistoryLimit = callable<[limit: number], void>("set_history_limit");
export const startLogin = callable<[providerId: string], string>("start_login");
export const setCredentials = callable<[providerId: string, clientId: string, clientSecret: string], void>(
  "set_credentials",
);
export const logout = callable<[], void>("logout");
export const listLocalFolders = callable<[path: string], string[]>("list_local_folders");
export const listRemoteFolders = callable<[path: string], string[]>("list_remote_folders");
export const saveGame = callable<[game: GameDraft], { game?: Game; error?: string }>("save_game");
export const removeGame = callable<[gameId: string], void>("remove_game");
export const syncGame = callable<[gameId: string], SyncResult>("sync_game");
export const syncAll = callable<[], SyncResult[]>("sync_all");
export const onGameLifetime = callable<[appId: number, pid: number, running: boolean], void>("on_game_lifetime");
