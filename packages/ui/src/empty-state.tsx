import type { ReactNode } from "react";

interface EmptyStateProps {
	title: string;
	description: string;
	icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
	return (
		<div
			className="grid justify-items-center gap-2 p-4 text-center text-[color:var(--text-muted)]"
			aria-live="polite"
		>
			{icon ? (
				<div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--primary-faint)] text-[color:var(--primary)]">
					{icon}
				</div>
			) : null}
			<p className="m-0 font-semibold text-[color:var(--text-secondary)] text-sm">
				{title}
			</p>
			<p className="m-0 max-w-[32ch] text-xs">{description}</p>
		</div>
	);
}
