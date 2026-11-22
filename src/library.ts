import { Router } from "@decky/ui";

const APP_TYPE_GAME = 1;
const APP_TYPE_SHORTCUT = 1073741824;

export interface LibraryGame {
  appId: number;
  name: string;
}

interface CollectionApp {
  appid: number;
  display_name: string;
  app_type: number;
}

declare const collectionStore: {
  localGamesCollection?: { allApps: CollectionApp[] };
  deckDesktopApps?: { allApps: CollectionApp[] };
};

export function installedGames(): LibraryGame[] {
  const apps = [
    ...(collectionStore.localGamesCollection?.allApps ?? []),
    ...(collectionStore.deckDesktopApps?.allApps ?? []),
  ];
  const games = new Map<number, LibraryGame>();
  for (const app of apps) {
    if (app.app_type === APP_TYPE_GAME || app.app_type === APP_TYPE_SHORTCUT) {
      games.set(app.appid, { appId: app.appid, name: app.display_name });
    }
  }
  return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function runningGame(): LibraryGame | null {
  const app = Router.MainRunningApp;
  return app ? { appId: Number(app.appid), name: app.display_name } : null;
}

export function folderName(gameName: string): string {
  return gameName
    .replace(/:\s*/g, " - ")
    .replace(/[\\/*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
