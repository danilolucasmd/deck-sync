import { toaster } from "@decky/api";
import { SyncResult } from "./backend";

function files(count: number) {
  return count === 1 ? "1 file" : `${count} files`;
}

export function notifySync(result: SyncResult, provider: string, enabled: boolean) {
  if (result.error) {
    toaster.toast({
      title: result.action === "skipped" ? `${result.name} not backed up` : `Couldn't sync ${result.name}`,
      body: result.error,
    });
    return;
  }
  if (!enabled) return;

  if (result.action === "uploaded") {
    toaster.toast({ title: "Saves backed up", body: `${result.name} · ${files(result.files)} sent to ${provider}` });
  } else if (result.action === "downloaded") {
    toaster.toast({ title: "Saves restored", body: `${result.name} · ${files(result.files)} pulled from ${provider}` });
  }
}
