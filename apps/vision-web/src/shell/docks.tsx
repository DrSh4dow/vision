import type { PointerEvent as ReactPointerEvent } from "react";
import { PanelColumn, ResizeHandle } from "./chrome";
import { InspectorPanel } from "./inspector-panel";
import { LeftPanel } from "./left-panel";
import {
	type LayoutState,
	type Mode,
	type PanelSide,
	sectionTitle,
} from "./model";
import type { ShellState } from "./shell-state";
import { clampPanel } from "./state";

type LeftDockProps = {
	layout: LayoutState;
	mode: Mode;
	resize: (side: PanelSide, event: ReactPointerEvent<HTMLElement>) => void;
	setLayout: (next: (current: LayoutState) => LayoutState) => void;
	state: ShellState;
	setState: (next: (current: ShellState) => ShellState) => void;
};

function LeftDock({
	layout,
	mode,
	resize,
	setLayout,
	state,
	setState,
}: LeftDockProps) {
	return (
		<>
			<PanelColumn
				collapsed={layout.leftCollapsed}
				labelPrefix="Objects"
				onToggle={() =>
					setLayout((current) => ({
						...current,
						leftCollapsed: !current.leftCollapsed,
					}))
				}
				title={sectionTitle(mode, "left")}
				toggleIcon={layout.leftCollapsed ? ">" : "<"}
			>
				<LeftPanel
					badgeOpen={state.badgeOpen}
					mode={mode}
					objectsLoading={state.objectsLoading}
					selectedObjectId={state.selectedObjectId}
					selectedSequencerId={state.selectedSequencerId}
					sequencerLoading={state.sequencerLoading}
					setBadgeOpen={(next) => setState((s) => ({ ...s, badgeOpen: next }))}
					setSelectedObjectId={(next) =>
						setState((s) => ({ ...s, selectedObjectId: next }))
					}
					setSelectedSequencerId={(next) =>
						setState((s) => ({ ...s, selectedSequencerId: next }))
					}
				/>
			</PanelColumn>
			<ResizeHandle
				label="Resize left panel"
				onArrowLeft={() =>
					setLayout((current) => ({
						...current,
						leftPanelWidth: clampPanel(current.leftPanelWidth - 16),
					}))
				}
				onArrowRight={() =>
					setLayout((current) => ({
						...current,
						leftPanelWidth: clampPanel(current.leftPanelWidth + 16),
					}))
				}
				onPointerDown={(event) => resize("left", event)}
			/>
		</>
	);
}

type RightDockProps = {
	layout: LayoutState;
	mode: Mode;
	reducedMotion: boolean;
	resize: (side: PanelSide, event: ReactPointerEvent<HTMLElement>) => void;
	selectedType: "vector" | "image";
	setLayout: (next: (current: LayoutState) => LayoutState) => void;
	setReducedMotion: (next: boolean) => void;
	state: ShellState;
	setState: (next: (current: ShellState) => ShellState) => void;
};

function RightDock({
	layout,
	mode,
	reducedMotion,
	resize,
	selectedType,
	setLayout,
	setReducedMotion,
	state,
	setState,
}: RightDockProps) {
	return (
		<>
			<ResizeHandle
				label="Resize right panel"
				onArrowLeft={() =>
					setLayout((current) => ({
						...current,
						rightPanelWidth: clampPanel(current.rightPanelWidth + 16),
					}))
				}
				onArrowRight={() =>
					setLayout((current) => ({
						...current,
						rightPanelWidth: clampPanel(current.rightPanelWidth - 16),
					}))
				}
				onPointerDown={(event) => resize("right", event)}
			/>
			<PanelColumn
				collapsed={layout.rightCollapsed}
				labelPrefix={sectionTitle(mode, "right")}
				onToggle={() =>
					setLayout((current) => ({
						...current,
						rightCollapsed: !current.rightCollapsed,
					}))
				}
				title={sectionTitle(mode, "right")}
				toggleIcon={layout.rightCollapsed ? "<" : ">"}
			>
				<InspectorPanel
					mode={mode}
					pluginTab={state.pluginTab}
					reducedMotion={reducedMotion}
					selectedType={selectedType}
					setPluginTab={(next) => setState((s) => ({ ...s, pluginTab: next }))}
					setReducedMotion={setReducedMotion}
					setShowFabric={(next) =>
						setState((s) => ({ ...s, showFabric: next }))
					}
					setShowJumps={(next) => setState((s) => ({ ...s, showJumps: next }))}
					setShowThreadEffect={(next) =>
						setState((s) => ({ ...s, showThreadEffect: next }))
					}
					setTrimAtEnd={(next) => setState((s) => ({ ...s, trimAtEnd: next }))}
					showFabric={state.showFabric}
					showJumps={state.showJumps}
					showThreadEffect={state.showThreadEffect}
					trimAtEnd={state.trimAtEnd}
				/>
			</PanelColumn>
		</>
	);
}

export { LeftDock, RightDock };
