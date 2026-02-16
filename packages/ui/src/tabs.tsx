import { TabsList, Tabs as TabsRoot, TabsTrigger } from "./components/ui/tabs";

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
}

export function Tabs({
	label,
	value,
	options,
	onChange,
	className,
}: TabsProps) {
	return (
		<TabsRoot value={value} onValueChange={onChange} className={className}>
			<TabsList aria-label={label}>
				{options.map((option) => (
					<TabsTrigger
						key={option.value}
						value={option.value}
						disabled={option.disabled}
					>
						{option.label}
					</TabsTrigger>
				))}
			</TabsList>
		</TabsRoot>
	);
}
