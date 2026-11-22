import { FileSelectionType, openFilePicker } from "@decky/api";
import { ButtonItem, ConfirmModal, DropdownItem, Field, Navigation, showModal, useParams } from "@decky/ui";
import { useMemo, useState } from "react";
import { Game, removeGame, saveGame, syncGame } from "../backend";
import { DriveFolderModal } from "../components/DriveFolderModal";
import { Page } from "../components/Page";
import { folderName, installedGames, LibraryGame, runningGame } from "../library";
import { providerName, refresh, useStore } from "../store";

const DEFAULT_ROOT = "DeckSync";

function parentOf(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function suggestRemote(games: Game[], name: string) {
  const root = games.length ? parentOf(games[games.length - 1].remote_path) : DEFAULT_ROOT;
  return root ? `${root}/${folderName(name)}` : folderName(name);
}

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const existing = state?.games.find((game) => game.id === id) ?? null;
  const others = state?.games.filter((game) => game.id !== id) ?? [];

  const options = useMemo(() => {
    const taken = new Set(others.map((game) => game.app_id));
    const games = installedGames().filter((game) => !taken.has(game.appId));
    if (existing && !games.some((game) => game.appId === existing.app_id)) {
      games.unshift({ appId: existing.app_id, name: existing.name });
    }
    return games;
  }, [state]);

  const [selected, setSelected] = useState<LibraryGame | null>(() => {
    if (existing) return { appId: existing.app_id, name: existing.name };
    const running = runningGame();
    return running && options.some((game) => game.appId === running.appId) ? running : null;
  });
  const [localPath, setLocalPath] = useState(existing?.local_path ?? "");
  const [remotePath, setRemotePath] = useState(
    existing?.remote_path ?? (selected ? suggestRemote(others, selected.name) : ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!state) return null;
  const provider = providerName(state);

  const pickGame = (game: LibraryGame) => {
    if (!remotePath || (selected && remotePath === suggestRemote(others, selected.name))) {
      setRemotePath(suggestRemote(others, game.name));
    }
    setSelected(game);
  };

  const browseLocal = async () => {
    try {
      const result = await openFilePicker(FileSelectionType.FOLDER, localPath || state.home, false, true);
      setLocalPath(result.realpath || result.path);
    } catch {
      // Closing the picker rejects the promise.
    }
  };

  const browseRemote = () =>
    showModal(
      <DriveFolderModal
        provider={provider}
        initialPath={parentOf(remotePath) || DEFAULT_ROOT}
        suggestedName={selected ? folderName(selected.name) : ""}
        onSelect={setRemotePath}
      />,
    );

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const response = await saveGame({
      id: existing?.id,
      app_id: selected.appId,
      name: selected.name,
      local_path: localPath,
      remote_path: remotePath,
    });
    setBusy(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    await refresh();
    Navigation.NavigateBack();
  };

  const syncNow = async () => {
    if (!existing) return;
    setBusy(true);
    await syncGame(existing.id);
    await refresh();
    setBusy(false);
  };

  const remove = () =>
    existing &&
    showModal(
      <ConfirmModal
        strTitle={`Stop syncing ${existing.name}?`}
        strDescription={`Saves already in ${provider} are kept. Nothing on the Deck is deleted.`}
        strOKButtonText="Remove"
        bDestructiveWarning
        onOK={async () => {
          await removeGame(existing.id);
          await refresh();
          Navigation.NavigateBack();
        }}
      />,
    );

  return (
    <Page title={existing ? existing.name : "Add game"}>
      <DropdownItem
        label="Game"
        description="Saves sync when this game launches and exits."
        rgOptions={options.map((game) => ({ data: game.appId, label: game.name }))}
        selectedOption={selected?.appId}
        strDefaultLabel="Choose a game"
        onChange={(option) => {
          const game = options.find((candidate) => candidate.appId === option.data);
          if (game) pickGame(game);
        }}
      />
      <ButtonItem
        label="Save folder on the Deck"
        description={localPath || "The folder where the game or emulator writes its saves."}
        onClick={browseLocal}
      >
        Browse
      </ButtonItem>
      <ButtonItem
        label={`Folder in ${provider}`}
        description={
          remotePath
            ? `${remotePath}. Latest save goes in save/, replaced files move to history/ (newest ${state.history_limit} kept).`
            : "Where this game's saves are stored in the cloud."
        }
        disabled={!state.connected}
        onClick={browseRemote}
      >
        Browse
      </ButtonItem>
      {error && <Field focusable={false} description={<span style={{ color: "#ff6b6b" }}>{error}</span>} />}
      <ButtonItem
        layout="below"
        disabled={busy || !selected || !localPath || !remotePath || !state.connected}
        onClick={save}
      >
        {busy ? "Checking…" : "Save"}
      </ButtonItem>
      {existing && (
        <>
          <ButtonItem
            layout="below"
            description="Runs a sync for this game using the settings it was saved with."
            disabled={busy}
            onClick={syncNow}
          >
            Sync now
          </ButtonItem>
          <ButtonItem layout="below" disabled={busy} onClick={remove}>
            Remove game
          </ButtonItem>
        </>
      )}
    </Page>
  );
}
