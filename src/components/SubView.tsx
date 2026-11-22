import { Focusable, PanelSection } from "@decky/ui";
import { ReactNode } from "react";

interface Props {
  title: string;
  onBack(): void;
  children: ReactNode;
}

export function SubView({ title, onBack, children }: Props) {
  return (
    <Focusable
      onCancelButton={(event) => {
        event.stopPropagation();
        onBack();
      }}
    >
      <PanelSection title={title}>
        {children}
      </PanelSection>
    </Focusable>
  );
}
