import { Skeleton } from "@vision/ui/components/ui/skeleton";
import { EmptyState } from "@vision/ui/empty-state";
import { cn } from "@vision/ui/utils";
import {
	Circle,
	Diamond,
	Eye,
	Folder,
	GripVertical,
	Image,
	Lock,
	MoveVertical,
	Star,
} from "lucide-react";
import {
	type Mode,
	type ObjectIcon,
	objects,
	type SequencerRow,
	sequencerBaseRows,
	sequencerGroupedRows,
} from "./model";

type LeftPanelProps = {
	mode: Mode;
	objectsLoading: boolean;
	sequencerLoading: boolean;
	selectedObjectId: string;
	setSelectedObjectId: (value: string) => void;
	selectedSequencerId: string;
	setSelectedSequencerId: (value: string) => void;
	badgeOpen: boolean;
	setBadgeOpen: (value: boolean) => void;
};

function LeftPanel(props: LeftPanelProps) {
	if (props.mode === "preview") {
		return (
			<EmptyState
				description="Simulates final output. Editing is paused."
				icon={<Eye className="h-6 w-6" />}
				title="Preview Mode"
			/>
		);
	}
	if (props.mode === "objects") {
		if (props.objectsLoading) return <LoadingRows />;
		return (
			<ObjectsPanel
				selectedObjectId={props.selectedObjectId}
				setSelectedObjectId={props.setSelectedObjectId}
			/>
		);
	}
	if (props.sequencerLoading) return <LoadingRows />;
	return (
		<SequencerPanel
			badgeOpen={props.badgeOpen}
			selectedSequencerId={props.selectedSequencerId}
			setBadgeOpen={props.setBadgeOpen}
			setSelectedSequencerId={props.setSelectedSequencerId}
		/>
	);
}

function LoadingRows() {
	return (
		<div className="grid gap-2">
			<Skeleton className="h-14" />
			<Skeleton className="h-14" />
			<Skeleton className="h-14" />
		</div>
	);
}

function ObjectsPanel({
	selectedObjectId,
	setSelectedObjectId,
}: {
	selectedObjectId: string;
	setSelectedObjectId: (value: string) => void;
}) {
	return (
		<div className="grid gap-1">
			{objects.map((item) => (
				<ObjectRow
					item={item}
					key={item.id}
					selected={selectedObjectId === item.id}
					setSelectedObjectId={setSelectedObjectId}
				/>
			))}
		</div>
	);
}

function ObjectRow({
	item,
	selected,
	setSelectedObjectId,
}: {
	item: (typeof objects)[number];
	selected: boolean;
	setSelectedObjectId: (value: string) => void;
}) {
	return (
		<button
			className={cn(
				"group grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
				selected
					? "border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]"
					: "border-transparent hover:bg-[color:var(--hover-bg)]",
			)}
			onClick={() => setSelectedObjectId(item.id)}
			type="button"
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
					selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
				)}
			>
				<Eye className="h-3.5 w-3.5" />
				<Lock className="h-3.5 w-3.5" />
			</div>
		</button>
	);
}

type SequencerPanelProps = {
	badgeOpen: boolean;
	selectedSequencerId: string;
	setBadgeOpen: (value: boolean) => void;
	setSelectedSequencerId: (value: string) => void;
};

function SequencerPanel({
	badgeOpen,
	selectedSequencerId,
	setBadgeOpen,
	setSelectedSequencerId,
}: SequencerPanelProps) {
	return (
		<div className="grid gap-1">
			{sequencerBaseRows.map((row) => (
				<SequencerItem
					key={row.id}
					onClick={() => setSelectedSequencerId(row.id)}
					row={row}
					selected={selectedSequencerId === row.id}
				/>
			))}
			<div>
				<button
					className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-[color:var(--hover-bg)]"
					onClick={() => setBadgeOpen(!badgeOpen)}
					type="button"
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
								onClick={() => setSelectedSequencerId(row.id)}
								row={row}
								selected={selectedSequencerId === row.id}
							/>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}

function renderObjectIcon(icon: ObjectIcon) {
	if (icon === "circle") return <Circle className="h-4 w-4" />;
	if (icon === "star") return <Star className="h-4 w-4" />;
	if (icon === "diamond") return <Diamond className="h-4 w-4" />;
	if (icon === "folder") return <Folder className="h-4 w-4" />;
	return <Image className="h-4 w-4" />;
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
			className={cn(
				"grid w-full grid-cols-[12px_14px_1fr] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
				selected
					? "border-[color:var(--selected-border)] bg-[color:var(--selected-bg)]"
					: "border-transparent hover:bg-[color:var(--hover-bg)]",
			)}
			onClick={onClick}
			type="button"
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

export { LeftPanel };
