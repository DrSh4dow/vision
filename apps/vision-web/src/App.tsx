import {
	Badge,
	Button,
	cn,
	EmptyState,
	IconButton,
	Input,
	Panel,
	SectionLabel,
	Skeleton,
	Tabs,
	Toggle,
} from "@vision/ui";
import {
	AlignCenter,
	AlignHorizontalDistributeCenter,
	AlignHorizontalDistributeEnd,
	AlignHorizontalDistributeStart,
	AlignVerticalDistributeCenter,
	AlignVerticalDistributeEnd,
	AlignVerticalDistributeStart,
	Bolt,
	Circle,
	CircleDot,
	Crop,
	Diamond,
	Download,
	Eye,
	FileImage,
	Folder,
	GripVertical,
	Image,
	Layers,
	Lock,
	MousePointer2,
	MoveHorizontal,
	MoveVertical,
	PaintBucket,
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
	Star,
	Type,
	WandSparkles,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type {
	ReactNode,
	PointerEvent as ReactPointerEvent,
	RefObject,
} from "react";
import { useEffect, useRef, useState } from "react";
import {
	activePluginLabels,
	editMenuActions,
	fileMenuActions,
	formatOptions,
	type HeaderMenuAction,
	type HeaderMenuId,
	type LayoutState,
	type Mode,
	type ObjectIcon,
	objects,
	type PanelSide,
	type PluginTabId,
	pluginTabs,
	type SequencerRow,
	sectionTitle,
	sequencerBaseRows,
	sequencerGroupedRows,
	subtleInputClass,
} from "./shell/model";
import {
	clampPanel,
	getInitialMode,
	hasStateFlag,
	LAYOUT_KEY,
	parseLayout,
	REDUCED_MOTION_KEY,
} from "./shell/state";

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
							label="File"
							menuId="file"
							openMenu={openMenu}
							onToggle={toggleMenu}
							menuRef={fileMenuRef}
							actions={fileMenuActions}
						/>
						<HeaderMenu
							label="Edit"
							menuId="edit"
							openMenu={openMenu}
							onToggle={toggleMenu}
							menuRef={editMenuRef}
							actions={editMenuActions}
						/>
						<div className="relative" ref={pluginMenuRef}>
							<button
								type="button"
								onClick={() => toggleMenu("plugins")}
								aria-haspopup="menu"
								aria-expanded={openMenu === "plugins"}
								className={cn(
									"inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
									openMenu === "plugins" &&
										"bg-[color:var(--active-bg)] text-[color:var(--text-primary)]",
								)}
							>
								Plugins <Badge>4</Badge>
							</button>
							{openMenu === "plugins" ? (
								<div
									role="menu"
									className="absolute top-[calc(100%+4px)] left-0 z-50 w-60 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface)] p-1.5 shadow-2xl"
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
											key={label}
											icon={
												<WandSparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />
											}
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
						label="Mode"
						value={mode}
						onChange={(next) => setMode(next as Mode)}
						variant="mode"
						className="max-md:hidden"
						options={[
							{ value: "objects", label: "Objects" },
							{ value: "sequencer", label: "Sequencer" },
							{ value: "preview", label: "Preview" },
						]}
					/>
				</div>
				<div className="mx-auto w-full max-w-[420px] max-md:hidden">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-ghost)]" />
						<Input
							placeholder="Search commands... ⌘K"
							aria-label="Command search"
							className="h-8 border-[color:var(--border-subtle)] bg-[color:var(--input)] pl-8 text-[12px] placeholder:text-[color:var(--text-ghost)]"
						/>
					</div>
				</div>
				<div className="flex justify-center max-md:order-last max-md:col-span-2 md:hidden">
					<Tabs
						label="Mode"
						value={mode}
						onChange={(next) => setMode(next as Mode)}
						variant="mode"
						options={[
							{ value: "objects", label: "Objects" },
							{ value: "sequencer", label: "Sequencer" },
							{ value: "preview", label: "Preview" },
						]}
					/>
				</div>
				<div className="inline-flex items-center gap-2 justify-self-end">
					<Button variant="ghost" size="sm" className="max-md:px-2">
						<Share2 className="h-3.5 w-3.5" />
						<span className="max-md:hidden">Share</span>
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={() => setExportOpen(true)}
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
						title={sectionTitle(mode, "left")}
						collapsed={layout.leftCollapsed}
						onToggle={() =>
							setLayout((current) => ({
								...current,
								leftCollapsed: !current.leftCollapsed,
							}))
						}
						labelPrefix="Objects"
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
						onPointerDown={(event) => startResize("left", event)}
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
					/>
				)}

				<section className="relative min-h-0 min-w-0 overflow-hidden bg-[color:var(--canvas)]">
					{mode !== "preview" ? (
						<div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface)]/90 p-1.5 shadow-2xl backdrop-blur-lg">
							<div className="pointer-events-auto flex items-center gap-1">
								<ToolButton
									icon={<MousePointer2 className="h-4 w-4" />}
									active
									label="Select tool"
								/>
								<MiniSeparator />
								<ToolButton
									icon={<PenTool className="h-4 w-4" />}
									label="Pen tool"
								/>
								<ToolButton
									icon={<WandSparkles className="h-4 w-4" />}
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
									viewBox="0 0 100 100"
									aria-hidden="true"
									className="absolute inset-0 h-full w-full opacity-55"
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
										r="30"
										fill="none"
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
						onPointerDown={(event) => startResize("right", event)}
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
					/>
				)}

				{isMobile ? null : (
					<PanelColumn
						title={sectionTitle(mode, "right")}
						collapsed={layout.rightCollapsed}
						onToggle={() =>
							setLayout((current) => ({
								...current,
								rightCollapsed: !current.rightCollapsed,
							}))
						}
						labelPrefix={sectionTitle(mode, "right")}
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
					className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 backdrop-blur-sm"
					role="dialog"
					aria-modal="true"
					aria-label="Export Design"
					onPointerDown={(event) => {
						if (event.target === event.currentTarget) {
							setExportOpen(false);
						}
					}}
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
								variant="ghost"
								size="icon"
								aria-label="Close export"
								onClick={() => setExportOpen(false)}
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
											key={option}
											type="button"
											onClick={() => setFormat(option)}
											className={cn(
												"rounded-lg border px-2 py-2 font-semibold text-[11px] transition-colors",
												format === option
													? "border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
													: "border-[color:var(--border-default)] text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
											)}
										>
											{option}
										</button>
									))}
								</div>
							</div>
							<div className="h-px bg-[color:var(--border-subtle)]" />
							<div className="grid gap-3">
								<SectionLabel>Options</SectionLabel>
								<ToggleRow label="Include trims">
									<Toggle
										checked={includeTrims}
										onChange={setIncludeTrims}
										label="Include trims"
									/>
								</ToggleRow>
								<ToggleRow label="Auto color stops">
									<Toggle
										checked={autoColorStops}
										onChange={setAutoColorStops}
										label="Auto color stops"
									/>
								</ToggleRow>
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
							<Button variant="ghost" onClick={() => setExportOpen(false)}>
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

function PanelColumn({
	title,
	collapsed,
	onToggle,
	toggleIcon,
	labelPrefix,
	children,
}: {
	title: string;
	collapsed: boolean;
	onToggle: () => void;
	toggleIcon: string;
	labelPrefix: string;
	children: ReactNode;
}) {
	return (
		<aside className="grid min-h-0 min-w-[56px] grid-rows-[42px_1fr] bg-[color:var(--surface)] first:border-r first:border-r-[color:var(--border-subtle)] last:border-l last:border-l-[color:var(--border-subtle)]">
			<div className="flex items-center justify-between border-b border-b-[color:var(--border-subtle)] px-3">
				<SectionLabel>{title}</SectionLabel>
				<IconButton
					label={
						collapsed ? `Expand ${labelPrefix}` : `Collapse ${labelPrefix}`
					}
					onClick={onToggle}
					icon={toggleIcon}
					className="h-6 w-6 rounded-md"
				/>
			</div>
			{collapsed ? null : (
				<div className="min-h-0 overflow-auto px-2 py-2">{children}</div>
			)}
		</aside>
	);
}

function ResizeHandle({
	label,
	onPointerDown,
	onArrowLeft,
	onArrowRight,
}: {
	label: string;
	onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
	onArrowLeft: () => void;
	onArrowRight: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-keyshortcuts="ArrowLeft ArrowRight"
			className="w-2 bg-transparent p-0 transition-colors hover:bg-[color:var(--primary-faint)] focus-visible:bg-[color:var(--primary-faint)]"
			onPointerDown={onPointerDown}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					onArrowLeft();
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					onArrowRight();
				}
			}}
		/>
	);
}

function renderObjectIcon(icon: ObjectIcon) {
	if (icon === "circle") return <Circle className="h-4 w-4" />;
	if (icon === "star") return <Star className="h-4 w-4" />;
	if (icon === "diamond") return <Diamond className="h-4 w-4" />;
	if (icon === "folder") return <Folder className="h-4 w-4" />;
	return <Image className="h-4 w-4" />;
}

function renderLeftPanel({
	mode,
	objectsLoading,
	sequencerLoading,
	selectedObjectId,
	setSelectedObjectId,
	selectedSequencerId,
	setSelectedSequencerId,
	badgeOpen,
	setBadgeOpen,
}: {
	mode: Mode;
	objectsLoading: boolean;
	sequencerLoading: boolean;
	selectedObjectId: string;
	setSelectedObjectId: (value: string) => void;
	selectedSequencerId: string;
	setSelectedSequencerId: (value: string) => void;
	badgeOpen: boolean;
	setBadgeOpen: (value: boolean) => void;
}) {
	if (mode === "preview") {
		return (
			<EmptyState
				title="Preview Mode"
				description="Simulates final output. Editing is paused."
				icon={<Eye className="h-6 w-6" />}
			/>
		);
	}

	if (mode === "objects") {
		if (objectsLoading) {
			return (
				<div className="grid gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			);
		}

		return (
			<div className="grid gap-1">
				{objects.map((item) => {
					const selected = selectedObjectId === item.id;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => setSelectedObjectId(item.id)}
							className={cn(
								"group grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
								selected
									? "border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]"
									: "border-transparent hover:bg-[color:var(--hover-bg)]",
							)}
						>
							<div className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)]">
								{renderObjectIcon(item.icon)}
							</div>
							<div className="min-w-0">
								<p
									className={cn(
										"m-0 truncate font-semibold text-[11px]",
										selected
											? "text-[color:var(--text-primary)]"
											: "text-[color:var(--text-secondary)]",
									)}
								>
									{item.name}
								</p>
								<p className="m-0 text-[10px] text-[color:var(--text-label)]">
									{item.meta}
								</p>
							</div>
							<div
								className={cn(
									"flex items-center gap-1 text-[color:var(--text-ghost)]",
									selected
										? "opacity-100"
										: "opacity-0 group-hover:opacity-100",
								)}
							>
								<Eye className="h-3.5 w-3.5" />
								<Lock className="h-3.5 w-3.5" />
							</div>
						</button>
					);
				})}
			</div>
		);
	}

	if (sequencerLoading) {
		return (
			<div className="grid gap-2">
				<Skeleton className="h-14" />
				<Skeleton className="h-14" />
				<Skeleton className="h-14" />
			</div>
		);
	}

	return (
		<div className="grid gap-1">
			{sequencerBaseRows.map((row) => (
				<SequencerItem
					key={row.id}
					row={row}
					selected={selectedSequencerId === row.id}
					onClick={() => setSelectedSequencerId(row.id)}
				/>
			))}
			<div>
				<button
					type="button"
					onClick={() => setBadgeOpen(!badgeOpen)}
					className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-[color:var(--hover-bg)]"
				>
					<span
						className={cn(
							"text-[color:var(--text-ghost)] transition-transform",
							badgeOpen ? "rotate-0" : "-rotate-90",
						)}
					>
						<MoveVertical className="h-3 w-3" />
					</span>
					<Folder className="h-3.5 w-3.5 text-[color:var(--text-faint)]" />
					<span className="flex-1 font-bold text-[10px] text-[color:var(--text-muted)] uppercase tracking-[0.08em]">
						Badge Logo
					</span>
					<span className="text-[10px] text-[color:var(--text-ghost)]">
						5 paths - 18,200 st
					</span>
				</button>
				{badgeOpen ? (
					<div className="ml-5 grid gap-1">
						{sequencerGroupedRows.map((row) => (
							<SequencerItem
								key={row.id}
								row={row}
								selected={selectedSequencerId === row.id}
								onClick={() => setSelectedSequencerId(row.id)}
							/>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}

function renderInspector({
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
}: {
	mode: Mode;
	reducedMotion: boolean;
	setReducedMotion: (next: boolean) => void;
	showFabric: boolean;
	setShowFabric: (next: boolean) => void;
	showThreadEffect: boolean;
	setShowThreadEffect: (next: boolean) => void;
	showJumps: boolean;
	setShowJumps: (next: boolean) => void;
	selectedType: "vector" | "image";
	pluginTab: PluginTabId;
	setPluginTab: (value: PluginTabId) => void;
	trimAtEnd: boolean;
	setTrimAtEnd: (next: boolean) => void;
}) {
	if (mode === "objects") {
		if (selectedType === "image") {
			return <ImageInspector />;
		}

		return (
			<div className="grid gap-3">
				<SectionLabel>Position & Size</SectionLabel>
				<div className="grid grid-cols-2 gap-1.5">
					<PropertyInput label="X" value="12.4" suffix="mm" />
					<PropertyInput label="Y" value="-4.2" suffix="mm" />
					<PropertyInput label="W" value="64.0" suffix="mm" />
					<PropertyInput label="H" value="64.0" suffix="mm" />
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					<PropertyInput
						label={<RotateCw className="h-3 w-3" />}
						value="0"
						suffix="deg"
					/>
					<PropertyInput
						label={<CircleDot className="h-3 w-3" />}
						value="0"
						suffix="px"
					/>
				</div>
				<div className="h-px bg-[color:var(--border-subtle)]" />
				<SectionLabel>Alignment</SectionLabel>
				<div className="grid grid-cols-7 gap-1">
					<AlignIcon
						icon={<AlignHorizontalDistributeStart className="h-3.5 w-3.5" />}
						label="Align left"
					/>
					<AlignIcon
						icon={<AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />}
						label="Align horizontal center"
					/>
					<AlignIcon
						icon={<AlignHorizontalDistributeEnd className="h-3.5 w-3.5" />}
						label="Align right"
					/>
					<div className="mx-auto h-4 w-px bg-[color:var(--border-subtle)]" />
					<AlignIcon
						icon={<AlignVerticalDistributeStart className="h-3.5 w-3.5" />}
						label="Align top"
					/>
					<AlignIcon
						icon={<AlignVerticalDistributeCenter className="h-3.5 w-3.5" />}
						label="Align vertical center"
					/>
					<AlignIcon
						icon={<AlignVerticalDistributeEnd className="h-3.5 w-3.5" />}
						label="Align bottom"
					/>
				</div>
				<div className="h-px bg-[color:var(--border-subtle)]" />
				<SectionLabel>Blend</SectionLabel>
				<PropertyRow label="Opacity">
					<Input
						value="100"
						readOnly
						aria-label="Opacity"
						className={cn(
							subtleInputClass,
							"h-7 max-w-[58px] text-right text-[11px]",
						)}
					/>
					<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)]">
						%
					</span>
				</PropertyRow>
			</div>
		);
	}

	if (mode === "preview") {
		return (
			<PreviewInspector
				reducedMotion={reducedMotion}
				setReducedMotion={setReducedMotion}
				showFabric={showFabric}
				setShowFabric={setShowFabric}
				showThreadEffect={showThreadEffect}
				setShowThreadEffect={setShowThreadEffect}
				showJumps={showJumps}
				setShowJumps={setShowJumps}
			/>
		);
	}

	return (
		<div className="grid gap-3">
			<SectionLabel>Thread Color</SectionLabel>
			<Panel className="flex items-center gap-3 rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-2.5">
				<div className="h-8 w-8 rounded-lg border-2 border-white/15 bg-[#ef4a4a]" />
				<div>
					<p className="m-0 font-semibold text-[11px]">Madeira 1147</p>
					<span className="text-[10px] text-[color:var(--text-muted)]">
						Rayon 40 - Red
					</span>
				</div>
				<MoveHorizontal className="ml-auto h-3.5 w-3.5 text-[color:var(--text-ghost)]" />
			</Panel>
			<SectionLabel>Vector Mode</SectionLabel>
			<div className="grid grid-cols-2 gap-1.5">
				<ModeTile
					icon={<Diamond className="h-4 w-4" />}
					label="Outline"
					active
				/>
				<ModeTile
					icon={<PaintBucket className="h-4 w-4" />}
					label="Fill"
					disabled
				/>
			</div>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Stitch Type</SectionLabel>
			<div className="grid grid-cols-3 gap-1.5">
				<ModeTile
					icon={<AlignCenter className="h-4 w-4" />}
					label="Satin"
					active
				/>
				<ModeTile icon={<PaintBucket className="h-4 w-4" />} label="Fill" />
				<ModeTile
					icon={<MoveHorizontal className="h-4 w-4" />}
					label="Running"
				/>
			</div>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Parameters</SectionLabel>
			<PropertyRow label="Spacing">
				<Input
					value="0.40"
					readOnly
					aria-label="Spacing"
					className={cn(
						subtleInputClass,
						"h-7 max-w-[58px] text-right text-[11px]",
					)}
				/>
				<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
					mm
				</span>
			</PropertyRow>
			<PropertyRow label="Pull Comp">
				<Input
					value="0.15"
					readOnly
					aria-label="Pull comp"
					className={cn(
						subtleInputClass,
						"h-7 max-w-[58px] text-right text-[11px]",
					)}
				/>
				<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
					mm
				</span>
			</PropertyRow>
			<PropertyRow label="Density">
				<Input
					value="4.5"
					readOnly
					aria-label="Density"
					className={cn(
						subtleInputClass,
						"h-7 max-w-[58px] text-right text-[11px]",
					)}
				/>
				<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
					l/mm
				</span>
			</PropertyRow>
			<details>
				<summary className="cursor-pointer font-semibold text-[11px] text-[color:var(--text-muted)]">
					Advanced
				</summary>
				<div className="mt-3 grid gap-2 border-[color:var(--border-subtle)] border-t pt-3">
					<PropertyRow label="Underlay">
						<Input
							value="Center Walk"
							readOnly
							aria-label="Underlay"
							className={cn(subtleInputClass, "h-7 max-w-[92px] text-[10px]")}
						/>
					</PropertyRow>
					<PropertyRow label="Underlay Gap">
						<Input
							value="2.00"
							readOnly
							aria-label="Underlay gap"
							className={cn(
								subtleInputClass,
								"h-7 max-w-[58px] text-right text-[11px]",
							)}
						/>
						<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
							mm
						</span>
					</PropertyRow>
					<ToggleRow label="Trim at End">
						<Toggle
							checked={trimAtEnd}
							onChange={setTrimAtEnd}
							label="Trim at End"
						/>
					</ToggleRow>
				</div>
			</details>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Stats</SectionLabel>
			<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
				<StatsGrid
					stats={[
						["Stitches", "3,240"],
						["Trims", "2"],
						["Jumps", "1"],
						["Thread", "2.1m"],
					]}
				/>
			</Panel>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Plugin Dock</SectionLabel>
			<div className="flex items-center justify-between">
				<span className="font-bold text-[9px] text-[color:var(--primary)] uppercase tracking-[0.12em]">
					Plugin Dock
				</span>
				<Plus className="h-3.5 w-3.5 text-[color:var(--text-ghost)]" />
			</div>
			<div className="inline-flex border-[color:var(--border-subtle)] border-b">
				{pluginTabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setPluginTab(tab.id)}
						className={cn(
							"px-2 py-1 font-bold text-[10px] uppercase tracking-[0.06em]",
							pluginTab === tab.id
								? "border-[color:var(--primary)] border-b-2 text-[color:var(--primary)]"
								: "text-[color:var(--text-muted)]",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>
			<Panel className="rounded-xl border-[color:var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_8%,transparent),transparent)] p-3">
				{pluginTab === "thread" ? (
					<StatsGrid
						stats={[
							["Total Thread", "14.2m"],
							["Bobbin", "5.1m"],
							["Est. Time", "8m 24s"],
						]}
					/>
				) : pluginTab === "density" ? (
					<StatsGrid
						stats={[
							["Max", "8.2 st/mm"],
							["Avg", "4.6 st/mm"],
						]}
					/>
				) : (
					<StatsGrid
						stats={[
							["Palette", "Madeira Rayon"],
							["Colors", "6"],
						]}
					/>
				)}
			</Panel>
		</div>
	);
}

function ToggleRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
			<span>{label}</span>
			{children}
		</div>
	);
}

function StatsGrid({ stats }: { stats: [string, string][] }) {
	return (
		<div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px] text-[color:var(--text-muted)]">
			{stats.map(([name, value]) => (
				<div key={name} className="contents">
					<span>{name}</span>
					<strong className="font-mono text-[color:var(--text-secondary)]">
						{value}
					</strong>
				</div>
			))}
		</div>
	);
}

function HeaderMenu({
	label,
	menuId,
	openMenu,
	onToggle,
	menuRef,
	actions,
}: {
	label: string;
	menuId: HeaderMenuId;
	openMenu: HeaderMenuId | null;
	onToggle: (menu: HeaderMenuId) => void;
	menuRef: RefObject<HTMLDivElement | null>;
	actions: HeaderMenuAction[];
}) {
	const isOpen = openMenu === menuId;

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={() => onToggle(menuId)}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				className={cn(
					"rounded-md px-2.5 py-1.5 text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
					isOpen &&
						"bg-[color:var(--active-bg)] text-[color:var(--text-primary)]",
				)}
			>
				{label}
			</button>
			{isOpen ? (
				<div
					role="menu"
					className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-44 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface)] p-1.5 shadow-2xl"
				>
					{actions.map((action) => (
						<div key={action.label}>
							<button
								type="button"
								role="menuitem"
								className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--active-bg)] hover:text-[color:var(--text-primary)]"
							>
								<span className="flex-1">{action.label}</span>
								{action.shortcut ? (
									<span className="font-mono text-[10px] text-[color:var(--text-ghost)]">
										{action.shortcut}
									</span>
								) : null}
							</button>
							{action.divider ? (
								<div className="my-1 h-px bg-[color:var(--border-subtle)]" />
							) : null}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

function PluginMenuItem({
	icon,
	label,
	status = false,
}: {
	icon: ReactNode;
	label: string;
	status?: boolean;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--active-bg)] hover:text-[color:var(--text-primary)]"
		>
			{icon}
			<span className="flex-1">{label}</span>
			{status ? (
				<span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-ready)]" />
			) : null}
		</button>
	);
}

function ToolButton({
	icon,
	label,
	active = false,
}: {
	icon: ReactNode;
	label: string;
	active?: boolean;
}) {
	return (
		<IconButton
			label={label}
			icon={icon}
			active={active}
			className="h-9 w-9 rounded-xl"
		/>
	);
}

function MiniSeparator() {
	return <div className="h-5 w-px bg-[color:var(--border-subtle)]" />;
}

function ZoomActionButton({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<button
			type="button"
			aria-label={label}
			className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-secondary)]"
		>
			{icon}
		</button>
	);
}

function SequencerItem({
	row,
	selected,
	onClick,
}: {
	row: SequencerRow;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"grid w-full grid-cols-[12px_14px_1fr] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
				selected
					? "border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]"
					: "border-transparent hover:bg-[color:var(--hover-bg)]",
			)}
		>
			<GripVertical className="h-3.5 w-3.5 text-[color:var(--text-ghost)]" />
			<span
				className="h-3.5 w-3.5 rounded-sm border border-white/15"
				style={{ backgroundColor: row.color }}
			/>
			<div>
				<p
					className={cn(
						"m-0 font-semibold text-[11px]",
						selected
							? "text-[color:var(--text-primary)]"
							: "text-[color:var(--text-secondary)]",
					)}
				>
					{row.name}
				</p>
				<p className="m-0 text-[10px] text-[color:var(--text-label)]">
					{row.meta}
				</p>
			</div>
		</button>
	);
}

function PropertyInput({
	label,
	value,
	suffix,
}: {
	label: ReactNode;
	value: string;
	suffix: string;
}) {
	return (
		<div className="flex items-center gap-1">
			<span className="w-3 text-center text-[10px] text-[color:var(--text-label)]">
				{label}
			</span>
			<Input
				value={value}
				readOnly
				className={cn(subtleInputClass, "h-7 text-right text-[11px]")}
			/>
			<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)]">
				{suffix}
			</span>
		</div>
	);
}

function PropertyRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center">
			<span className="flex-1 text-[11px] text-[color:var(--text-muted)]">
				{label}
			</span>
			{children}
		</div>
	);
}

function AlignIcon({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<button
			type="button"
			aria-label={label}
			className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--text-ghost)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-secondary)]"
		>
			{icon}
		</button>
	);
}

function ModeTile({
	icon,
	label,
	active = false,
	disabled = false,
}: {
	icon: ReactNode;
	label: string;
	active?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"grid gap-1 rounded-lg border px-2 py-2 text-center",
				active
					? "border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
					: "border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)]",
				disabled && "cursor-not-allowed opacity-35",
			)}
		>
			<span className="mx-auto">{icon}</span>
			<span
				className={cn(
					"font-bold text-[8px] uppercase",
					active
						? "text-[color:var(--primary)]"
						: "text-[color:var(--text-muted)]",
				)}
			>
				{label}
			</span>
		</button>
	);
}

function ImageInspector() {
	return (
		<div className="grid gap-3">
			<SectionLabel>Position & Size</SectionLabel>
			<div className="grid grid-cols-2 gap-1.5">
				<PropertyInput label="X" value="22.0" suffix="mm" />
				<PropertyInput label="Y" value="10.5" suffix="mm" />
				<PropertyInput label="W" value="40.0" suffix="mm" />
				<PropertyInput label="H" value="30.0" suffix="mm" />
			</div>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Image</SectionLabel>
			<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
				<StatsGrid
					stats={[
						["File", "logo.png"],
						["Original", "320 x 240 px"],
					]}
				/>
			</Panel>
			<SectionLabel>Blend</SectionLabel>
			<PropertyRow label="Opacity">
				<Input
					value="100"
					readOnly
					aria-label="Opacity"
					className={cn(
						subtleInputClass,
						"h-7 max-w-[58px] text-right text-[11px]",
					)}
				/>
				<span className="w-6 text-center text-[9px] text-[color:var(--text-ghost)]">
					%
				</span>
			</PropertyRow>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Actions</SectionLabel>
			<Button
				variant="secondary"
				className="w-full justify-center border border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
			>
				<WandSparkles className="h-3.5 w-3.5" />
				Auto Digitize
			</Button>
			<p className="m-0 text-center text-[9px] text-[color:var(--text-ghost)]">
				Convert to vector paths for embroidery
			</p>
		</div>
	);
}

function PreviewInspector({
	reducedMotion,
	setReducedMotion,
	showFabric,
	setShowFabric,
	showThreadEffect,
	setShowThreadEffect,
	showJumps,
	setShowJumps,
}: {
	reducedMotion: boolean;
	setReducedMotion: (next: boolean) => void;
	showFabric: boolean;
	setShowFabric: (next: boolean) => void;
	showThreadEffect: boolean;
	setShowThreadEffect: (next: boolean) => void;
	showJumps: boolean;
	setShowJumps: (next: boolean) => void;
}) {
	return (
		<div className="grid gap-3">
			<SectionLabel>Simulation</SectionLabel>
			<ToggleRow label="Show fabric">
				<Toggle
					checked={showFabric}
					onChange={setShowFabric}
					label="Show fabric"
				/>
			</ToggleRow>
			<ToggleRow label="3D thread effect">
				<Toggle
					checked={showThreadEffect}
					onChange={setShowThreadEffect}
					label="3D thread effect"
				/>
			</ToggleRow>
			<ToggleRow label="Show jumps">
				<Toggle
					checked={showJumps}
					onChange={setShowJumps}
					label="Show jumps"
				/>
			</ToggleRow>
			<ToggleRow label="Reduced motion">
				<Toggle
					checked={reducedMotion}
					onChange={setReducedMotion}
					label="Reduced motion"
				/>
			</ToggleRow>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Fabric</SectionLabel>
			<div className="grid grid-cols-3 gap-1.5">
				<ModeTile
					icon={<FileImage className="h-3.5 w-3.5" />}
					label="White"
					active
				/>
				<ModeTile icon={<Square className="h-3.5 w-3.5" />} label="Black" />
				<ModeTile icon={<FileImage className="h-3.5 w-3.5" />} label="Canvas" />
			</div>
			<div className="h-px bg-[color:var(--border-subtle)]" />
			<SectionLabel>Design Summary</SectionLabel>
			<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
				<StatsGrid
					stats={[
						["Stitches", "38,840"],
						["Colors", "4"],
						["Size", "82.4 x 76.1 mm"],
						["Est. Time", "18m 12s"],
						["Thread", "28.6m"],
					]}
				/>
			</Panel>
		</div>
	);
}
