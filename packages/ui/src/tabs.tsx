import { TabsList, Tabs as TabsRoot, TabsTrigger } from "./components/ui/tabs";
import { cn } from "./utils";

export interface TabOption {
	disabled?: boolean;
	label: string;
	value: string;
}

interface TabsProps {
	className?: string;
	label: string;
	onChange: (value: string) => void;
	options: TabOption[];
	value: string;
	variant?: "default" | "line" | "mode";
}

export function Tabs({
	label,
	value,
	options,
	onChange,
	className,
	variant = "default",
}: TabsProps) {
	return (
		<TabsRoot className={className} onValueChange={onChange} value={value}>
			<TabsList aria-label={label} variant={variant}>
				{options.map((option) => {
					const isModeVariant = variant === "mode";
					const isSelected = option.value === value;

					return (
						<TabsTrigger
							className={cn(
								isModeVariant &&
									"h-[30px] min-w-[82px] flex-none rounded-full border border-transparent px-3 py-1 font-semibold text-[11px] text-[color:var(--text-muted)] tracking-[-0.01em] hover:text-[color:var(--text-secondary)]",
								isModeVariant &&
									isSelected &&
									"border-transparent bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_8px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
							)}
							disabled={option.disabled}
							key={option.value}
							value={option.value}
						>
							{option.label}
						</TabsTrigger>
					);
				})}
			</TabsList>
		</TabsRoot>
	);
}
