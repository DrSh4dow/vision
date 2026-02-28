import {
	Badge,
	Button,
	cn,
	Input,
	Panel,
	SectionLabel,
	Tabs,
	Toggle,
} from "@vision/ui";
import {
	Bolt,
	Circle,
	Crop,
	Download,
	Layers,
	MousePointer2,
	Pencil,
	PenTool,
	Plus,
	RectangleHorizontal,
	RotateCw,
	Scan,
	Search,
	Send,
	Settings2,
	Share2,
	Sparkles,
	Square,
	Type,
	WandSparkles,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	activePluginLabels,
	editMenuActions,
	fileMenuActions,
	formatOptions,
	type HeaderMenuId,
	type LayoutState,
	type Mode,
	objects,
	type PanelSide,
	type PluginTabId,
	sectionTitle,
	sequencerBaseRows,
} from "./shell/model";
import {
	clampPanel,
	getInitialMode,
	hasStateFlag,
	LAYOUT_KEY,
	parseLayout,
	REDUCED_MOTION_KEY,
} from "./shell/state";
import {
	HeaderMenu,
	MiniSeparator,
	PanelColumn,
	PluginMenuItem,
	ResizeHandle,
	renderInspector,
	renderLeftPanel,
	ToolButton,
	ZoomActionButton,
} from "./shell/views";

export function App() {
	const [mode, setMode] = useState<Mode>(() => getInitialMode());
	const [layout, setLayout] = useState<LayoutState>(() =>
		parseLayout(globalThis.localStorage.getItem(LAYOUT_KEY)),
	);
	const [reducedMotion, setReducedMotion] = useState(() => {
		const persisted = globalThis.localStorage.getItem(REDUCED_MOTION_KEY);
		if (persisted === null) {
			return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
		}
		return persisted === "1";
	});
	const [objectsLoading] = useState(() => hasStateFlag("skeleton-objects"));
	const [sequencerLoading] = useState(() => hasStateFlag("skeleton-sequencer"));
	const [isMobile, setIsMobile] = useState(
		() => globalThis.matchMedia("(max-width: 767px)").matches,
	);
	const [selectedObjectId, setSelectedObjectId] = useState(
		objects[0]?.id ?? "circle",
	);
	const [selectedSequencerId, setSelectedSequencerId] = useState(
		sequencerBaseRows[0]?.id ?? "seq-1",
	);
	const [badgeOpen, setBadgeOpen] = useState(true);
	const [pluginTab, setPluginTab] = useState<PluginTabId>("thread");
	const [openMenu, setOpenMenu] = useState<HeaderMenuId | null>(null);
	const [exportOpen, setExportOpen] = useState(() =>
		hasStateFlag("export-open"),
	);
	const [format, setFormat] = useState(".DST");
	const [includeTrims, setIncludeTrims] = useState(true);
	const [autoColorStops, setAutoColorStops] = useState(true);
	const [trimAtEnd, setTrimAtEnd] = useState(true);
	const [showFabric, setShowFabric] = useState(true);
	const [showThreadEffect, setShowThreadEffect] = useState(true);
	const [showJumps, setShowJumps] = useState(false);
	const fileMenuRef = useRef<HTMLDivElement | null>(null);
	const editMenuRef = useRef<HTMLDivElement | null>(null);
	const pluginMenuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		globalThis.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
	}, [layout]);

	useEffect(() => {
		globalThis.localStorage.setItem(
			REDUCED_MOTION_KEY,
			reducedMotion ? "1" : "0",
		);
		document.documentElement.classList.toggle("reduce-motion", reducedMotion);
	}, [reducedMotion]);

	useEffect(() => {
		const media = globalThis.matchMedia("(max-width: 767px)");
		const handleChange = () => setIsMobile(media.matches);
		handleChange();
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (openMenu === null) {
				return;
			}

			const target = event.target as Node;
			const menuRefs: Record<HeaderMenuId, RefObject<HTMLDivElement | null>> = {
				file: fileMenuRef,
				edit: editMenuRef,
				plugins: pluginMenuRef,
			};

			const activeMenuRef = menuRefs[openMenu];
			if (activeMenuRef.current && !activeMenuRef.current.contains(target)) {
				setOpenMenu(null);
			}
		};
		globalThis.addEventListener("pointerdown", onPointerDown);
		return () => globalThis.removeEventListener("pointerdown", onPointerDown);
	}, [openMenu]);

	useEffect(() => {
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}
			if (openMenu !== null) {
				setOpenMenu(null);
			}
			if (exportOpen) {
				setExportOpen(false);
			}
		};

		globalThis.addEventListener("keydown", onEscape);
		return () => globalThis.removeEventListener("keydown", onEscape);
	}, [openMenu, exportOpen]);

	const toggleMenu = (menu: HeaderMenuId) => {
		setOpenMenu((current) => (current === menu ? null : menu));
	};

	const leftWidth = layout.leftCollapsed ? 56 : layout.leftPanelWidth;
	const rightWidth = layout.rightCollapsed ? 56 : layout.rightPanelWidth;

	const selectedObject =
		objects.find((item) => item.id === selectedObjectId) ?? objects[0];
	const selectedType = selectedObject?.type ?? "vector";
	const selectedName =
		mode === "sequencer"
			? (sequencerBaseRows.find((row) => row.id === selectedSequencerId)
					?.name ?? "Circle - Outline")
			: (selectedObject?.name ?? "Circle - Outline");

	const startResize = (
		side: PanelSide,
		event: ReactPointerEvent<HTMLElement>,
	) => {
		event.preventDefault();
		const originX = event.clientX;
		const originWidth =
			side === "left" ? layout.leftPanelWidth : layout.rightPanelWidth;

		const onMove = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientX - originX;
			setLayout((current) => {
				if (side === "left") {
					return {
						...current,
						leftCollapsed: false,
						leftPanelWidth: clampPanel(originWidth + delta),
					};
				}
				return {
					...current,
					rightCollapsed: false,
					rightPanelWidth: clampPanel(originWidth - delta),
				};
			});
		};

		const onUp = () => {
			globalThis.removeEventListener("pointermove", onMove);
			globalThis.removeEventListener("pointerup", onUp);
		};

		globalThis.addEventListener("pointermove", onMove);
		globalThis.addEventListener("pointerup", onUp);
	};

	return (
		<div className="grid h-full grid-rows-[48px_1fr_24px] overflow-x-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
			<header className="relative z-30 grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 border-[color:var(--toolbar-border)] border-b bg-[color:var(--toolbar)] px-3 backdrop-blur-xl max-md:grid-cols-[1fr_auto] max-md:gap-2 max-md:px-2">
				<div className="flex items-center gap-3 max-md:gap-2">
					<div className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--primary)] shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_35%,transparent)]">
						<Layers className="h-4 w-4 text-[color:var(--primary-foreground)]" />
					</div>
					<p className="m-0 font-extrabold text-[15px] tracking-tight">
						Vision
					</p>
					<nav
						aria-label="Application"
						className="relative flex items-center gap-1 max-md:hidden"
					>
						<HeaderMenu
							actions={fileMenuActions}
							label="File"
							menuId="file"
							menuRef={fileMenuRef}
							onToggle={toggleMenu}
							openMenu={openMenu}
						/>
						<HeaderMenu
							actions={editMenuActions}
							label="Edit"
							menuId="edit"
							menuRef={editMenuRef}
							onToggle={toggleMenu}
							openMenu={openMenu}
						/>
						<div className="relative" ref={pluginMenuRef}>
							<button
								aria-expanded={openMenu === "plugins"}
								aria-haspopup="menu"
								className={cn(
									"inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
									openMenu === "plugins" &&
										"bg-[color:var(--active-bg)] text-[color:var(--text-primary)]",
								)}
								onClick={() => toggleMenu("plugins")}
								type="button"
							>
								Plugins <Badge>4</Badge>
							</button>
							{openMenu === "plugins" ? (
								<div
									className="absolute top-[calc(100%+4px)] left-0 z-50 w-60 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface)] p-1.5 shadow-2xl"
									role="menu"
								>
									<PluginMenuItem
										icon={<Settings2 className="h-3.5 w-3.5" />}
										label="Manage Plugins"
									/>
									<PluginMenuItem
										icon={<Sparkles className="h-3.5 w-3.5" />}
										label="Marketplace"
									/>
									<PluginMenuItem
										icon={<RotateCw className="h-3.5 w-3.5" />}
										label="Check Updates"
									/>
									<div className="my-1 h-px bg-[color:var(--border-subtle)]" />
									<p className="m-0 px-2.5 py-1 font-bold text-[9px] text-[color:var(--text-ghost)] uppercase tracking-[0.12em]">
										Active
									</p>
									{activePluginLabels.map((label) => (
										<PluginMenuItem
											icon={
												<WandSparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />
											}
											key={label}
											label={label}
											status
										/>
									))}
								</div>
							) : null}
						</div>
					</nav>
					<div className="h-5 w-px bg-[color:var(--border-subtle)] max-md:hidden" />
					<Tabs
						className="max-md:hidden"
						label="Mode"
						onChange={(next) => setMode(next as Mode)}
						options={[
							{ value: "objects", label: "Objects" },
							{ value: "sequencer", label: "Sequencer" },
							{ value: "preview", label: "Preview" },
						]}
						value={mode}
						variant="mode"
					/>
				</div>
				<div className="mx-auto w-full max-w-[420px] max-md:hidden">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-ghost)]" />
						<Input
							aria-label="Command search"
							className="h-8 border-[color:var(--border-subtle)] bg-[color:var(--input)] pl-8 text-[12px] placeholder:text-[color:var(--text-ghost)]"
							placeholder="Search commands... ⌘K"
						/>
					</div>
				</div>
				<div className="flex justify-center max-md:order-last max-md:col-span-2 md:hidden">
					<Tabs
						label="Mode"
						onChange={(next) => setMode(next as Mode)}
						options={[
							{ value: "objects", label: "Objects" },
							{ value: "sequencer", label: "Sequencer" },
							{ value: "preview", label: "Preview" },
						]}
						value={mode}
						variant="mode"
					/>
				</div>
				<div className="inline-flex items-center gap-1.5 justify-self-end">
					<Button
						className="h-8 rounded-lg border border-[color:var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_66%,transparent)] px-2.5 font-medium text-[12px] text-[color:var(--text-secondary)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)] max-md:px-2"
						variant="ghost"
					>
						<Share2 className="h-3.5 w-3.5" />
						<span className="max-md:hidden">Share</span>
					</Button>
					<Button
						className="h-8 rounded-lg border border-transparent bg-[color:var(--primary)] px-3 font-semibold text-[12px] text-[color:var(--primary-foreground)] shadow-[0_6px_14px_color-mix(in_srgb,var(--primary)_30%,transparent)] hover:brightness-110"
						onClick={() => setExportOpen(true)}
						variant="ghost"
					>
						<Download className="h-3.5 w-3.5" />
						Export
					</Button>
				</div>
			</header>

			<main
				className="grid min-h-0"
				style={{
					gridTemplateColumns: isMobile
						? "minmax(0,1fr)"
						: `${leftWidth}px 8px minmax(0,1fr) 8px ${rightWidth}px`,
				}}
			>
				{isMobile ? null : (
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
						{renderLeftPanel({
							mode,
							objectsLoading,
							sequencerLoading,
							selectedObjectId,
							setSelectedObjectId,
							selectedSequencerId,
							setSelectedSequencerId,
							badgeOpen,
							setBadgeOpen,
						})}
					</PanelColumn>
				)}

				{isMobile ? null : (
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
						onPointerDown={(event) => startResize("left", event)}
					/>
				)}

				<section className="relative min-h-0 min-w-0 overflow-hidden bg-[color:var(--canvas)]">
					{mode !== "preview" ? (
						<div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface)]/90 p-1.5 shadow-2xl backdrop-blur-lg">
							<div className="pointer-events-auto flex items-center gap-1">
								<ToolButton
									active
									icon={<MousePointer2 className="h-4 w-4" />}
									label="Select tool"
								/>
								<MiniSeparator />
								<ToolButton
									icon={<PenTool className="h-4 w-4" />}
									label="Pen tool"
								/>
								<ToolButton
									icon={<Pencil className="h-4 w-4" />}
									label="Freehand tool"
								/>
								<MiniSeparator />
								<ToolButton
									icon={<Circle className="h-4 w-4" />}
									label="Ellipse tool"
								/>
								<ToolButton
									icon={<Square className="h-4 w-4" />}
									label="Rectangle tool"
								/>
								<MiniSeparator />
								<ToolButton
									icon={<Type className="h-4 w-4" />}
									label="Text tool"
								/>
							</div>
						</div>
					) : null}
					<div className="absolute top-4 right-4 z-20 font-medium text-[9px] text-[color:var(--text-ghost)]">
						RENDER_ENGINE v2.1
					</div>
					<div className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_7%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]">
						<div
							className="relative grid place-items-center border border-[color:var(--primary-faint)]"
							style={{
								width: "min(calc(100% - 56px), 620px)",
								height: "min(calc(100% - 56px), 620px)",
							}}
						>
							<span className="absolute top-[-18px] left-0 font-medium text-[9px] text-[color:var(--text-ghost)]">
								100 x 100 mm
							</span>
							<span className="absolute top-[-18px] right-0 inline-flex items-center gap-1 font-medium text-[9px] text-[color:var(--text-ghost)]">
								<Crop className="h-2.5 w-2.5" /> Brother PE910L
							</span>
							<div className="relative h-56 w-56 md:h-64 md:w-64">
								<div className="absolute inset-0 rounded-full border-2 border-[color:var(--primary)]/70 shadow-[0_0_40px_color-mix(in_srgb,var(--primary)_12%,transparent)]" />
								<svg
									aria-hidden="true"
									className="absolute inset-0 h-full w-full opacity-55"
									viewBox="0 0 100 100"
								>
									<path
										d="M50 10 L90 90 L10 90 Z"
										fill="none"
										stroke="var(--primary)"
										strokeWidth="0.7"
									/>
									<circle
										cx="50"
										cy="50"
										fill="none"
										r="30"
										stroke="var(--primary)"
										strokeDasharray="2 1.5"
										strokeWidth="0.5"
									/>
								</svg>
								<div className="absolute inset-0 grid place-items-center text-[color:var(--primary)]/50">
									<Sparkles className="h-12 w-12" />
								</div>
							</div>
						</div>
					</div>
					<div className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--surface)]/90 px-1.5 py-1 backdrop-blur-md">
						<ZoomActionButton
							icon={<ZoomOut className="h-3.5 w-3.5" />}
							label="Zoom out"
						/>
						<span className="min-w-10 px-1 text-center font-semibold text-[10px] text-[color:var(--text-secondary)]">
							100%
						</span>
						<ZoomActionButton
							icon={<ZoomIn className="h-3.5 w-3.5" />}
							label="Zoom in"
						/>
						<div className="mx-0.5 h-3.5 w-px bg-[color:var(--border-subtle)]" />
						<ZoomActionButton
							icon={<Scan className="h-3.5 w-3.5" />}
							label="Center design"
						/>
						<ZoomActionButton
							icon={<RectangleHorizontal className="h-3.5 w-3.5" />}
							label="Fit screen"
						/>
					</div>
				</section>

				{isMobile ? null : (
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
						onPointerDown={(event) => startResize("right", event)}
					/>
				)}

				{isMobile ? null : (
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
						{renderInspector({
							mode,
							reducedMotion,
							setReducedMotion,
							showFabric,
							setShowFabric,
							showThreadEffect,
							setShowThreadEffect,
							showJumps,
							setShowJumps,
							selectedType,
							pluginTab,
							setPluginTab,
							trimAtEnd,
							setTrimAtEnd,
						})}
					</PanelColumn>
				)}
			</main>

			{isMobile ? (
				<div className="grid gap-2 border-[color:var(--border-subtle)] border-t bg-[color:var(--surface)] p-2 md:hidden">
					<details open>
						<summary className="cursor-pointer rounded-md bg-[color:var(--surface-elevated)] px-2 py-1.5 font-semibold text-[11px] text-[color:var(--text-secondary)]">
							{sectionTitle(mode, "left")}
						</summary>
						<div className="mt-2 max-h-48 overflow-auto rounded-md border border-[color:var(--border-default)] p-2">
							{renderLeftPanel({
								mode,
								objectsLoading,
								sequencerLoading,
								selectedObjectId,
								setSelectedObjectId,
								selectedSequencerId,
								setSelectedSequencerId,
								badgeOpen,
								setBadgeOpen,
							})}
						</div>
					</details>
					<details>
						<summary className="cursor-pointer rounded-md bg-[color:var(--surface-elevated)] px-2 py-1.5 font-semibold text-[11px] text-[color:var(--text-secondary)]">
							{sectionTitle(mode, "right")}
						</summary>
						<div className="mt-2 max-h-64 overflow-auto rounded-md border border-[color:var(--border-default)] p-2">
							{renderInspector({
								mode,
								reducedMotion,
								setReducedMotion,
								showFabric,
								setShowFabric,
								showThreadEffect,
								setShowThreadEffect,
								showJumps,
								setShowJumps,
								selectedType,
								pluginTab,
								setPluginTab,
								trimAtEnd,
								setTrimAtEnd,
							})}
						</div>
					</details>
				</div>
			) : null}

			<footer className="flex items-center justify-between border-[color:var(--toolbar-border)] border-t bg-[color:var(--footer)] px-3 text-[9px] text-[color:var(--text-muted)]">
				<div className="flex items-center gap-3 overflow-hidden">
					<span className="inline-flex items-center gap-1.5">
						<span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-ready)]" />{" "}
						Ready
					</span>
					<div className="h-2.5 w-px bg-[color:var(--border-subtle)]" />
					<span className="truncate">{selectedName}</span>
					<span className="text-[color:var(--text-ghost)] max-md:hidden">
						X: 12.4 Y: -4.2 mm
					</span>
				</div>
				<div className="flex items-center gap-3">
					<span className="max-md:hidden">38,840 st</span>
					<span className="max-md:hidden">82.4 x 76.1 mm</span>
					<span className="inline-flex items-center gap-1 text-[color:var(--primary)]">
						<Bolt className="h-2.5 w-2.5" /> GPU Active
					</span>
					<span>v1.0.4</span>
				</div>
			</footer>

			{exportOpen ? (
				<div
					aria-label="Export Design"
					aria-modal="true"
					className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 backdrop-blur-sm"
					onPointerDown={(event) => {
						if (event.target === event.currentTarget) {
							setExportOpen(false);
						}
					}}
					role="dialog"
				>
					<div
						className="w-full max-w-[480px] rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface)] shadow-2xl"
						onPointerDown={(event) => event.stopPropagation()}
					>
						<div className="flex items-center justify-between border-[color:var(--border-subtle)] border-b p-6">
							<div>
								<p className="m-0 font-bold text-[color:var(--text-primary)] text-base">
									Export Design
								</p>
								<p className="m-0 mt-1 text-[11px] text-[color:var(--text-muted)]">
									Choose format for machine output
								</p>
							</div>
							<Button
								aria-label="Close export"
								onClick={() => setExportOpen(false)}
								size="icon"
								variant="ghost"
							>
								<Plus className="h-4 w-4 rotate-45" />
							</Button>
						</div>
						<div className="grid gap-5 p-6">
							<div className="grid gap-2.5">
								<SectionLabel>Machine Format</SectionLabel>
								<div className="grid grid-cols-4 gap-2">
									{formatOptions.map((option) => (
										<button
											className={cn(
												"rounded-lg border px-2 py-2 font-semibold text-[11px] transition-colors",
												format === option
													? "border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
													: "border-[color:var(--border-default)] text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
											)}
											key={option}
											onClick={() => setFormat(option)}
											type="button"
										>
											{option}
										</button>
									))}
								</div>
							</div>
							<div className="h-px bg-[color:var(--border-subtle)]" />
							<div className="grid gap-3">
								<SectionLabel>Options</SectionLabel>
								<div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
									<span>Include trims</span>
									<Toggle
										checked={includeTrims}
										label="Include trims"
										onChange={setIncludeTrims}
									/>
								</div>
								<div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
									<span>Auto color stops</span>
									<Toggle
										checked={autoColorStops}
										label="Auto color stops"
										onChange={setAutoColorStops}
									/>
								</div>
							</div>
							<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
								<div className="flex items-start gap-2 text-[10px] text-[color:var(--text-muted)]">
									<Send className="mt-0.5 h-3.5 w-3.5" />
									<p className="m-0">
										{format} format. Max stitch length: 121 pts. Auto-split if
										needed.
									</p>
								</div>
							</Panel>
						</div>
						<div className="flex items-center justify-end gap-3 border-[color:var(--border-subtle)] border-t p-6">
							<Button onClick={() => setExportOpen(false)} variant="ghost">
								Cancel
							</Button>
							<Button variant="primary">Export {format}</Button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
