import { Button } from "@vision/ui/button";
import { Input } from "@vision/ui/components/ui/input";
import { Panel } from "@vision/ui/panel";
import { Toggle } from "@vision/ui/toggle";
import { cn } from "@vision/ui/utils";
import {
	AlignCenter,
	AlignHorizontalDistributeCenter,
	AlignHorizontalDistributeEnd,
	AlignHorizontalDistributeStart,
	AlignVerticalDistributeCenter,
	AlignVerticalDistributeEnd,
	AlignVerticalDistributeStart,
	CircleDot,
	Diamond,
	MoveHorizontal,
	PaintBucket,
	RotateCw,
	WandSparkles,
} from "lucide-react";
import {
	AlignIcon,
	InspectorSection,
	ModeTile,
	PropertyInput,
	PropertyRow,
	StatsGrid,
	ToggleRow,
} from "./inspector-common";
import { subtleInputClass } from "./model";

type ObjectInspectorProps = {
	trimAtEnd: boolean;
	setTrimAtEnd: (next: boolean) => void;
};

function ObjectInspector({ trimAtEnd, setTrimAtEnd }: ObjectInspectorProps) {
	return (
		<div className="grid gap-5">
			<PositionSection />
			<AlignmentSection />
			<BlendSection />
			<VectorModeSection />
			<StitchTypeSection />
			<ParametersSection setTrimAtEnd={setTrimAtEnd} trimAtEnd={trimAtEnd} />
			<StatsSection />
			<ActionsSection />
		</div>
	);
}

function PositionSection() {
	return (
		<InspectorSection title="Position & Size">
			<div className="grid grid-cols-2 gap-2">
				<PropertyInput label="X" suffix="mm" value="12.4" />
				<PropertyInput label="Y" suffix="mm" value="-4.2" />
				<PropertyInput label="W" suffix="mm" value="64.0" />
				<PropertyInput label="H" suffix="mm" value="64.0" />
				<PropertyInput
					label={<RotateCw className="h-3 w-3" />}
					suffix="deg"
					value="0"
				/>
				<PropertyInput
					label={<CircleDot className="h-3 w-3" />}
					suffix="px"
					value="0"
				/>
			</div>
		</InspectorSection>
	);
}

function AlignmentSection() {
	return (
		<InspectorSection title="Alignment">
			<div className="flex flex-wrap items-center justify-center gap-2">
				<div className="flex items-center gap-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] p-1">
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
				</div>
				<div className="flex items-center gap-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] p-1">
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
			</div>
		</InspectorSection>
	);
}

function BlendSection() {
	return (
		<InspectorSection title="Blend">
			<PropertyRow label="Opacity">
				<Input
					aria-label="Opacity"
					className={cn(
						subtleInputClass,
						"h-8 max-w-[64px] text-right text-[11px]",
					)}
					readOnly
					value="100"
				/>
				<span className="w-6 shrink-0 text-center text-[9px] text-[color:var(--text-ghost)]">
					%
				</span>
			</PropertyRow>
		</InspectorSection>
	);
}

function VectorModeSection() {
	return (
		<InspectorSection title="Vector Mode">
			<div className="grid grid-cols-2 gap-2">
				<ModeTile
					active
					icon={<Diamond className="h-4 w-4" />}
					label="Outline"
				/>
				<ModeTile
					disabled
					icon={<PaintBucket className="h-4 w-4" />}
					label="Fill"
				/>
			</div>
		</InspectorSection>
	);
}

function StitchTypeSection() {
	return (
		<InspectorSection title="Stitch Type">
			<div className="grid grid-cols-3 gap-2">
				<ModeTile
					active
					icon={<AlignCenter className="h-4 w-4" />}
					label="Satin"
				/>
				<ModeTile icon={<PaintBucket className="h-4 w-4" />} label="Fill" />
				<ModeTile
					icon={<MoveHorizontal className="h-4 w-4" />}
					label="Running"
				/>
			</div>
		</InspectorSection>
	);
}

function ParametersSection({ trimAtEnd, setTrimAtEnd }: ObjectInspectorProps) {
	return (
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
				<PropertyRow label="Pull Comp">
					<Input
						aria-label="Pull comp"
						className={cn(
							subtleInputClass,
							"h-8 max-w-[64px] text-right text-[11px]",
						)}
						readOnly
						value="0.15"
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
				<details>
					<summary className="cursor-pointer font-semibold text-[11px] text-[color:var(--text-muted)]">
						Advanced
					</summary>
					<div className="mt-3 grid gap-2.5 border-[color:var(--border-subtle)] border-t pt-3">
						<PropertyRow label="Underlay">
							<Input
								aria-label="Underlay"
								className={cn(subtleInputClass, "h-8 max-w-[92px] text-[10px]")}
								readOnly
								value="Center Walk"
							/>
						</PropertyRow>
						<PropertyRow label="Underlay Gap">
							<Input
								aria-label="Underlay gap"
								className={cn(
									subtleInputClass,
									"h-8 max-w-[64px] text-right text-[11px]",
								)}
								readOnly
								value="2.00"
							/>
							<span className="w-5 shrink-0 text-center text-[9px] text-[color:var(--text-ghost)] uppercase">
								mm
							</span>
						</PropertyRow>
						<ToggleRow label="Trim at End">
							<Toggle
								checked={trimAtEnd}
								label="Trim at End"
								onChange={setTrimAtEnd}
							/>
						</ToggleRow>
					</div>
				</details>
			</div>
		</InspectorSection>
	);
}

function StatsSection() {
	return (
		<InspectorSection title="Stats">
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
		</InspectorSection>
	);
}

function ActionsSection() {
	return (
		<InspectorSection title="Actions">
			<Button
				className="w-full justify-center border border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
				variant="secondary"
			>
				<WandSparkles className="h-3.5 w-3.5" />
				Auto Digitize
			</Button>
		</InspectorSection>
	);
}

function ImageInspector() {
	return (
		<div className="grid gap-5">
			<InspectorSection title="Position & Size">
				<div className="grid grid-cols-2 gap-2">
					<PropertyInput label="X" suffix="mm" value="22.0" />
					<PropertyInput label="Y" suffix="mm" value="10.5" />
					<PropertyInput label="W" suffix="mm" value="40.0" />
					<PropertyInput label="H" suffix="mm" value="30.0" />
				</div>
			</InspectorSection>
			<InspectorSection title="Image">
				<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
					<StatsGrid
						stats={[
							["File", "logo.png"],
							["Original", "320 x 240 px"],
						]}
					/>
				</Panel>
			</InspectorSection>
			<InspectorSection title="Blend">
				<PropertyRow label="Opacity">
					<Input
						aria-label="Opacity"
						className={cn(
							subtleInputClass,
							"h-8 max-w-[64px] text-right text-[11px]",
						)}
						readOnly
						value="100"
					/>
					<span className="w-5 shrink-0 text-center text-[9px] text-[color:var(--text-ghost)]">
						%
					</span>
				</PropertyRow>
			</InspectorSection>
		</div>
	);
}

export { ImageInspector, ObjectInspector };
