import { Input } from "@vision/ui/components/ui/input";
import { IconButton } from "@vision/ui/icon-button";
import { SectionLabel } from "@vision/ui/section-label";
import { cn } from "@vision/ui/utils";
import type { ReactNode } from "react";
import { subtleInputClass } from "./model";

type InspectorSectionProps = {
	title: string;
	children: ReactNode;
};

function InspectorSection({ title, children }: InspectorSectionProps) {
	return (
		<div className="grid gap-3">
			<SectionLabel>{title}</SectionLabel>
			{children}
		</div>
	);
}

type PropertyInputProps = {
	label: ReactNode;
	value: string;
	suffix: string;
};

function PropertyInput({ label, value, suffix }: PropertyInputProps) {
	return (
		<div className="flex min-w-0 items-center gap-1.5">
			<span className="w-3 shrink-0 text-center text-[10px] text-[color:var(--text-ghost)]">
				{label}
			</span>
			<Input
				className={cn(
					subtleInputClass,
					"h-8 min-w-0 flex-1 text-right text-[11px]",
				)}
				readOnly
				value={value}
			/>
			<span className="w-5 shrink-0 text-left text-[9px] text-[color:var(--text-ghost)]">
				{suffix}
			</span>
		</div>
	);
}

type PropertyRowProps = {
	label: string;
	children: ReactNode;
};

function PropertyRow({ label, children }: PropertyRowProps) {
	return (
		<div className="flex items-center gap-2">
			<span className="flex-1 text-[11px] text-[color:var(--text-muted)]">
				{label}
			</span>
			{children}
		</div>
	);
}

type ToggleRowProps = {
	label: string;
	children: ReactNode;
};

function ToggleRow({ label, children }: ToggleRowProps) {
	return (
		<div className="flex items-center justify-between py-0.5 text-[11px] text-[color:var(--text-secondary)]">
			<span>{label}</span>
			{children}
		</div>
	);
}

type StatsGridProps = {
	stats: [string, string][];
};

function StatsGrid({ stats }: StatsGridProps) {
	return (
		<div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px] text-[color:var(--text-muted)]">
			{stats.map(([name, value]) => (
				<div className="contents" key={name}>
					<span>{name}</span>
					<strong className="font-mono text-[color:var(--text-secondary)]">
						{value}
					</strong>
				</div>
			))}
		</div>
	);
}

type ModeTileProps = {
	icon: ReactNode;
	label: string;
	active?: boolean;
	disabled?: boolean;
};

function ModeTile({
	icon,
	label,
	active = false,
	disabled = false,
}: ModeTileProps) {
	return (
		<button
			className={cn(
				"grid gap-1 rounded-lg border px-2 py-2 text-center",
				active
					? "border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
					: "border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)]",
				disabled && "cursor-not-allowed opacity-35",
			)}
			disabled={disabled}
			type="button"
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

type AlignIconProps = {
	icon: ReactNode;
	label: string;
};

function AlignIcon({ icon, label }: AlignIconProps) {
	return (
		<IconButton className="h-7 w-7 rounded-md" icon={icon} label={label} />
	);
}

export {
	AlignIcon,
	InspectorSection,
	ModeTile,
	PropertyInput,
	PropertyRow,
	StatsGrid,
	ToggleRow,
};
