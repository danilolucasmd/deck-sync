import { DialogButton, Focusable, ModalRoot, Spinner, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaArrowUp, FaFolder } from "react-icons/fa";

interface Props {
  initialPath: string;
  heading(path: string): string;
  list(path: string): Promise<string[]>;
  onSelect(path: string): void;
  newFolderName?: string;
  closeModal?(): void;
}

export function joinPath(parent: string, name: string) {
  if (!parent) return name;
  return parent.endsWith("/") ? parent + name : `${parent}/${name}`;
}

export function parentPath(path: string) {
  const index = path.lastIndexOf("/");
  if (index < 0) return "";
  return index === 0 ? "/" : path.slice(0, index);
}

export function FolderModal({ initialPath, heading, list, onSelect, newFolderName, closeModal }: Props) {
  const [path, setPath] = useState(initialPath);
  const [folders, setFolders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState(newFolderName ?? "");
  const atRoot = path === "" || path === "/";

  useEffect(() => {
    let current = true;
    setFolders(null);
    setError(null);
    list(path)
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
      <div style={{ fontWeight: "bold", marginBottom: "8px", overflowWrap: "anywhere" }}>{heading(path)}</div>
      <Focusable style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "30vh", overflowY: "auto" }}>
        {!atRoot && (
          <DialogButton onClick={() => setPath(parentPath(path))}>
            <FaArrowUp /> Up
          </DialogButton>
        )}
        {folders === null && !error && <Spinner style={{ height: "32px" }} />}
        {error && <div>{error}</div>}
        {folders?.map((folder) => (
          <DialogButton key={folder} onClick={() => setPath(joinPath(path, folder))}>
            <FaFolder /> {folder}
          </DialogButton>
        ))}
        {folders?.length === 0 && <div style={{ opacity: 0.6 }}>No folders here.</div>}
      </Focusable>
      {newFolderName !== undefined && (
        <TextField
          label="New folder"
          description="A folder inside the current one. It's created on the first backup."
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
      )}
      <Focusable style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        {newFolderName !== undefined && (
          <DialogButton disabled={!newName.trim()} onClick={() => choose(joinPath(path, newName.trim()))}>
            Use new folder
          </DialogButton>
        )}
        <DialogButton disabled={path === ""} onClick={() => choose(path)}>
          Use this folder
        </DialogButton>
      </Focusable>
    </ModalRoot>
  );
}
