export type Mode = "objects" | "sequencer" | "preview";
export type PanelSide = "left" | "right";
export type ObjectType = "vector" | "image";
export type ObjectIcon = "circle" | "star" | "diamond" | "folder" | "image";
export type PluginTabId = "thread" | "density" | "colors";
export type HeaderMenuId = "file" | "edit" | "plugins";

export interface LayoutState {
	leftPanelWidth: number;
	rightPanelWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
}

export interface ObjectItem {
	id: string;
	name: string;
	meta: string;
	type: ObjectType;
	icon: ObjectIcon;
}

export interface SequencerRow {
	id: string;
	name: string;
	meta: string;
	color: string;
}

export interface PluginTab {
	id: PluginTabId;
	label: string;
}

export interface HeaderMenuAction {
	label: string;
	shortcut?: string;
	divider?: boolean;
}

export interface InspectorToggles {
	trimAtEnd: boolean;
	showFabric: boolean;
	showThreadEffect: boolean;
	showJumps: boolean;
}

export interface ExportOptions {
	includeTrims: boolean;
	autoColorStops: boolean;
}

export const objects: ObjectItem[] = [
	{
		id: "circle",
		name: "Circle - Outline",
		meta: "Vector - Closed",
		type: "vector",
		icon: "circle",
	},
	{
		id: "star",
		name: "Star Shape",
		meta: "Vector - Closed",
		type: "vector",
		icon: "star",
	},
	{
		id: "triangle",
		name: "Triangle",
		meta: "Vector - Closed",
		type: "vector",
		icon: "diamond",
	},
	{
		id: "badge",
		name: "Badge Logo",
		meta: "SVG - 5 paths",
		type: "vector",
		icon: "folder",
	},
	{
		id: "image",
		name: "logo.png",
		meta: "Image - 320x240",
		type: "image",
		icon: "image",
	},
];

export const sequencerBaseRows: SequencerRow[] = [
	{
		id: "seq-1",
		name: "Circle - Outline",
		meta: "3,240 st - Satin",
		color: "#ef4444",
	},
	{
		id: "seq-2",
		name: "Star Shape",
		meta: "12,800 st - Fill",
		color: "#ef4444",
	},
	{
		id: "seq-3",
		name: "Triangle",
		meta: "4,600 st - Running",
		color: "#60a5fa",
	},
];

export const sequencerGroupedRows: SequencerRow[] = [
	{
		id: "grp-1",
		name: "Shield Outline",
		meta: "4,100 st - Satin",
		color: "#fbbf24",
	},
	{
		id: "grp-2",
		name: "Shield Fill",
		meta: "8,400 st - Fill",
		color: "#fbbf24",
	},
	{ id: "grp-3", name: "Banner", meta: "2,600 st - Satin", color: "#ef4444" },
	{
		id: "grp-4",
		name: 'Text - "CLUB"',
		meta: "1,800 st - Satin",
		color: "#ffffff",
	},
	{
		id: "grp-5",
		name: "Star Emblem",
		meta: "1,300 st - Fill",
		color: "#ffffff",
	},
];

export const pluginTabs: PluginTab[] = [
	{ id: "thread", label: "Thread" },
	{ id: "density", label: "Density" },
	{ id: "colors", label: "Colors" },
];

export const activePluginLabels = [
	"Thread Calculator",
	"Density Map",
	"Auto Underlay",
	"Color Matcher",
];

export const formatOptions = [
	".DST",
	".PES",
	".JEF",
	".VP3",
	".EXP",
	".HUS",
	".XXX",
	".SVG",
];

export const subtleInputClass =
	"border-[color:var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_76%,transparent)] focus-visible:border-[color:var(--ring)]";

export const fileMenuActions: HeaderMenuAction[] = [
	{ label: "New" },
	{ label: "Open" },
	{ label: "Save", shortcut: "Ctrl+S" },
	{ label: "Save As...", divider: true },
	{ label: "Import" },
	{ label: "Export" },
];

export const editMenuActions: HeaderMenuAction[] = [
	{ label: "Undo", shortcut: "Ctrl+Z" },
	{ label: "Redo", shortcut: "Ctrl+Shift+Z", divider: true },
	{ label: "Cut", shortcut: "Ctrl+X" },
	{ label: "Copy", shortcut: "Ctrl+C" },
	{ label: "Paste", shortcut: "Ctrl+V" },
	{ label: "Duplicate", shortcut: "Ctrl+D", divider: true },
	{ label: "Delete", shortcut: "Del" },
];

export function sectionTitle(mode: Mode, side: PanelSide) {
	if (side === "left") {
		if (mode === "objects") return "Objects";
		if (mode === "sequencer") return "Stitch Order";
		return "Preview";
	}

	if (mode === "objects") return "Design";
	if (mode === "sequencer") return "Stitch Properties";
	return "Preview Settings";
}
