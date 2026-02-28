import type { VisionPluginRegister } from "@vision/plugin-sdk";

export const register: VisionPluginRegister = (api) => {
	api.registerCommand({
		id: "stitch-tatami.noop",
		title: "Tatami stitch no-op",
		run: () => {},
	});

	return {
		id: "stitch-tatami",
		name: "Stitch Tatami",
	};
};
