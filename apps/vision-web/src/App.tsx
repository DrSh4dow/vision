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
	visionLayoutDefaults,
} from "@vision/ui";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Mode = "objects" | "sequencer" | "preview";
type PanelSide = "left" | "right";

interface LayoutState {
	leftPanelWidth: number;
	rightPanelWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
}

const LAYOUT_KEY = "vision.layout.v1";
const REDUCED_MOTION_KEY = "vision.reduced-motion";

const defaultLayout: LayoutState = {
	leftPanelWidth: visionLayoutDefaults.leftPanelWidth,
	rightPanelWidth: visionLayoutDefaults.rightPanelWidth,
	leftCollapsed: false,
	rightCollapsed: false,
};

function clampPanel(width: number) {
	return Math.max(
		visionLayoutDefaults.minPanelWidth,
		Math.min(width, visionLayoutDefaults.maxPanelWidth),
	);
}

function parseLayout(value: string | null): LayoutState {
	if (!value) {
		return defaultLayout;
	}

	try {
		const parsed = JSON.parse(value) as Partial<LayoutState>;
		return {
			leftPanelWidth: clampPanel(
				parsed.leftPanelWidth ?? defaultLayout.leftPanelWidth,
			),
			rightPanelWidth: clampPanel(
				parsed.rightPanelWidth ?? defaultLayout.rightPanelWidth,
			),
			leftCollapsed: Boolean(parsed.leftCollapsed),
			rightCollapsed: Boolean(parsed.rightCollapsed),
		};
	} catch {
		return defaultLayout;
	}
}

function sectionTitle(mode: Mode, side: PanelSide) {
	if (side === "left") {
		if (mode === "objects") return "Objects";
		if (mode === "sequencer") return "Stitch Order";
		return "Preview";
	}

	if (mode === "objects") return "Design";
	if (mode === "sequencer") return "Stitch Properties";
	return "Preview Settings";
}

export function App() {
	const [mode, setMode] = useState<Mode>("objects");
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
	const [objectsLoading, setObjectsLoading] = useState(false);
	const [sequencerLoading, setSequencerLoading] = useState(false);
	const [isNarrow, setIsNarrow] = useState(() => globalThis.innerWidth <= 1080);

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
		const media = globalThis.matchMedia("(max-width: 1080px)");
		const handleChange = () => setIsNarrow(media.matches);
		handleChange();
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, []);

	const leftWidth = layout.leftCollapsed ? 56 : layout.leftPanelWidth;
	const rightWidth = layout.rightCollapsed ? 56 : layout.rightPanelWidth;

	const modeStatus = useMemo(() => {
		switch (mode) {
			case "objects":
				return "Objects mode active";
			case "sequencer":
				return "Sequencer mode active";
			case "preview":
				return "Preview mode active";
		}
	}, [mode]);

	const startResize = (
		side: PanelSide,
		event: React.PointerEvent<HTMLElement>,
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
		<div className="grid h-full grid-rows-[56px_1fr_24px] overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
			<header className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 border-[color:var(--toolbar-border)] border-b bg-[color:var(--toolbar)]/90 px-3 backdrop-blur-md max-[1080px]:grid-cols-1 max-[1080px]:py-2">
				<div className="inline-flex items-center gap-3">
					<div className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--primary)] font-bold text-[color:var(--primary-foreground)] text-xs">
						V
					</div>
					<p className="m-0 font-semibold text-xl tracking-tight">Vision</p>
					<nav className="inline-flex items-center gap-1" aria-label="App menu">
						{["File", "Edit", "Plugins"].map((menu) => (
							<button
								key={menu}
								type="button"
								className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[color:var(--text-muted)] text-sm transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]"
							>
								{menu}
								{menu === "Plugins" ? <Badge>4</Badge> : null}
							</button>
						))}
					</nav>
				</div>
				<Tabs
					label="Mode"
					value={mode}
					onChange={(next) => setMode(next as Mode)}
					options={[
						{ value: "objects", label: "Objects" },
						{ value: "sequencer", label: "Sequencer" },
						{ value: "preview", label: "Preview" },
					]}
				/>
				<div className="mx-auto w-full max-w-[430px]">
					<Input
						placeholder="Search commands... ⌘K"
						aria-label="Command search"
					/>
				</div>
				<div className="inline-flex gap-2 justify-self-end">
					<Button variant="ghost" disabled>
						Share
					</Button>
					<Button variant="primary">Export</Button>
				</div>
			</header>

			<main
				className="grid min-h-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_95%,black_5%),var(--background))] max-[1080px]:grid-cols-1"
				style={{
					gridTemplateColumns: isNarrow
						? "1fr"
						: `${leftWidth}px 8px minmax(0,1fr) 8px ${rightWidth}px`,
				}}
			>
				<PanelColumn
					title={sectionTitle(mode, "left")}
					collapsed={layout.leftCollapsed}
					onToggle={() =>
						setLayout((current) => ({
							...current,
							leftCollapsed: !current.leftCollapsed,
						}))
					}
					toggleIcon={layout.leftCollapsed ? ">" : "<"}
				>
					{renderLeftPanel(mode, objectsLoading, sequencerLoading)}
				</PanelColumn>

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

				<section className="relative grid min-w-0 grid-rows-[auto_1fr_auto] gap-3 p-3">
					<div className="mx-auto inline-flex gap-2 rounded-xl border border-[color:var(--toolbar-border)] bg-[color:var(--toolbar)] px-2 py-2 backdrop-blur-md">
						{["S", "P", "C", "O", "Q", "T"].map((tool, index) => (
							<IconButton
								key={tool}
								label={`Tool ${tool}`}
								icon={tool}
								active={index === 0}
							/>
						))}
					</div>
					<div className="grid place-items-center overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--canvas)] bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_8%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]">
						<div className="grid h-[min(55vh,55vw)] max-h-[540px] w-[min(55vh,55vw)] max-w-[540px] place-items-center border border-[color:var(--primary-faint)]">
							<div className="relative aspect-square w-1/2">
								<div className="absolute inset-0 rounded-full border-2 border-[color:var(--primary)]/80" />
								<div className="absolute top-[12%] left-1/2 h-0 w-0 -translate-x-1/2 border-r-[74px] border-r-transparent border-b-[140px] border-b-[color:var(--primary)]/20 border-l-[74px] border-l-transparent" />
							</div>
						</div>
					</div>
					<div className="mx-auto inline-flex items-center gap-1 rounded-full border border-[color:var(--toolbar-border)] bg-[color:var(--toolbar)] px-2 py-1 backdrop-blur-md">
						<IconButton label="Zoom out" icon="-" />
						<span className="px-2 text-[color:var(--text-secondary)] text-xs">
							100%
						</span>
						<IconButton label="Zoom in" icon="+" />
					</div>
				</section>

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

				<PanelColumn
					title={sectionTitle(mode, "right")}
					collapsed={layout.rightCollapsed}
					onToggle={() =>
						setLayout((current) => ({
							...current,
							rightCollapsed: !current.rightCollapsed,
						}))
					}
					toggleIcon={layout.rightCollapsed ? "<" : ">"}
				>
					{renderInspector(mode, reducedMotion, setReducedMotion)}
				</PanelColumn>
			</main>

			<footer className="flex items-center justify-between border-[color:var(--border-subtle)] border-t bg-[color:var(--footer)] px-3 text-[11px] text-[color:var(--text-muted)]">
				<div className="inline-flex items-center gap-3">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--status-ready)]" />
					<span>Ready</span>
					<span>{modeStatus}</span>
					<span>X: 12.4 Y: -4.2 mm</span>
				</div>
				<div className="inline-flex items-center gap-3">
					<span>38,840 st</span>
					<span>82.4 x 76.1 mm</span>
					<span className="text-[color:var(--primary)]">GPU Active</span>
					<span>v1.0.4</span>
				</div>
			</footer>

			<div className="pointer-events-none absolute top-[70px] right-3 z-20 inline-flex gap-2 max-[1080px]:top-[112px]">
				<div className="pointer-events-auto">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setObjectsLoading((v) => !v)}
					>
						Objects Skeleton
					</Button>
				</div>
				<div className="pointer-events-auto">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setSequencerLoading((v) => !v)}
					>
						Sequencer Skeleton
					</Button>
				</div>
			</div>
		</div>
	);
}

function PanelColumn({
	title,
	collapsed,
	onToggle,
	toggleIcon,
	children,
}: {
	title: string;
	collapsed: boolean;
	onToggle: () => void;
	toggleIcon: string;
	children: ReactNode;
}) {
	return (
		<aside className="grid min-h-0 min-w-[56px] grid-rows-[42px_1fr] bg-[color:var(--surface)] first:border-r first:border-r-[color:var(--border-subtle)] last:border-l last:border-l-[color:var(--border-subtle)]">
			<div className="flex items-center justify-between border-b border-b-[color:var(--border-subtle)] px-2">
				<SectionLabel>{title}</SectionLabel>
				<IconButton
					label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
					onClick={onToggle}
					icon={toggleIcon}
				/>
			</div>
			{collapsed ? null : (
				<div className="min-h-0 overflow-auto p-2">{children}</div>
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
	onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
	onArrowLeft: () => void;
	onArrowRight: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			className="hidden w-2 bg-transparent p-0 transition-colors hover:bg-[color:var(--primary-faint)] focus-visible:bg-[color:var(--primary-faint)] min-[1081px]:block"
			onPointerDown={onPointerDown}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") onArrowLeft();
				if (event.key === "ArrowRight") onArrowRight();
			}}
		/>
	);
}

function renderLeftPanel(
	mode: Mode,
	objectsLoading: boolean,
	sequencerLoading: boolean,
) {
	if (mode === "preview") {
		return (
			<EmptyState
				title="Preview Mode"
				description="Simulates final output. Editing is paused."
				icon="O"
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
			<div className="grid gap-2">
				{[
					"Circle - Outline",
					"Star Shape",
					"Triangle",
					"Badge Logo",
					"logo.png",
				].map((name, index) => (
					<Panel
						key={name}
						className={cn(
							"grid gap-0.5 border-[color:var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface)_75%,transparent)] p-2 transition-colors",
							index === 0 &&
								"border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]",
						)}
					>
						<p className="m-0 text-sm">{name}</p>
						<span className="text-[color:var(--text-muted)] text-xs">
							{index === 4 ? "Image" : "Vector"}
						</span>
					</Panel>
				))}
				<EmptyState
					title="Plugin Dock"
					description="No object plugins attached yet. Install plugins to enrich object tools."
				/>
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
		<div className="grid gap-2">
			{[
				"Circle - Outline",
				"Star Shape",
				"Triangle",
				"Shield Outline",
				"Shield Fill",
			].map((name, index) => (
				<Panel
					key={name}
					className={cn(
						"grid gap-0.5 border-[color:var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface)_75%,transparent)] p-2 transition-colors",
						index === 0 &&
							"border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]",
					)}
				>
					<p className="m-0 text-sm">{name}</p>
					<span className="text-[color:var(--text-muted)] text-xs">
						{index * 900 + 1300} st
					</span>
				</Panel>
			))}
		</div>
	);
}

function renderInspector(
	mode: Mode,
	reducedMotion: boolean,
	setReducedMotion: (next: boolean) => void,
) {
	if (mode === "objects") {
		return (
			<div className="grid gap-3">
				<SectionLabel>Position & Size</SectionLabel>
				<div className="grid grid-cols-2 gap-2">
					<Input value="12.4" readOnly aria-label="X" />
					<Input value="-4.2" readOnly aria-label="Y" />
					<Input value="64.0" readOnly aria-label="W" />
					<Input value="64.0" readOnly aria-label="H" />
				</div>
				<SectionLabel>Alignment</SectionLabel>
				<div className="flex flex-wrap gap-2">
					<IconButton label="Align left" icon="L" />
					<IconButton label="Align center" icon="C" />
					<IconButton label="Align right" icon="R" />
					<IconButton label="Align top" icon="T" />
				</div>
				<SectionLabel>Blend</SectionLabel>
				<Input value="100" readOnly aria-label="Opacity" />
				<SectionLabel>Plugin Dock</SectionLabel>
				<EmptyState
					title="No Inspector Plugins"
					description="Plugins can contribute object-level controls in this area."
				/>
			</div>
		);
	}

	if (mode === "preview") {
		return (
			<div className="grid gap-3">
				<SectionLabel>Simulation</SectionLabel>
				<div className="grid gap-2 text-[color:var(--text-secondary)] text-sm">
					<ToggleRow label="Show fabric">
						<Toggle checked onChange={() => {}} label="Show fabric" />
					</ToggleRow>
					<ToggleRow label="3D thread effect">
						<Toggle checked onChange={() => {}} label="3D thread effect" />
					</ToggleRow>
					<ToggleRow label="Show jumps">
						<Toggle checked={false} onChange={() => {}} label="Show jumps" />
					</ToggleRow>
					<ToggleRow label="Reduced motion">
						<Toggle
							checked={reducedMotion}
							onChange={setReducedMotion}
							label="Reduced motion"
						/>
					</ToggleRow>
				</div>
				<SectionLabel>Design Summary</SectionLabel>
				<Panel>
					<StatsGrid
						stats={[
							["Stitches", "38,840"],
							["Colors", "4"],
							["Size", "82.4 x 76.1 mm"],
							["Est. Time", "18m 12s"],
						]}
					/>
				</Panel>
				<SectionLabel>Plugin Dock</SectionLabel>
				<EmptyState
					title="Preview Dock Empty"
					description="Preview plugins can render analysis widgets and overlays here."
				/>
			</div>
		);
	}

	return (
		<div className="grid gap-3">
			<SectionLabel>Thread Color</SectionLabel>
			<Panel className="flex items-center gap-3">
				<div className="h-7 w-7 rounded-md bg-[#ef4a4a]" />
				<div>
					<p className="m-0 text-sm">Madeira 1147</p>
					<span className="text-[color:var(--text-muted)] text-xs">
						Rayon 40 - Red
					</span>
				</div>
			</Panel>
			<SectionLabel>Stitch Type</SectionLabel>
			<div className="flex flex-wrap gap-2">
				<Button variant="primary" size="sm">
					Satin
				</Button>
				<Button size="sm">Fill</Button>
				<Button size="sm">Running</Button>
			</div>
			<SectionLabel>Parameters</SectionLabel>
			<div className="grid gap-2">
				<Input value="0.40" readOnly aria-label="Spacing" />
				<Input value="0.15" readOnly aria-label="Pull comp" />
				<Input value="4.5" readOnly aria-label="Density" />
			</div>
			<SectionLabel>Stats</SectionLabel>
			<Panel>
				<StatsGrid
					stats={[
						["Stitches", "3,240"],
						["Trims", "2"],
						["Jumps", "1"],
						["Thread", "2.1m"],
					]}
				/>
			</Panel>
			<SectionLabel>Plugin Dock</SectionLabel>
			<Panel className="grid gap-2">
				<div className="inline-flex gap-2">
					<button
						type="button"
						className="border-[color:var(--primary)] border-b pb-1 text-[11px] text-[color:var(--primary)] uppercase tracking-[0.08em]"
					>
						Thread
					</button>
					<button
						type="button"
						className="pb-1 text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.08em]"
					>
						Density
					</button>
					<button
						type="button"
						className="pb-1 text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.08em]"
					>
						Colors
					</button>
				</div>
				<Skeleton className="h-20" />
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
		<div className="flex items-center justify-between">
			<span>{label}</span>
			{children}
		</div>
	);
}

function StatsGrid({ stats }: { stats: [string, string][] }) {
	return (
		<div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[color:var(--text-muted)] text-xs">
			{stats.map(([name, value]) => (
				<div key={name} className="contents">
					<span>{name}</span>
					<strong className="text-[color:var(--text-secondary)]">
						{value}
					</strong>
				</div>
			))}
		</div>
	);
}
