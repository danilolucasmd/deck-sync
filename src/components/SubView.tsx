import { ButtonItem, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { ReactNode } from "react";
import { FaChevronLeft } from "react-icons/fa";

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
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onBack}>
            <FaChevronLeft style={{ marginRight: "6px" }} />
            Back
          </ButtonItem>
        </PanelSectionRow>
        {children}
      </PanelSection>
    </Focusable>
  );
}
