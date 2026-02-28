import type { VisionPluginRegister } from "@vision/plugin-sdk";

export const register: VisionPluginRegister = (api) => {
	api.registerCommand({
		id: "stitch-satin.noop",
		title: "Satin stitch no-op",
		run: () => {},
	});

	return {
		id: "stitch-satin",
		name: "Stitch Satin",
	};
};
