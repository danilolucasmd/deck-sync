import { DialogButton, Focusable, ModalRoot, Spinner, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaArrowUp, FaFolder } from "react-icons/fa";
import { listRemoteFolders } from "../backend";

interface Props {
  provider: string;
  initialPath: string;
  suggestedName: string;
  onSelect(path: string): void;
  closeModal?(): void;
}

function join(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name;
}

function parentOf(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

export function DriveFolderModal({ provider, initialPath, suggestedName, onSelect, closeModal }: Props) {
  const [path, setPath] = useState(initialPath);
  const [folders, setFolders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState(suggestedName);

  useEffect(() => {
    let current = true;
    setFolders(null);
    setError(null);
    listRemoteFolders(path)
      .then((result) => current && setFolders(result))
      .catch((reason) => current && setError(String(reason)));
    return () => {
      current = false;
    };
  }, [path]);

  const choose = (selected: string) => {
    onSelect(selected);
    closeModal?.();
  };

  return (
    <ModalRoot onCancel={closeModal}>
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>{provider} / {path || "My Drive"}</div>
      <Focusable style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "40vh", overflowY: "auto" }}>
        {path && (
          <DialogButton onClick={() => setPath(parentOf(path))}>
            <FaArrowUp /> Up
          </DialogButton>
        )}
        {folders === null && !error && <Spinner style={{ height: "32px" }} />}
        {error && <div>{error}</div>}
        {folders?.map((folder) => (
          <DialogButton key={folder} onClick={() => setPath(join(path, folder))}>
            <FaFolder /> {folder}
          </DialogButton>
        ))}
        {folders?.length === 0 && <div style={{ opacity: 0.6 }}>No folders here.</div>}
      </Focusable>
      <TextField
        label="New folder"
        description="A folder inside the current one. It's created on the first backup."
        value={newName}
        onChange={(event) => setNewName(event.target.value)}
      />
      <Focusable style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <DialogButton disabled={!newName.trim()} onClick={() => choose(join(path, newName.trim()))}>
          Use new folder
        </DialogButton>
        <DialogButton disabled={!path} onClick={() => choose(path)}>
          Use this folder
        </DialogButton>
      </Focusable>
    </ModalRoot>
  );
}
