import type { ReactNode } from "react";
import {
	type buttonVariants,
	Button as PrimitiveButton,
} from "./components/ui/button";

type PrimitiveVariant = NonNullable<
	Parameters<typeof buttonVariants>[0]
>["variant"];
type PrimitiveSize = NonNullable<Parameters<typeof buttonVariants>[0]>["size"];

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps
	extends Omit<Parameters<typeof PrimitiveButton>[0], "children" | "variant"> {
	children: ReactNode;
	variant?: ButtonVariant;
	size?: PrimitiveSize;
}

const variantMap: Record<ButtonVariant, PrimitiveVariant> = {
	primary: "default",
	secondary: "secondary",
	ghost: "ghost",
};

export function Button({
	children,
	variant = "primary",
	size,
	...props
}: ButtonProps) {
	return (
		<PrimitiveButton variant={variantMap[variant]} size={size} {...props}>
			{children}
		</PrimitiveButton>
	);
}
