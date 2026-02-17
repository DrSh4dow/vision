import type { ElementType, ReactNode } from "react";

interface SectionLabelProps {
	children: ReactNode;
	as?: ElementType;
}

export function SectionLabel({ children, as: Tag = "p" }: SectionLabelProps) {
	return (
		<Tag className="font-bold text-[9px] text-[color:var(--text-label)] uppercase tracking-[0.12em]">
			{children}
		</Tag>
	);
}
