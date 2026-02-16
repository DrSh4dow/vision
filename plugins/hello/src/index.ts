import type { VisionPluginRegister } from "@vision/plugin-sdk";

export const register: VisionPluginRegister = (api) => {
	api.registerCommand({
		id: "hello.noop",
		title: "Hello no-op",
		run: () => {
			return;
		},
	});

	return {
		id: "hello",
		name: "Hello Plugin",
	};
};
