import type { ReactNode } from "react";
import { cn } from "./utils.js";

interface PanelProps {
	children: ReactNode;
	className?: string;
}

export function Panel({ children, className }: PanelProps) {
	return (
		<section
			className={cn(
				"rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3",
				className,
			)}
		>
			{children}
		</section>
	);
}
