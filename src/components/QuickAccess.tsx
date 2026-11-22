import { ButtonItem, DropdownItem, Field, Navigation, PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useState } from "react";
import { Option, setHistoryLimit, setOption, SyncResult, syncAll } from "../backend";
import { providerName, refresh, useStore } from "../store";
import { routes } from "../routes";

function open(path: string) {
  Navigation.Navigate(path);
  Navigation.CloseSideMenus();
}

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

  if (!state) return null;

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
    <>
      <PanelSection title="Cloud">
        <PanelSectionRow>
          {state.connected ? (
            <ButtonItem
              layout="below"
              label={provider}
              description="Connected. Select to change or sign out."
              onClick={() => open(routes.provider)}
            >
              Manage
            </ButtonItem>
          ) : (
            <ButtonItem
              layout="below"
              description="Connect a cloud account to store your saves."
              onClick={() => open(routes.provider)}
            >
              Set up cloud provider
            </ButtonItem>
          )}
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
            <ButtonItem
              layout="below"
              label={game.name}
              description={lastSync(game.last_sync)}
              onClick={() => open(routes.game(game.id))}
            >
              Edit
            </ButtonItem>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Choose a game, its save folder, and where it goes in the cloud."
            onClick={() => open(routes.game("new"))}
          >
            Add game
          </ButtonItem>
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
    </>
  );
}
