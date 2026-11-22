// Right-hand inspector: colour editor, semantic roles, contrast laboratory and colour-vision report.
import { t, tk, useLang } from "../i18n/i18n";
import { setState, useStore, type InspectorTab } from "../state/store";
import { ColourTab } from "./inspector/ColourTab";
import { RolesTab } from "./inspector/RolesTab";
import { ContrastTab } from "./inspector/ContrastTab";
import { VisionTab } from "./inspector/VisionTab";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "colour", label: tk("Colour") }, { id: "roles", label: tk("Roles") }, { id: "contrast", label: tk("Contrast") }, { id: "vision", label: tk("Vision") },
];

export function Inspector() {
  useLang();
  const tab = useStore((s) => s.tab);
  return (
    <div className="inspector">
      <div className="segmented insp-tabs" role="tablist" aria-label={t("Inspector")}>
        {TABS.map((x) => <button key={x.id} role="tab" id={`tab-${x.id}`} aria-controls={`panel-${x.id}`} aria-selected={tab === x.id} className={tab === x.id ? "on" : ""} onClick={() => setState({ tab: x.id })} data-testid={`insp-${x.id}`}>{t(x.label)}</button>)}
      </div>
      <div className="insp-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "colour" && <ColourTab />}
        {tab === "roles" && <RolesTab />}
        {tab === "contrast" && <ContrastTab />}
        {tab === "vision" && <VisionTab />}
      </div>
    </div>
  );
}
