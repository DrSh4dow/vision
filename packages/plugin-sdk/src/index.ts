export interface VisionCommand {
	id: string;
	title: string;
	run: () => void | Promise<void>;
}

export interface VisionPluginRegistration {
	id: string;
	name: string;
}

export interface VisionPluginAPI {
	registerCommand: (command: VisionCommand) => void;
}

export type VisionPluginRegister = (
	api: VisionPluginAPI,
) => VisionPluginRegistration | Promise<VisionPluginRegistration>;
