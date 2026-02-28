import type { ReactNode } from "react";

type MobilePanelsProps = {
	leftTitle: string;
	rightTitle: string;
	left: ReactNode;
	right: ReactNode;
};

function MobilePanels({
	leftTitle,
	rightTitle,
	left,
	right,
}: MobilePanelsProps) {
	return (
		<div className="grid gap-2 border-[color:var(--border-subtle)] border-t bg-[color:var(--surface)] p-2 md:hidden">
			<details open>
				<summary className="cursor-pointer rounded-md bg-[color:var(--surface-elevated)] px-2 py-1.5 font-semibold text-[11px] text-[color:var(--text-secondary)]">
					{leftTitle}
				</summary>
				<div className="mt-2 max-h-48 overflow-auto rounded-md border border-[color:var(--border-default)] p-2">
					{left}
				</div>
			</details>
			<details>
				<summary className="cursor-pointer rounded-md bg-[color:var(--surface-elevated)] px-2 py-1.5 font-semibold text-[11px] text-[color:var(--text-secondary)]">
					{rightTitle}
				</summary>
				<div className="mt-2 max-h-64 overflow-auto rounded-md border border-[color:var(--border-default)] p-2">
					{right}
				</div>
			</details>
		</div>
	);
}

export { MobilePanels };
