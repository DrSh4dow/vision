import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./utils";

export interface IconButtonProps
	extends Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> {
	active?: boolean;
	icon: ReactNode;
	label: string;
}

export function IconButton({
	className,
	label,
	icon,
	active = false,
	...props
}: IconButtonProps) {
	return (
		<Button
			aria-label={label}
			className={cn(
				"h-8 w-8 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
				active &&
					"border border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]",
				className,
			)}
			size="icon"
			variant="ghost"
			{...props}
		>
			{icon}
		</Button>
	);
}
