import { TabsList, Tabs as TabsRoot, TabsTrigger } from "./components/ui/tabs";
import { cn } from "./utils";

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
		<TabsRoot value={value} onValueChange={onChange} className={className}>
			<TabsList aria-label={label} variant={variant}>
				{options.map((option) => {
					const isModeVariant = variant === "mode";
					const isSelected = option.value === value;

					return (
						<TabsTrigger
							key={option.value}
							value={option.value}
							disabled={option.disabled}
							className={cn(
								isModeVariant &&
									"h-[30px] min-w-[82px] flex-none rounded-full border border-transparent px-3 py-1 font-semibold text-[11px] text-[color:var(--text-muted)] tracking-[-0.01em] hover:text-[color:var(--text-secondary)]",
								isModeVariant &&
									isSelected &&
									"border-transparent bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_8px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
							)}
						>
							{option.label}
						</TabsTrigger>
					);
				})}
			</TabsList>
		</TabsRoot>
	);
}
