import { register as registerHelloPlugin } from "@vision/plugin-hello";
import type {
	VisionCommand,
	VisionPluginAPI,
	VisionPluginRegistration,
} from "@vision/plugin-sdk";

export type LoadedPlugin = VisionPluginRegistration & {
	commands: VisionCommand[];
};

export function loadBuiltInPlugins(): Promise<LoadedPlugin[]> {
	const builtInRegisters = [registerHelloPlugin];
	return Promise.all(
		builtInRegisters.map(async (register) => {
			const commands: VisionCommand[] = [];
			const api: VisionPluginAPI = {
				registerCommand: (command) => {
					commands.push(command);
				},
			};

			const registration = await register(api);
			return { ...registration, commands };
		}),
	);
}
