import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils.js";

export interface IconButtonProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	label: string;
	icon: ReactNode;
	active?: boolean;
}

export function IconButton({
	className,
	label,
	icon,
	active = false,
	...props
}: IconButtonProps) {
	return (
		<button
			type="button"
			aria-label={label}
			className={cn(
				"inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-default)] bg-transparent text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/60",
				active &&
					"border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]",
				className,
			)}
			{...props}
		>
			{icon}
		</button>
	);
}
