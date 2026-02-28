import { IconButton } from "@vision/ui/icon-button";
import { SectionLabel } from "@vision/ui/section-label";
import { cn } from "@vision/ui/utils";
import type {
	ReactNode,
	PointerEvent as ReactPointerEvent,
	RefObject,
} from "react";
import type { HeaderMenuAction, HeaderMenuId } from "./model";

type PanelColumnProps = {
	title: string;
	collapsed: boolean;
	onToggle: () => void;
	toggleIcon: string;
	labelPrefix: string;
	children: ReactNode;
};

function PanelColumn({
	title,
	collapsed,
	onToggle,
	toggleIcon,
	labelPrefix,
	children,
}: PanelColumnProps) {
	return (
		<aside className="grid min-h-0 min-w-[56px] grid-rows-[42px_1fr] bg-[color:var(--surface)] first:border-r first:border-r-[color:var(--border-subtle)] last:border-l last:border-l-[color:var(--border-subtle)]">
			<div
				className={cn(
					"flex border-b border-b-[color:var(--border-subtle)] px-3",
					collapsed
						? "items-center justify-center"
						: "items-center justify-between",
				)}
			>
				{collapsed ? null : <SectionLabel>{title}</SectionLabel>}
				<IconButton
					className={cn(
						"rounded-md",
						collapsed
							? "h-8 w-8 border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)]"
							: "h-6 w-6",
					)}
					icon={toggleIcon}
					label={
						collapsed ? `Expand ${labelPrefix}` : `Collapse ${labelPrefix}`
					}
					onClick={onToggle}
				/>
			</div>
			{collapsed ? null : (
				<div className="min-h-0 min-w-0 overflow-auto px-2 py-2">
					{children}
				</div>
			)}
		</aside>
	);
}

type ResizeHandleProps = {
	label: string;
	onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
	onArrowLeft: () => void;
	onArrowRight: () => void;
};

function ResizeHandle({
	label,
	onPointerDown,
	onArrowLeft,
	onArrowRight,
}: ResizeHandleProps) {
	return (
		<button
			aria-keyshortcuts="ArrowLeft ArrowRight"
			aria-label={label}
			className="w-2 cursor-col-resize bg-transparent p-0 transition-colors hover:bg-[color:var(--primary-faint)] focus-visible:bg-[color:var(--primary-faint)] active:cursor-col-resize"
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					onArrowLeft();
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					onArrowRight();
				}
			}}
			onPointerDown={onPointerDown}
			type="button"
		/>
	);
}

type HeaderMenuProps = {
	label: string;
	menuId: HeaderMenuId;
	openMenu: HeaderMenuId | null;
	onToggle: (menu: HeaderMenuId) => void;
	menuRef: RefObject<HTMLDivElement | null>;
	actions: HeaderMenuAction[];
};

function HeaderMenu({
	label,
	menuId,
	openMenu,
	onToggle,
	menuRef,
	actions,
}: HeaderMenuProps) {
	const isOpen = openMenu === menuId;

	return (
		<div className="relative" ref={menuRef}>
			<button
				aria-expanded={isOpen}
				aria-haspopup="menu"
				className={cn(
					"rounded-md px-2.5 py-1.5 text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
					isOpen &&
						"bg-[color:var(--active-bg)] text-[color:var(--text-primary)]",
				)}
				onClick={() => onToggle(menuId)}
				type="button"
			>
				{label}
			</button>
			{isOpen ? (
				<div
					className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-44 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface)] p-1.5 shadow-2xl"
					role="menu"
				>
					{actions.map((action) => (
						<div key={action.label}>
							<button
								className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--active-bg)] hover:text-[color:var(--text-primary)]"
								role="menuitem"
								type="button"
							>
								<span className="flex-1">{action.label}</span>
								{action.shortcut ? (
									<span className="font-mono text-[10px] text-[color:var(--text-ghost)]">
										{action.shortcut}
									</span>
								) : null}
							</button>
							{action.divider ? (
								<div className="my-1 h-px bg-[color:var(--border-subtle)]" />
							) : null}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

type PluginMenuItemProps = {
	icon: ReactNode;
	label: string;
	status?: boolean;
};

function PluginMenuItem({ icon, label, status = false }: PluginMenuItemProps) {
	return (
		<button
			className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--active-bg)] hover:text-[color:var(--text-primary)]"
			role="menuitem"
			type="button"
		>
			{icon}
			<span className="flex-1">{label}</span>
			{status ? (
				<span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-ready)]" />
			) : null}
		</button>
	);
}

type ToolButtonProps = {
	icon: ReactNode;
	label: string;
	active?: boolean;
};

function ToolButton({ icon, label, active = false }: ToolButtonProps) {
	return (
		<IconButton
			active={active}
			className="h-9 w-9 rounded-xl"
			icon={icon}
			label={label}
		/>
	);
}

function MiniSeparator() {
	return <div className="h-5 w-px bg-[color:var(--border-subtle)]" />;
}

type ZoomActionButtonProps = {
	icon: ReactNode;
	label: string;
};

function ZoomActionButton({ icon, label }: ZoomActionButtonProps) {
	return (
		<button
			aria-label={label}
			className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-secondary)]"
			type="button"
		>
			{icon}
		</button>
	);
}

export {
	HeaderMenu,
	MiniSeparator,
	PanelColumn,
	PluginMenuItem,
	ResizeHandle,
	ToolButton,
	ZoomActionButton,
};
