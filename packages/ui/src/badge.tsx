import type { ReactNode } from "react";
import { cn } from "./utils.js";

interface BadgeProps {
	children: ReactNode;
	className?: string;
}

export function Badge({ children, className }: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-[color:var(--active-border)] bg-[color:var(--primary-faint)] px-2 py-0.5 font-semibold text-[11px] text-[color:var(--primary)]",
				className,
			)}
		>
			{children}
		</span>
	);
}
