import { ConfirmModal, TextField } from "@decky/ui";
import { useState } from "react";

interface Props {
  provider: string;
  clientId: string;
  onSave(clientId: string, clientSecret: string): Promise<void>;
  closeModal?(): void;
}

export function CredentialsModal({ provider, clientId, onSave, closeModal }: Props) {
  const [id, setId] = useState(clientId);
  const [secret, setSecret] = useState("");

  return (
    <ConfirmModal
      strTitle={`Your own ${provider} app`}
      strDescription="Paste the client ID and secret of an OAuth app from your own Google Cloud project. Leave both empty to go back to rclone's shared app. Sign in again after saving."
      strOKButtonText="Save"
      onOK={() => onSave(id, secret)}
      closeModal={closeModal}
    >
      <TextField label="Client ID" value={id} onChange={(event) => setId(event.target.value)} />
      <TextField
        label="Client secret"
        bIsPassword
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
      />
    </ConfirmModal>
  );
}
