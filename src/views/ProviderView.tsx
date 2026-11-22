import { toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, DialogButton, Field, Focusable, Navigation, PanelSectionRow, showModal } from "@decky/ui";
import { Fragment, useState } from "react";
import { FaGoogleDrive } from "react-icons/fa";
import { IconType } from "react-icons";
import { logout, Provider, setCredentials, startLogin } from "../backend";
import { CredentialsModal } from "../components/CredentialsModal";
import { SubView } from "../components/SubView";
import { providerName, refresh, useStore } from "../store";

const buttonStyle = { flex: 1, minWidth: 0 };
const destructiveStyle = { backgroundColor: "#c42b2b", color: "#ffffff" };

const icons: Record<string, IconType> = {
  gdrive: FaGoogleDrive,
};

export function ProviderView({ onBack }: { onBack(): void }) {
  const { state } = useStore();
  const [pending, setPending] = useState<string | null>(null);

  if (!state) return null;

  const signIn = async (providerId: string) => {
    setPending(providerId);
    try {
      Navigation.NavigateToExternalWeb(await startLogin(providerId));
    } catch (error) {
      toaster.toast({ title: "Sign-in failed", body: String(error) });
    } finally {
      setPending(null);
    }
  };

  const signOut = () =>
    showModal(
      <ConfirmModal
        strTitle={`Sign out of ${providerName(state)}?`}
        strDescription="Your saves stay in the cloud. Automatic backups stop until you sign in again."
        strOKButtonText="Sign out"
        bDestructiveWarning
        onOK={async () => {
          await logout();
          await refresh();
        }}
      />,
    );

  const editCredentials = (provider: Provider) =>
    showModal(
      <CredentialsModal
        provider={provider.name}
        clientId={state.credentials[provider.id] ?? ""}
        onSave={async (clientId, clientSecret) => {
          await setCredentials(provider.id, clientId, clientSecret);
          await refresh();
        }}
      />,
    );

  return (
    <SubView title="Cloud provider" onBack={onBack}>
      {state.providers.map((provider) => {
        const Icon = icons[provider.id];
        const current = state.connected && state.provider === provider.id;
        return (
          <Fragment key={provider.id}>
            <PanelSectionRow>
              <Field
                icon={Icon && <Icon />}
                label={provider.name}
                description={
                  current
                    ? `Connected. Switch to use a different ${provider.name} account, or sign out to remove it from this Deck.`
                    : "Opens a browser to sign in and let DeckSync manage your saves folder."
                }
                childrenLayout="below"
              >
                <Focusable style={{ display: "flex", gap: "8px" }}>
                  <DialogButton
                    style={buttonStyle}
                    disabled={pending !== null}
                    onClick={() => signIn(provider.id)}
                  >
                    {pending === provider.id ? "Opening…" : current ? "Switch account" : "Sign in"}
                  </DialogButton>
                  {current && (
                    <DialogButton style={{ ...buttonStyle, ...destructiveStyle }} onClick={signOut}>
                      Sign out
                    </DialogButton>
                  )}
                </Focusable>
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                description={
                  state.credentials[provider.id]
                    ? "Signing in with your own app. Sign in again after changing it."
                    : "Optional. Your own OAuth app avoids the rate limits of rclone's shared one."
                }
                onClick={() => editCredentials(provider)}
              >
                {state.credentials[provider.id] ? "Change app credentials" : "Use your own app"}
              </ButtonItem>
            </PanelSectionRow>
          </Fragment>
        );
      })}
    </SubView>
  );
}
