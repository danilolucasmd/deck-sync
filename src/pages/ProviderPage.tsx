import { toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, Navigation, showModal } from "@decky/ui";
import { useState } from "react";
import { FaGoogleDrive } from "react-icons/fa";
import { IconType } from "react-icons";
import { logout, startLogin } from "../backend";
import { Page } from "../components/Page";
import { providerName, refresh, useStore } from "../store";

const icons: Record<string, IconType> = {
  gdrive: FaGoogleDrive,
};

export function ProviderPage() {
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

  return (
    <Page title="Cloud provider">
      {state.providers.map((provider) => {
        const Icon = icons[provider.id];
        const current = state.connected && state.provider === provider.id;
        return (
          <ButtonItem
            key={provider.id}
            icon={Icon && <Icon />}
            label={provider.name}
            description={
              current
                ? "Connected. Sign in again to switch accounts."
                : "Opens a browser to sign in and let DeckSync manage your saves folder."
            }
            disabled={pending !== null}
            onClick={() => signIn(provider.id)}
          >
            {pending === provider.id ? "Opening…" : current ? "Switch account" : "Sign in"}
          </ButtonItem>
        );
      })}
      {state.connected && (
        <ButtonItem
          label="Sign out"
          description="Removes the stored sign-in from this Deck."
          onClick={signOut}
        >
          Sign out
        </ButtonItem>
      )}
    </Page>
  );
}
