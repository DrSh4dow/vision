import { register as registerHelloPlugin } from "@vision/plugin-hello";
import type {
	VisionCommand,
	VisionPluginAPI,
	VisionPluginRegistration,
} from "@vision/plugin-sdk";

export interface LoadedPlugin extends VisionPluginRegistration {
	commands: VisionCommand[];
}

export async function loadBuiltInPlugins(): Promise<LoadedPlugin[]> {
	const builtInRegisters = [registerHelloPlugin];

	const loadedPlugins: LoadedPlugin[] = [];

	for (const register of builtInRegisters) {
		const commands: VisionCommand[] = [];
		const api: VisionPluginAPI = {
			registerCommand: (command) => {
				commands.push(command);
			},
		};

		const registration = await register(api);
		loadedPlugins.push({ ...registration, commands });
	}

	return loadedPlugins;
}
