export interface VisionCommand {
	id: string;
	run: () => void | Promise<void>;
	title: string;
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
