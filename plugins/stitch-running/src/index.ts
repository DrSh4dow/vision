import type { VisionPluginRegister } from "@vision/plugin-sdk";

export const register: VisionPluginRegister = (api) => {
	api.registerCommand({
		id: "stitch-running.noop",
		title: "Running stitch no-op",
		run: () => {},
	});

	return {
		id: "stitch-running",
		name: "Stitch Running",
	};
};
