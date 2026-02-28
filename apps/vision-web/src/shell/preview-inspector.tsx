import { Panel } from "@vision/ui/panel";
import { Toggle } from "@vision/ui/toggle";
import { FileImage, Square } from "lucide-react";
import {
	InspectorSection,
	ModeTile,
	StatsGrid,
	ToggleRow,
} from "./inspector-common";

type PreviewInspectorProps = {
	reducedMotion: boolean;
	setReducedMotion: (next: boolean) => void;
	showFabric: boolean;
	setShowFabric: (next: boolean) => void;
	showThreadEffect: boolean;
	setShowThreadEffect: (next: boolean) => void;
	showJumps: boolean;
	setShowJumps: (next: boolean) => void;
};

function PreviewInspector({
	reducedMotion,
	setReducedMotion,
	showFabric,
	setShowFabric,
	showThreadEffect,
	setShowThreadEffect,
	showJumps,
	setShowJumps,
}: PreviewInspectorProps) {
	return (
		<div className="grid gap-5">
			<InspectorSection title="Simulation">
				<div className="grid gap-2.5">
					<ToggleRow label="Show fabric">
						<Toggle
							checked={showFabric}
							label="Show fabric"
							onChange={setShowFabric}
						/>
					</ToggleRow>
					<ToggleRow label="3D thread effect">
						<Toggle
							checked={showThreadEffect}
							label="3D thread effect"
							onChange={setShowThreadEffect}
						/>
					</ToggleRow>
					<ToggleRow label="Show jumps">
						<Toggle
							checked={showJumps}
							label="Show jumps"
							onChange={setShowJumps}
						/>
					</ToggleRow>
					<ToggleRow label="Reduced motion">
						<Toggle
							checked={reducedMotion}
							label="Reduced motion"
							onChange={setReducedMotion}
						/>
					</ToggleRow>
				</div>
			</InspectorSection>
			<InspectorSection title="Fabric">
				<div className="grid grid-cols-3 gap-2">
					<ModeTile
						active
						icon={<FileImage className="h-3.5 w-3.5" />}
						label="White"
					/>
					<ModeTile icon={<Square className="h-3.5 w-3.5" />} label="Black" />
					<ModeTile
						icon={<FileImage className="h-3.5 w-3.5" />}
						label="Canvas"
					/>
				</div>
			</InspectorSection>
			<InspectorSection title="Design Summary">
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
			</InspectorSection>
		</div>
	);
}

export { PreviewInspector };
