import { cn } from "./utils.js";

interface SkeletonProps {
	className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--surface-elevated)_82%,transparent)]",
				className,
			)}
			aria-hidden="true"
		/>
	);
}
