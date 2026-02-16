import type { InputHTMLAttributes } from "react";
import { cn } from "./utils.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
	return (
		<input
			className={cn(
				"h-9 w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--input)] px-3 text-[color:var(--text-primary)] text-sm transition-colors placeholder:text-[color:var(--text-ghost)] hover:bg-[color:var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/60",
				className,
			)}
			{...props}
		/>
	);
}
