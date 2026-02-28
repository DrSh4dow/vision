import type { VisionPluginRegister } from "@vision/plugin-sdk";

export const register: VisionPluginRegister = (api) => {
	api.registerCommand({
		id: "format-pes.noop",
		title: "PES no-op",
		run: () => {},
	});

	return {
		id: "format-pes",
		name: "Format PES",
	};
};
