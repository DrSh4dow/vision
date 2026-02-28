import type { ComponentProps, ReactNode } from "react";
import { Button as PrimitiveButton } from "./components/ui/button";
import type { buttonVariants } from "./components/ui/button-variants";

type PrimitiveProps = ComponentProps<typeof PrimitiveButton>;
type PrimitiveVariant = NonNullable<
	Parameters<typeof buttonVariants>[0]
>["variant"];
type PrimitiveSize = PrimitiveProps["size"];

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<PrimitiveProps, "children" | "variant"> & {
	children: ReactNode;
	size?: PrimitiveSize;
	variant?: ButtonVariant;
};

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
		<PrimitiveButton size={size} variant={variantMap[variant]} {...props}>
			{children}
		</PrimitiveButton>
	);
}
