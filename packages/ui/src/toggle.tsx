import type { ComponentProps } from "react";
import { Switch } from "./components/ui/switch";

interface ToggleProps
	extends Omit<ComponentProps<typeof Switch>, "onCheckedChange"> {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
}

export function Toggle({ checked, onChange, label, ...props }: ToggleProps) {
	return (
		<Switch
			aria-label={label}
			checked={checked}
			onCheckedChange={(next: unknown) => onChange(Boolean(next))}
			{...props}
		/>
	);
}
