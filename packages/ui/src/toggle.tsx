import type { ComponentProps } from "react";
import { Switch } from "./components/ui/switch";

type ToggleProps = Omit<ComponentProps<typeof Switch>, "onCheckedChange"> & {
	checked: boolean;
	label: string;
	onChange: (next: boolean) => void;
};

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
