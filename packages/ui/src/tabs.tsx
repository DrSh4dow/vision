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
							style={
								isModeVariant
									? {
											minWidth: 82,
											height: 30,
											borderRadius: 8,
											fontSize: 11,
											letterSpacing: "-0.01em",
										}
									: undefined
							}
							className={cn(
								isModeVariant &&
									"flex-none border border-transparent px-3 py-1 font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
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
