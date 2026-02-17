import {
	Button,
	cn,
	EmptyState,
	IconButton,
	Input,
	Panel,
	SectionLabel,
	Skeleton,
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
	Circle,
	CircleDot,
	Diamond,
	Eye,
	FileImage,
	Folder,
	GripVertical,
	Image,
	Lock,
	MoveHorizontal,
	MoveVertical,
	PaintBucket,
	Plus,
	RotateCw,
	Square,
	Star,
	WandSparkles,
} from "lucide-react";
import type {
	ReactNode,
	PointerEvent as ReactPointerEvent,
	RefObject,
} from "react";
import {
	type HeaderMenuAction,
	type HeaderMenuId,
	type Mode,
	type ObjectIcon,
	objects,
	type PluginTabId,
	pluginTabs,
	type SequencerRow,
	sequencerBaseRows,
	sequencerGroupedRows,
	subtleInputClass,
} from "./model";

export function PanelColumn({
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
			<div
				className={cn(
					"flex border-b border-b-[color:var(--border-subtle)] px-3",
					collapsed
						? "items-center justify-center"
						: "items-center justify-between",
				)}
			>
				{collapsed ? null : <SectionLabel>{title}</SectionLabel>}
				<IconButton
					label={
						collapsed ? `Expand ${labelPrefix}` : `Collapse ${labelPrefix}`
					}
					onClick={onToggle}
					icon={toggleIcon}
					className={cn(
						"rounded-md",
						collapsed
							? "h-8 w-8 border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)]"
							: "h-6 w-6",
					)}
				/>
			</div>
			{collapsed ? null : (
				<div className="min-h-0 overflow-auto px-2 py-2">{children}</div>
			)}
		</aside>
	);
}

export function ResizeHandle({
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

export function renderLeftPanel({
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

export function renderInspector({
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

export function HeaderMenu({
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

export function PluginMenuItem({
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

export function ToolButton({
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

export function MiniSeparator() {
	return <div className="h-5 w-px bg-[color:var(--border-subtle)]" />;
}

export function ZoomActionButton({
	icon,
	label,
}: {
	icon: ReactNode;
	label: string;
}) {
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
		<div className="grid grid-cols-[14px_58px_20px] items-center gap-1">
			<span className="text-center text-[10px] text-[color:var(--text-label)]">
				{label}
			</span>
			<Input
				value={value}
				readOnly
				className={cn(subtleInputClass, "h-7 w-[58px] text-right text-[11px]")}
			/>
			<span className="text-left text-[9px] text-[color:var(--text-ghost)]">
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
			className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] text-[color:var(--text-ghost)] transition-colors hover:border-[color:var(--border-default)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-secondary)]"
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
