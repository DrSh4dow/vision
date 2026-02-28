import type { Mode, PluginTabId } from "./model";
import { ImageInspector, ObjectInspector } from "./object-inspector";
import { PreviewInspector } from "./preview-inspector";
import { SequencerInspector } from "./sequencer-inspector";

type InspectorPanelProps = {
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
};

function InspectorPanel({
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
}: InspectorPanelProps) {
	if (mode === "objects") {
		if (selectedType === "image") {
			return <ImageInspector />;
		}
		return (
			<ObjectInspector setTrimAtEnd={setTrimAtEnd} trimAtEnd={trimAtEnd} />
		);
	}

	if (mode === "preview") {
		return (
			<PreviewInspector
				reducedMotion={reducedMotion}
				setReducedMotion={setReducedMotion}
				setShowFabric={setShowFabric}
				setShowJumps={setShowJumps}
				setShowThreadEffect={setShowThreadEffect}
				showFabric={showFabric}
				showJumps={showJumps}
				showThreadEffect={showThreadEffect}
			/>
		);
	}

	return (
		<SequencerInspector pluginTab={pluginTab} setPluginTab={setPluginTab} />
	);
}

export { InspectorPanel };
