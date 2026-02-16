import type { ReactNode } from "react";

interface SectionLabelProps {
	children: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
	return (
		<p className="font-bold text-[9px] text-[color:var(--text-label)] uppercase tracking-[0.12em]">
			{children}
		</p>
	);
}
