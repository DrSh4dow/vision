import { visionLayoutDefaults } from "@vision/ui/motion";
import type { LayoutState, Mode } from "./model";

export const LAYOUT_KEY = "vision.layout.v1";
export const REDUCED_MOTION_KEY = "vision.reduced-motion";

export const defaultLayout: LayoutState = {
	leftPanelWidth: 256,
	rightPanelWidth: 272,
	leftCollapsed: false,
	rightCollapsed: false,
};

export function getInitialMode(): Mode {
	const params = new URLSearchParams(globalThis.location.search);
	const param = params.get("mode");
	if (param === "objects" || param === "sequencer" || param === "preview") {
		return param;
	}
	return "objects";
}

export function hasStateFlag(flag: string): boolean {
	const params = new URLSearchParams(globalThis.location.search);
	const state = params.get("state");
	if (!state) return false;
	return state.split(",").includes(flag);
}

export function clampPanel(width: number) {
	return Math.max(
		visionLayoutDefaults.minPanelWidth,
		Math.min(width, visionLayoutDefaults.maxPanelWidth),
	);
}

export function parseLayout(value: string | null): LayoutState {
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
