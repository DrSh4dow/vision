import { useState } from "react";
import { AppHeader } from "./shell/app-header";
import { LeftDock, RightDock } from "./shell/docks";
import { ExportModal } from "./shell/export-modal";
import { InspectorPanel } from "./shell/inspector-panel";
import { LeftPanel } from "./shell/left-panel";
import { MobilePanels } from "./shell/mobile-panels";
import {
	formatOptions,
	type HeaderMenuId,
	type LayoutState,
	type Mode,
	objects,
	sectionTitle,
	sequencerBaseRows,
} from "./shell/model";
import {
	useEscape,
	useMenuDismiss,
	useMenuRefs,
	useMobile,
	usePersistLayout,
	useReducedMotion,
	useResize,
	useShellState,
} from "./shell/shell-state";
import { Stage } from "./shell/stage";
import { getInitialMode, LAYOUT_KEY, parseLayout } from "./shell/state";
import { StatusFooter } from "./shell/status-footer";

function App() {
	const [mode, setMode] = useState<Mode>(() => getInitialMode());
	const [layout, setLayout] = useState<LayoutState>(() =>
		parseLayout(globalThis.localStorage.getItem(LAYOUT_KEY)),
	);
	const [reducedMotion, setReducedMotion] = useReducedMotion();
	const [isMobile] = useMobile();
	const [menu, setMenu] = useState<HeaderMenuId | null>(null);
	const refs = useMenuRefs();
	const [state, setState] = useShellState();

	usePersistLayout(layout);
	useMenuDismiss(menu, setMenu, refs);
	useEscape(menu, setMenu, state.exportOpen, (next) =>
		setState((s) => ({ ...s, exportOpen: next })),
	);

	const left = layout.leftCollapsed ? 56 : layout.leftPanelWidth;
	const right = layout.rightCollapsed ? 56 : layout.rightPanelWidth;
	const selected =
		objects.find((item) => item.id === state.selectedObjectId) ?? objects[0];
	const selectedType = selected?.type ?? "vector";
	const selectedName =
		mode === "sequencer"
			? (sequencerBaseRows.find((row) => row.id === state.selectedSequencerId)
					?.name ?? "Circle - Outline")
			: (selected?.name ?? "Circle - Outline");
	const resize = useResize(layout, setLayout);

	return (
		<ShellLayout
			isMobile={isMobile}
			layout={layout}
			left={left}
			menu={menu}
			mode={mode}
			reducedMotion={reducedMotion}
			refs={refs}
			resize={resize}
			right={right}
			selectedName={selectedName}
			selectedType={selectedType}
			setLayout={setLayout}
			setMenu={setMenu}
			setMode={setMode}
			setReducedMotion={setReducedMotion}
			setState={setState}
			state={state}
		/>
	);
}

type LayoutProps = {
	isMobile: boolean;
	layout: LayoutState;
	menu: HeaderMenuId | null;
	mode: Mode;
	reducedMotion: boolean;
	refs: ReturnType<typeof useMenuRefs>;
	resize: ReturnType<typeof useResize>;
	right: number;
	selectedName: string;
	selectedType: "vector" | "image";
	setLayout: (next: (current: LayoutState) => LayoutState) => void;
	setMenu: (
		next:
			| HeaderMenuId
			| null
			| ((current: HeaderMenuId | null) => HeaderMenuId | null),
	) => void;
	setMode: (next: Mode) => void;
	setReducedMotion: (next: boolean) => void;
	setState: ReturnType<typeof useShellState>[1];
	state: ReturnType<typeof useShellState>[0];
	left: number;
};

function ShellLayout({
	isMobile,
	layout,
	menu,
	mode,
	reducedMotion,
	refs,
	resize,
	right,
	selectedName,
	selectedType,
	setLayout,
	setMenu,
	setMode,
	setReducedMotion,
	setState,
	state,
	left,
}: LayoutProps) {
	return (
		<div className="grid h-full grid-rows-[48px_1fr_24px] overflow-x-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
			<AppHeader
				editMenuRef={refs.edit}
				fileMenuRef={refs.file}
				mode={mode}
				openMenu={menu}
				pluginMenuRef={refs.plugins}
				setExportOpen={(next) => setState((s) => ({ ...s, exportOpen: next }))}
				setMode={setMode}
				toggleMenu={(next) =>
					setMenu((current) => (current === next ? null : next))
				}
			/>
			<ShellMain
				isMobile={isMobile}
				layout={layout}
				left={left}
				mode={mode}
				reducedMotion={reducedMotion}
				resize={resize}
				right={right}
				selectedType={selectedType}
				setLayout={setLayout}
				setReducedMotion={setReducedMotion}
				setState={setState}
				state={state}
			/>
			{isMobile ? (
				<MobileDock
					mode={mode}
					reducedMotion={reducedMotion}
					selectedType={selectedType}
					setReducedMotion={setReducedMotion}
					setState={setState}
					state={state}
				/>
			) : null}
			<StatusFooter selectedName={selectedName} />
			<ExportModal
				autoColorStops={state.autoColorStops}
				format={state.format}
				includeTrims={state.includeTrims}
				open={state.exportOpen}
				options={formatOptions}
				setAutoColorStops={(next) =>
					setState((s) => ({ ...s, autoColorStops: next }))
				}
				setFormat={(next) => setState((s) => ({ ...s, format: next }))}
				setIncludeTrims={(next) =>
					setState((s) => ({ ...s, includeTrims: next }))
				}
				setOpen={(next) => setState((s) => ({ ...s, exportOpen: next }))}
			/>
		</div>
	);
}

type MainProps = {
	isMobile: boolean;
	layout: LayoutState;
	left: number;
	mode: Mode;
	reducedMotion: boolean;
	resize: ReturnType<typeof useResize>;
	right: number;
	selectedType: "vector" | "image";
	setLayout: (next: (current: LayoutState) => LayoutState) => void;
	setReducedMotion: (next: boolean) => void;
	setState: ReturnType<typeof useShellState>[1];
	state: ReturnType<typeof useShellState>[0];
};

function ShellMain({
	isMobile,
	layout,
	left,
	mode,
	reducedMotion,
	resize,
	right,
	selectedType,
	setLayout,
	setReducedMotion,
	setState,
	state,
}: MainProps) {
	return (
		<main
			className="grid min-h-0"
			style={{
				gridTemplateColumns: isMobile
					? "minmax(0,1fr)"
					: `${left}px 8px minmax(0,1fr) 8px ${right}px`,
			}}
		>
			{isMobile ? null : (
				<LeftDock
					layout={layout}
					mode={mode}
					resize={resize}
					setLayout={setLayout}
					setState={setState}
					state={state}
				/>
			)}
			<Stage mode={mode} />
			{isMobile ? null : (
				<RightDock
					layout={layout}
					mode={mode}
					reducedMotion={reducedMotion}
					resize={resize}
					selectedType={selectedType}
					setLayout={setLayout}
					setReducedMotion={setReducedMotion}
					setState={setState}
					state={state}
				/>
			)}
		</main>
	);
}

type MobileDockProps = {
	mode: Mode;
	reducedMotion: boolean;
	selectedType: "vector" | "image";
	setReducedMotion: (next: boolean) => void;
	setState: ReturnType<typeof useShellState>[1];
	state: ReturnType<typeof useShellState>[0];
};

function MobileDock({
	mode,
	reducedMotion,
	selectedType,
	setReducedMotion,
	setState,
	state,
}: MobileDockProps) {
	return (
		<MobilePanels
			left={
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
			}
			leftTitle={sectionTitle(mode, "left")}
			right={
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
			}
			rightTitle={sectionTitle(mode, "right")}
		/>
	);
}

export { App };
