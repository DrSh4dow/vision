import { Button } from "@vision/ui/button";
import { Badge } from "@vision/ui/components/ui/badge";
import { Input } from "@vision/ui/components/ui/input";
import { Tabs } from "@vision/ui/tabs";
import { cn } from "@vision/ui/utils";
import {
	Download,
	Layers,
	RotateCw,
	Search,
	Settings2,
	Share2,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import type { RefObject } from "react";
import { HeaderMenu, PluginMenuItem } from "./chrome";
import {
	activePluginLabels,
	editMenuActions,
	fileMenuActions,
	type HeaderMenuId,
	type Mode,
} from "./model";

type AppHeaderProps = {
	mode: Mode;
	setMode: (next: Mode) => void;
	openMenu: HeaderMenuId | null;
	toggleMenu: (menu: HeaderMenuId) => void;
	fileMenuRef: RefObject<HTMLDivElement | null>;
	editMenuRef: RefObject<HTMLDivElement | null>;
	pluginMenuRef: RefObject<HTMLDivElement | null>;
	setExportOpen: (next: boolean) => void;
};

const modeOptions = [
	{ value: "objects", label: "Objects" },
	{ value: "sequencer", label: "Sequencer" },
	{ value: "preview", label: "Preview" },
];

function AppHeader({
	mode,
	setMode,
	openMenu,
	toggleMenu,
	fileMenuRef,
	editMenuRef,
	pluginMenuRef,
	setExportOpen,
}: AppHeaderProps) {
	return (
		<header className="relative z-30 grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 border-[color:var(--toolbar-border)] border-b bg-[color:var(--toolbar)] px-3 backdrop-blur-xl max-md:grid-cols-[1fr_auto] max-md:gap-2 max-md:px-2">
			<HeaderBrand
				editMenuRef={editMenuRef}
				fileMenuRef={fileMenuRef}
				mode={mode}
				openMenu={openMenu}
				pluginMenuRef={pluginMenuRef}
				setMode={setMode}
				toggleMenu={toggleMenu}
			/>
			<SearchBox />
			<MobileModeTabs mode={mode} setMode={setMode} />
			<HeaderActions setExportOpen={setExportOpen} />
		</header>
	);
}

type HeaderBrandProps = {
	mode: Mode;
	setMode: (next: Mode) => void;
	openMenu: HeaderMenuId | null;
	toggleMenu: (menu: HeaderMenuId) => void;
	fileMenuRef: RefObject<HTMLDivElement | null>;
	editMenuRef: RefObject<HTMLDivElement | null>;
	pluginMenuRef: RefObject<HTMLDivElement | null>;
};

function HeaderBrand({
	mode,
	setMode,
	openMenu,
	toggleMenu,
	fileMenuRef,
	editMenuRef,
	pluginMenuRef,
}: HeaderBrandProps) {
	return (
		<div className="flex items-center gap-3 max-md:gap-2">
			<div className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--primary)] shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_35%,transparent)]">
				<Layers className="h-4 w-4 text-[color:var(--primary-foreground)]" />
			</div>
			<p className="m-0 font-extrabold text-[15px] tracking-tight">Vision</p>
			<HeaderMenus
				editMenuRef={editMenuRef}
				fileMenuRef={fileMenuRef}
				openMenu={openMenu}
				pluginMenuRef={pluginMenuRef}
				toggleMenu={toggleMenu}
			/>
			<div className="h-5 w-px bg-[color:var(--border-subtle)] max-md:hidden" />
			<Tabs
				className="max-md:hidden"
				label="Mode"
				onChange={(next) => setMode(next as Mode)}
				options={modeOptions}
				value={mode}
				variant="mode"
			/>
		</div>
	);
}

type HeaderMenusProps = {
	openMenu: HeaderMenuId | null;
	toggleMenu: (menu: HeaderMenuId) => void;
	fileMenuRef: RefObject<HTMLDivElement | null>;
	editMenuRef: RefObject<HTMLDivElement | null>;
	pluginMenuRef: RefObject<HTMLDivElement | null>;
};

function HeaderMenus({
	openMenu,
	toggleMenu,
	fileMenuRef,
	editMenuRef,
	pluginMenuRef,
}: HeaderMenusProps) {
	return (
		<nav
			aria-label="Application"
			className="relative flex items-center gap-1 max-md:hidden"
		>
			<HeaderMenu
				actions={fileMenuActions}
				label="File"
				menuId="file"
				menuRef={fileMenuRef}
				onToggle={toggleMenu}
				openMenu={openMenu}
			/>
			<HeaderMenu
				actions={editMenuActions}
				label="Edit"
				menuId="edit"
				menuRef={editMenuRef}
				onToggle={toggleMenu}
				openMenu={openMenu}
			/>
			<PluginMenu
				openMenu={openMenu}
				pluginMenuRef={pluginMenuRef}
				toggleMenu={toggleMenu}
			/>
		</nav>
	);
}

type PluginMenuProps = {
	openMenu: HeaderMenuId | null;
	toggleMenu: (menu: HeaderMenuId) => void;
	pluginMenuRef: RefObject<HTMLDivElement | null>;
};

function PluginMenu({ openMenu, toggleMenu, pluginMenuRef }: PluginMenuProps) {
	return (
		<div className="relative" ref={pluginMenuRef}>
			<button
				aria-expanded={openMenu === "plugins"}
				aria-haspopup="menu"
				className={cn(
					"inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
					openMenu === "plugins" &&
						"bg-[color:var(--active-bg)] text-[color:var(--text-primary)]",
				)}
				onClick={() => toggleMenu("plugins")}
				type="button"
			>
				Plugins <Badge>4</Badge>
			</button>
			{openMenu === "plugins" ? <PluginDropdown /> : null}
		</div>
	);
}

function PluginDropdown() {
	return (
		<div
			className="absolute top-[calc(100%+4px)] left-0 z-50 w-60 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface)] p-1.5 shadow-2xl"
			role="menu"
		>
			<PluginMenuItem
				icon={<Settings2 className="h-3.5 w-3.5" />}
				label="Manage Plugins"
			/>
			<PluginMenuItem
				icon={<Sparkles className="h-3.5 w-3.5" />}
				label="Marketplace"
			/>
			<PluginMenuItem
				icon={<RotateCw className="h-3.5 w-3.5" />}
				label="Check Updates"
			/>
			<div className="my-1 h-px bg-[color:var(--border-subtle)]" />
			<p className="m-0 px-2.5 py-1 font-bold text-[9px] text-[color:var(--text-ghost)] uppercase tracking-[0.12em]">
				Active
			</p>
			{activePluginLabels.map((label) => (
				<PluginMenuItem
					icon={
						<WandSparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />
					}
					key={label}
					label={label}
					status
				/>
			))}
		</div>
	);
}

function SearchBox() {
	return (
		<div className="mx-auto w-full max-w-[420px] max-md:hidden">
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-ghost)]" />
				<Input
					aria-label="Command search"
					className="h-8 border-[color:var(--border-subtle)] bg-[color:var(--input)] pl-8 text-[12px] placeholder:text-[color:var(--text-ghost)]"
					placeholder="Search commands... ⌘K"
				/>
			</div>
		</div>
	);
}

function MobileModeTabs({
	mode,
	setMode,
}: {
	mode: Mode;
	setMode: (next: Mode) => void;
}) {
	return (
		<div className="flex justify-center max-md:order-last max-md:col-span-2 md:hidden">
			<Tabs
				label="Mode"
				onChange={(next) => setMode(next as Mode)}
				options={modeOptions}
				value={mode}
				variant="mode"
			/>
		</div>
	);
}

function HeaderActions({
	setExportOpen,
}: {
	setExportOpen: (next: boolean) => void;
}) {
	return (
		<div className="inline-flex items-center gap-1.5 justify-self-end">
			<Button
				className="h-8 rounded-lg border border-[color:var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_66%,transparent)] px-2.5 font-medium text-[12px] text-[color:var(--text-secondary)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)] max-md:px-2"
				variant="ghost"
			>
				<Share2 className="h-3.5 w-3.5" />
				<span className="max-md:hidden">Share</span>
			</Button>
			<Button
				className="h-8 rounded-lg border border-transparent bg-[color:var(--primary)] px-3 font-semibold text-[12px] text-[color:var(--primary-foreground)] shadow-[0_6px_14px_color-mix(in_srgb,var(--primary)_30%,transparent)] hover:brightness-110"
				onClick={() => setExportOpen(true)}
				variant="ghost"
			>
				<Download className="h-3.5 w-3.5" />
				Export
			</Button>
		</div>
	);
}

export { AppHeader };
