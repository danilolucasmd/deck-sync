import { ButtonItem, ConfirmModal, DropdownItem, Field, PanelSectionRow, showModal } from "@decky/ui";
import { useMemo } from "react";
import { useDraft } from "../draft";
import { Game, listLocalFolders, listRemoteFolders, removeGame, saveGame, syncGame } from "../backend";
import { FolderModal, parentPath } from "../components/FolderModal";
import { SubView } from "../components/SubView";
import { folderName, installedGames, LibraryGame, runningGame } from "../library";
import { providerName, refresh, useStore } from "../store";

const DEFAULT_ROOT = "DeckSync";

function suggestRemote(games: Game[], name: string) {
  const root = games.length ? parentPath(games[games.length - 1].remote_path) : DEFAULT_ROOT;
  return root ? `${root}/${folderName(name)}` : folderName(name);
}

interface Props {
  id: string | null;
  onBack(): void;
}

export function GameView({ id, onBack }: Props) {
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

  const key = `game:${id ?? "new"}`;
  const [selected, setSelected] = useDraft<LibraryGame | null>(`${key}:game`, () => {
    if (existing) return { appId: existing.app_id, name: existing.name };
    const running = runningGame();
    return running && options.some((game) => game.appId === running.appId) ? running : null;
  });
  const [localPath, setLocalPath] = useDraft(`${key}:local`, existing?.local_path ?? "");
  const [remotePath, setRemotePath] = useDraft(
    `${key}:remote`,
    existing?.remote_path ?? (selected ? suggestRemote(others, selected.name) : ""),
  );
  const [error, setError] = useDraft<string | null>(`${key}:error`, null);
  const [busy, setBusy] = useDraft(`${key}:busy`, false);

  if (!state) return null;
  const provider = providerName(state);

  const pickGame = (game: LibraryGame) => {
    if (!remotePath || (selected && remotePath === suggestRemote(others, selected.name))) {
      setRemotePath(suggestRemote(others, game.name));
    }
    setSelected(game);
  };

  const browseLocal = () =>
    showModal(
      <FolderModal
        initialPath={localPath || state.home}
        heading={(path) => path}
        list={listLocalFolders}
        onSelect={setLocalPath}
      />,
    );

  const browseRemote = () =>
    showModal(
      <FolderModal
        initialPath={parentPath(remotePath) || DEFAULT_ROOT}
        heading={(path) => `${provider} / ${path || "My Drive"}`}
        list={listRemoteFolders}
        onSelect={setRemotePath}
        newFolderName={selected ? folderName(selected.name) : ""}
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
    onBack();
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
          onBack();
        }}
      />,
    );

  return (
    <SubView title={existing ? existing.name : "Add game"} onBack={onBack}>
      <PanelSectionRow>
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
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          label="Save folder on the Deck"
          description={localPath || "The folder where the game or emulator writes its saves."}
          onClick={browseLocal}
        >
          Browse
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
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
      </PanelSectionRow>
      {error && (
        <PanelSectionRow>
          <Field focusable={false} description={<span style={{ color: "#ff6b6b" }}>{error}</span>} />
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={busy || !selected || !localPath || !remotePath || !state.connected}
          onClick={save}
        >
          {busy ? "Checking…" : "Save"}
        </ButtonItem>
      </PanelSectionRow>
      {existing && (
        <>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              description="Runs a sync for this game using the settings it was saved with."
              disabled={busy}
              onClick={syncNow}
            >
              Sync now
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy} onClick={remove}>
              Remove game
            </ButtonItem>
          </PanelSectionRow>
        </>
      )}
    </SubView>
  );
}
