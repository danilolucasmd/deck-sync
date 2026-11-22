import { addEventListener, definePlugin, removeEventListener, toaster } from "@decky/api";
import { Navigation, staticClasses } from "@decky/ui";
import { FaCloudUploadAlt } from "react-icons/fa";
import { onGameLifetime, SyncResult, SyncTrigger } from "./backend";
import { QuickAccess } from "./components/QuickAccess";
import { notifySync } from "./notify";
import { currentState, providerName, refresh, setActiveGame } from "./store";

export default definePlugin(() => {
  const started = addEventListener<[name: string]>("sync_started", (name) => setActiveGame(name));

  const finished = addEventListener<[result: SyncResult, trigger: SyncTrigger]>(
    "sync_finished",
    async (result) => {
      setActiveGame(null);
      await refresh();
      const state = currentState();
      if (state) notifySync(result, providerName(state), state.notify);
    },
  );

  const login = addEventListener<[provider: string, success: boolean]>("login_finished", async (provider, success) => {
    await refresh();
    if (success) {
      Navigation.NavigateBack();
      toaster.toast({ title: "DeckSync", body: `Connected to ${provider}` });
    } else {
      toaster.toast({ title: "DeckSync", body: `Sign-in to ${provider} didn't finish` });
    }
  });

  const lifetime = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((notification) => {
    onGameLifetime(notification.unAppID, notification.nInstanceID, notification.bRunning);
  });

  refresh();

  return {
    name: "DeckSync",
    titleView: <div className={staticClasses.Title}>DeckSync</div>,
    content: <QuickAccess />,
    icon: <FaCloudUploadAlt />,
    onDismount() {
      lifetime.unregister();
      removeEventListener("sync_started", started);
      removeEventListener("sync_finished", finished);
      removeEventListener("login_finished", login);
    },
  };
});
