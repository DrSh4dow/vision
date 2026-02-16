import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils.js";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg border font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/60 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary:
					"border-[color:var(--active-border)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_8px_24px_var(--primary-glow)] hover:brightness-110",
				secondary:
					"border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
				ghost:
					"border-transparent bg-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--text-primary)]",
			},
			size: {
				default: "h-9 px-4",
				sm: "h-8 px-3 text-xs",
			},
		},
		defaultVariants: {
			variant: "secondary",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	children: ReactNode;
	loading?: boolean;
}

export function Button({
	children,
	className,
	variant,
	size,
	loading = false,
	disabled,
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			className={cn(buttonVariants({ variant, size }), className)}
			disabled={disabled || loading}
			aria-busy={loading}
			{...props}
		>
			{loading ? (
				<span
					className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
					aria-hidden="true"
				/>
			) : null}
			<span>{children}</span>
		</button>
	);
}
