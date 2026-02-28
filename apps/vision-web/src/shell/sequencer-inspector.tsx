import { Input } from "@vision/ui/components/ui/input";
import { Panel } from "@vision/ui/panel";
import { cn } from "@vision/ui/utils";
import { MoveHorizontal, PaintBucket, Plus } from "lucide-react";
import {
	InspectorSection,
	ModeTile,
	PropertyRow,
	StatsGrid,
} from "./inspector-common";
import { type PluginTabId, pluginTabs, subtleInputClass } from "./model";

type SequencerInspectorProps = {
	pluginTab: PluginTabId;
	setPluginTab: (value: PluginTabId) => void;
};

function SequencerInspector({
	pluginTab,
	setPluginTab,
}: SequencerInspectorProps) {
	const stats = getStats(pluginTab);

	return (
		<div className="grid gap-5">
			<InspectorSection title="Thread Color">
				<Panel className="flex items-center gap-3 rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
					<div className="h-8 w-8 rounded-lg border-2 border-white/15 bg-[#ef4a4a]" />
					<div>
						<p className="m-0 font-semibold text-[11px]">Madeira 1147</p>
						<span className="text-[10px] text-[color:var(--text-muted)]">
							Rayon 40 - Red
						</span>
					</div>
					<MoveHorizontal className="ml-auto h-3.5 w-3.5 text-[color:var(--text-ghost)]" />
				</Panel>
			</InspectorSection>
			<InspectorSection title="Parameters">
				<div className="grid gap-2.5">
					<PropertyRow label="Spacing">
						<Input
							aria-label="Spacing"
							className={cn(
								subtleInputClass,
								"h-8 max-w-[64px] text-right text-[11px]",
							)}
							readOnly
							value="0.40"
						/>
						<span className="w-5 shrink-0 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
							mm
						</span>
					</PropertyRow>
					<PropertyRow label="Density">
						<Input
							aria-label="Density"
							className={cn(
								subtleInputClass,
								"h-8 max-w-[64px] text-right text-[11px]",
							)}
							readOnly
							value="4.5"
						/>
						<span className="w-5 shrink-0 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
							l/mm
						</span>
					</PropertyRow>
				</div>
			</InspectorSection>
			<InspectorSection title="Stitch Type">
				<div className="grid grid-cols-2 gap-2">
					<ModeTile
						active
						icon={<MoveHorizontal className="h-4 w-4" />}
						label="Running"
					/>
					<ModeTile icon={<PaintBucket className="h-4 w-4" />} label="Fill" />
				</div>
			</InspectorSection>
			<InspectorSection title="Plugin Dock">
				<div className="flex items-center justify-between">
					<span className="font-bold text-[9px] text-[color:var(--primary)] uppercase tracking-[0.12em]">
						Plugin Dock
					</span>
					<Plus className="h-3.5 w-3.5 text-[color:var(--text-ghost)]" />
				</div>
				<div className="inline-flex border-[color:var(--border-subtle)] border-b">
					{pluginTabs.map((tab) => (
						<button
							className={cn(
								"px-2.5 py-1.5 font-bold text-[10px] uppercase tracking-[0.06em]",
								pluginTab === tab.id
									? "border-[color:var(--primary)] border-b-2 text-[color:var(--primary)]"
									: "text-[color:var(--text-muted)]",
							)}
							key={tab.id}
							onClick={() => setPluginTab(tab.id)}
							type="button"
						>
							{tab.label}
						</button>
					))}
				</div>
				<Panel className="rounded-xl border-[color:var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_8%,transparent),transparent)] p-3">
					<StatsGrid stats={stats} />
				</Panel>
			</InspectorSection>
		</div>
	);
}

function getStats(pluginTab: PluginTabId) {
	if (pluginTab === "thread") {
		return [
			["Total Thread", "14.2m"],
			["Bobbin", "5.1m"],
			["Est. Time", "8m 24s"],
		] satisfies [string, string][];
	}
	if (pluginTab === "density") {
		return [
			["Max", "8.2 st/mm"],
			["Avg", "4.6 st/mm"],
		] satisfies [string, string][];
	}
	return [
		["Palette", "Madeira Rayon"],
		["Colors", "6"],
	] satisfies [string, string][];
}

export { SequencerInspector };
