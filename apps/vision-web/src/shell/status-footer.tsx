import { Bolt } from "lucide-react";

type StatusFooterProps = {
	selectedName: string;
};

function StatusFooter({ selectedName }: StatusFooterProps) {
	return (
		<footer className="flex items-center justify-between border-[color:var(--toolbar-border)] border-t bg-[color:var(--footer)] px-3 text-[9px] text-[color:var(--text-muted)]">
			<div className="flex items-center gap-3 overflow-hidden">
				<span className="inline-flex items-center gap-1.5">
					<span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-ready)]" />{" "}
					Ready
				</span>
				<div className="h-2.5 w-px bg-[color:var(--border-subtle)]" />
				<span className="truncate">{selectedName}</span>
				<span className="text-[color:var(--text-ghost)] max-md:hidden">
					X: 12.4 Y: -4.2 mm
				</span>
			</div>
			<div className="flex items-center gap-3">
				<span className="max-md:hidden">38,840 st</span>
				<span className="max-md:hidden">82.4 x 76.1 mm</span>
				<span className="inline-flex items-center gap-1 text-[color:var(--primary)]">
					<Bolt className="h-2.5 w-2.5" /> GPU Active
				</span>
				<span>v1.0.4</span>
			</div>
		</footer>
	);
}

export { StatusFooter };
