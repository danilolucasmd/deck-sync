import { ButtonItem, DropdownItem, Field, PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useState } from "react";
import { clearDrafts, useDraft } from "../draft";
import { rememberMainPosition, useViewPosition } from "../position";
import { Option, setHistoryLimit, setOption, SyncResult, syncAll } from "../backend";
import { providerName, refresh, useStore } from "../store";
import { GameView } from "../views/GameView";
import { ProviderView } from "../views/ProviderView";

type View = { name: "main" } | { name: "provider" } | { name: "game"; id: string | null };

function lastSync(timestamp: number | null) {
  if (!timestamp) return "Not synced yet";
  return `Last synced ${new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

function summarize(results: SyncResult[]) {
  const failed = results.filter((result) => result.error).length;
  const changed = results.filter((result) => result.action === "uploaded" || result.action === "downloaded").length;
  if (failed) return `${failed} of ${results.length} games had a problem.`;
  if (!changed) return "Everything is up to date.";
  return changed === 1 ? "1 game synced." : `${changed} games synced.`;
}

export function QuickAccess() {
  const { state, activeGame } = useStore();
  const [summary, setSummary] = useState<string | null>(null);
  const [view, setView] = useDraft<View>("view", { name: "main" });
  const anchor = useViewPosition(view.name);

  if (!state) return null;

  const back = () => {
    clearDrafts();
    setView({ name: "main" });
  };
  const open = (next: View, target: string) => {
    rememberMainPosition(anchor, target);
    setView(next);
  };

  if (view.name === "provider") {
    return (
      <div ref={anchor}>
        <ProviderView onBack={back} />
      </div>
    );
  }
  if (view.name === "game") {
    return (
      <div ref={anchor}>
        <GameView id={view.id} onBack={back} />
      </div>
    );
  }

  const provider = providerName(state);
  const busy = state.syncing || activeGame !== null;

  const toggle = async (key: Option, value: boolean) => {
    await setOption(key, value);
    await refresh();
  };

  const sync = async () => {
    setSummary(null);
    try {
      setSummary(summarize(await syncAll()));
    } catch (error) {
      setSummary(String(error));
    }
    await refresh();
  };

  return (
    <div ref={anchor}>
      <PanelSection title="Cloud">
        <PanelSectionRow>
          <div data-return-target="provider">
            {state.connected ? (
              <ButtonItem
                layout="below"
                label={provider}
                description={
                  state.needs_signin
                    ? "Sign in again to use your app credentials."
                    : "Connected. Select to change or sign out."
                }
                onClick={() => open({ name: "provider" }, "provider")}
              >
                Manage
              </ButtonItem>
            ) : (
              <ButtonItem
                layout="below"
                description="Connect a cloud account to store your saves."
                onClick={() => open({ name: "provider" }, "provider")}
              >
                Set up cloud provider
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={!state.connected || state.games.length === 0 || busy}
            description={
              state.two_way
                ? `Copies whichever side has the newest save, the Deck or ${provider}.`
                : `Uploads the Deck's saves to ${provider}.`
            }
            onClick={sync}
          >
            {busy ? "Syncing…" : "Sync"}
          </ButtonItem>
        </PanelSectionRow>
        {(activeGame || summary) && (
          <PanelSectionRow>
            <Field focusable={false} description={activeGame ? `Syncing ${activeGame}…` : summary} />
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Games">
        {state.games.map((game) => (
          <PanelSectionRow key={game.id}>
            <div data-return-target={game.id}>
              <ButtonItem
                layout="below"
                label={game.name}
                description={lastSync(game.last_sync)}
                onClick={() => open({ name: "game", id: game.id }, game.id)}
              >
                Edit
              </ButtonItem>
            </div>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <div data-return-target="add">
            <ButtonItem
              layout="below"
              description="Choose a game, its save folder, and where it goes in the cloud."
              onClick={() => open({ name: "game", id: null }, "add")}
            >
              Add game
            </ButtonItem>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Settings">
        <PanelSectionRow>
          <ToggleField
            label="Backup notifications"
            description="Show a notification when saves are backed up or restored."
            checked={state.notify}
            onChange={(value) => toggle("notify", value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Two-way sync"
            description={`Off: the Deck always overwrites ${provider}. On: the newest save wins, both on Sync and when a game launches or exits.`}
            checked={state.two_way}
            onChange={(value) => toggle("two_way", value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="History size"
            description="How many replaced saves to keep per game. Lowering it moves the oldest to the Drive trash on the next sync."
            rgOptions={state.history_limits.map((limit) => ({ data: limit, label: `${limit} saves` }))}
            selectedOption={state.history_limit}
            onChange={async (option) => {
              await setHistoryLimit(option.data);
              await refresh();
            }}
          />
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}
