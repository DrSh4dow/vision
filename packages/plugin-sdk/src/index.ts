export type VisionCommand = {
	id: string;
	run: () => void | Promise<void>;
	title: string;
};

export type VisionPluginRegistration = {
	id: string;
	name: string;
};

export type VisionPluginAPI = {
	registerCommand: (command: VisionCommand) => void;
};

export type VisionPluginRegister = (
	api: VisionPluginAPI,
) => VisionPluginRegistration | Promise<VisionPluginRegistration>;
