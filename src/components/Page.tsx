import { DialogBody, DialogControlsSection, DialogControlsSectionHeader } from "@decky/ui";
import { ReactNode } from "react";

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: "40px", height: "calc(100% - 40px)", overflowY: "auto" }}>
      <DialogBody>
        <DialogControlsSection>
          <DialogControlsSectionHeader>{title}</DialogControlsSectionHeader>
          {children}
        </DialogControlsSection>
      </DialogBody>
    </div>
  );
}
