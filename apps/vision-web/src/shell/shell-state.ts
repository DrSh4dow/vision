import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type {
	HeaderMenuId,
	LayoutState,
	PanelSide,
	PluginTabId,
} from "./model";
import { objects, sequencerBaseRows } from "./model";
import {
	clampPanel,
	hasStateFlag,
	LAYOUT_KEY,
	REDUCED_MOTION_KEY,
} from "./state";

type ShellState = {
	objectsLoading: boolean;
	sequencerLoading: boolean;
	selectedObjectId: string;
	selectedSequencerId: string;
	badgeOpen: boolean;
	pluginTab: PluginTabId;
	exportOpen: boolean;
	format: string;
	includeTrims: boolean;
	autoColorStops: boolean;
	trimAtEnd: boolean;
	showFabric: boolean;
	showThreadEffect: boolean;
	showJumps: boolean;
};

function useShellState() {
	const [state, setState] = useState<ShellState>({
		objectsLoading: hasStateFlag("skeleton-objects"),
		sequencerLoading: hasStateFlag("skeleton-sequencer"),
		selectedObjectId: objects[0]?.id ?? "circle",
		selectedSequencerId: sequencerBaseRows[0]?.id ?? "seq-1",
		badgeOpen: true,
		pluginTab: "thread",
		exportOpen: hasStateFlag("export-open"),
		format: ".DST",
		includeTrims: true,
		autoColorStops: true,
		trimAtEnd: true,
		showFabric: true,
		showThreadEffect: true,
		showJumps: false,
	});
	return [state, setState] as const;
}

function useReducedMotion() {
	const [value, setValue] = useState(() => {
		const persisted = globalThis.localStorage.getItem(REDUCED_MOTION_KEY);
		if (persisted === null)
			return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
		return persisted === "1";
	});
	useEffect(() => {
		globalThis.localStorage.setItem(REDUCED_MOTION_KEY, value ? "1" : "0");
		document.documentElement.classList.toggle("reduce-motion", value);
	}, [value]);
	return [value, setValue] as const;
}

function useMobile() {
	const [value, setValue] = useState(
		() => globalThis.matchMedia("(max-width: 767px)").matches,
	);
	useEffect(() => {
		const media = globalThis.matchMedia("(max-width: 767px)");
		const onChange = () => setValue(media.matches);
		onChange();
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);
	return [value] as const;
}

function usePersistLayout(layout: LayoutState) {
	useEffect(() => {
		globalThis.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
	}, [layout]);
}

function useMenuRefs() {
	return {
		file: useRef<HTMLDivElement | null>(null),
		edit: useRef<HTMLDivElement | null>(null),
		plugins: useRef<HTMLDivElement | null>(null),
	};
}

type MenuRefs = {
	file: RefObject<HTMLDivElement | null>;
	edit: RefObject<HTMLDivElement | null>;
	plugins: RefObject<HTMLDivElement | null>;
};

function useMenuDismiss(
	open: HeaderMenuId | null,
	setOpen: (next: HeaderMenuId | null) => void,
	refs: MenuRefs,
) {
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (open === null) return;
			const target = event.target as Node;
			const map: Record<HeaderMenuId, RefObject<HTMLDivElement | null>> = {
				file: refs.file,
				edit: refs.edit,
				plugins: refs.plugins,
			};
			const active = map[open];
			if (active.current && !active.current.contains(target)) setOpen(null);
		};
		globalThis.addEventListener("pointerdown", onPointerDown);
		return () => globalThis.removeEventListener("pointerdown", onPointerDown);
	}, [open, refs, setOpen]);
}

function useEscape(
	openMenu: HeaderMenuId | null,
	setOpenMenu: (next: HeaderMenuId | null) => void,
	exportOpen: boolean,
	setExportOpen: (next: boolean) => void,
) {
	useEffect(() => {
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (openMenu !== null) setOpenMenu(null);
			if (exportOpen) setExportOpen(false);
		};
		globalThis.addEventListener("keydown", onEscape);
		return () => globalThis.removeEventListener("keydown", onEscape);
	}, [openMenu, exportOpen, setOpenMenu, setExportOpen]);
}

function useResize(
	layout: LayoutState,
	setLayout: (next: (current: LayoutState) => LayoutState) => void,
) {
	return (side: PanelSide, event: ReactPointerEvent<HTMLElement>) => {
		event.preventDefault();
		const originX = event.clientX;
		const originWidth =
			side === "left" ? layout.leftPanelWidth : layout.rightPanelWidth;
		const onMove = (move: PointerEvent) =>
			setLayout((current) =>
				side === "left"
					? {
							...current,
							leftCollapsed: false,
							leftPanelWidth: clampPanel(
								originWidth + (move.clientX - originX),
							),
						}
					: {
							...current,
							rightCollapsed: false,
							rightPanelWidth: clampPanel(
								originWidth - (move.clientX - originX),
							),
						},
			);
		const onUp = () => {
			globalThis.removeEventListener("pointermove", onMove);
			globalThis.removeEventListener("pointerup", onUp);
		};
		globalThis.addEventListener("pointermove", onMove);
		globalThis.addEventListener("pointerup", onUp);
	};
}

export {
	useEscape,
	useMenuDismiss,
	useMenuRefs,
	useMobile,
	usePersistLayout,
	useReducedMotion,
	useResize,
	useShellState,
};
export type { MenuRefs, ShellState };
