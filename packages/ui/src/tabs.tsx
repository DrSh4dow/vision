import { cn } from "./utils.js";

export interface TabOption {
	value: string;
	label: string;
	disabled?: boolean;
}

interface TabsProps {
	label: string;
	value: string;
	options: TabOption[];
	onChange: (value: string) => void;
	className?: string;
}

export function Tabs({
	label,
	value,
	options,
	onChange,
	className,
}: TabsProps) {
	return (
		<div
			className={cn(
				"inline-flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_70%,transparent)] p-1",
				className,
			)}
			role="tablist"
			aria-label={label}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					role="tab"
					aria-selected={value === option.value}
					className={cn(
						"rounded-md px-3 py-1.5 font-semibold text-[color:var(--text-muted)] text-sm transition-colors hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
						value === option.value &&
							"bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary)] hover:text-[color:var(--primary-foreground)]",
					)}
					disabled={option.disabled}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
