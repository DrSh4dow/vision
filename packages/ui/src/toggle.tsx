import { cn } from "./utils.js";

interface ToggleProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			className={cn(
				"relative h-[18px] w-[30px] rounded-full border border-[color:var(--border)] bg-[color:var(--input)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/60",
				checked &&
					"border-[color:var(--active-border)] bg-[color:var(--primary)]",
			)}
			onClick={() => onChange(!checked)}
		>
			<span
				className={cn(
					"absolute top-[2px] left-[2px] h-3 w-3 rounded-full bg-white transition-transform",
					checked && "translate-x-3",
				)}
			/>
		</button>
	);
}
