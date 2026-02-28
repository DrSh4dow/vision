import { Button } from "@vision/ui/button";
import { Panel } from "@vision/ui/panel";
import { SectionLabel } from "@vision/ui/section-label";
import { Toggle } from "@vision/ui/toggle";
import { cn } from "@vision/ui/utils";
import { Plus, Send } from "lucide-react";

type ExportModalProps = {
	open: boolean;
	setOpen: (next: boolean) => void;
	format: string;
	setFormat: (next: string) => void;
	includeTrims: boolean;
	setIncludeTrims: (next: boolean) => void;
	autoColorStops: boolean;
	setAutoColorStops: (next: boolean) => void;
	options: string[];
};

function ExportModal({
	open,
	setOpen,
	format,
	setFormat,
	includeTrims,
	setIncludeTrims,
	autoColorStops,
	setAutoColorStops,
	options,
}: ExportModalProps) {
	if (!open) return null;

	return (
		<div
			aria-label="Export Design"
			aria-modal="true"
			className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 backdrop-blur-sm"
			onPointerDown={(event) =>
				event.target === event.currentTarget && setOpen(false)
			}
			role="dialog"
		>
			<div
				className="w-full max-w-[480px] rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface)] shadow-2xl"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between border-[color:var(--border-subtle)] border-b p-6">
					<div>
						<p className="m-0 font-bold text-[color:var(--text-primary)] text-base">
							Export Design
						</p>
						<p className="m-0 mt-1 text-[11px] text-[color:var(--text-muted)]">
							Choose format for machine output
						</p>
					</div>
					<Button
						aria-label="Close export"
						onClick={() => setOpen(false)}
						size="icon"
						variant="ghost"
					>
						<Plus className="h-4 w-4 rotate-45" />
					</Button>
				</div>
				<div className="grid gap-5 p-6">
					<div className="grid gap-2.5">
						<SectionLabel>Machine Format</SectionLabel>
						<div className="grid grid-cols-4 gap-2">
							{options.map((option) => (
								<button
									className={cn(
										"rounded-lg border px-2 py-2 font-semibold text-[11px] transition-colors",
										format === option
											? "border-[color:var(--active-border)] bg-[color:var(--active-bg)] text-[color:var(--primary)]"
											: "border-[color:var(--border-default)] text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
									)}
									key={option}
									onClick={() => setFormat(option)}
									type="button"
								>
									{option}
								</button>
							))}
						</div>
					</div>
					<div className="h-px bg-[color:var(--border-subtle)]" />
					<div className="grid gap-3">
						<SectionLabel>Options</SectionLabel>
						<div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
							<span>Include trims</span>
							<Toggle
								checked={includeTrims}
								label="Include trims"
								onChange={setIncludeTrims}
							/>
						</div>
						<div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
							<span>Auto color stops</span>
							<Toggle
								checked={autoColorStops}
								label="Auto color stops"
								onChange={setAutoColorStops}
							/>
						</div>
					</div>
					<Panel className="rounded-xl border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] p-3">
						<div className="flex items-start gap-2 text-[10px] text-[color:var(--text-muted)]">
							<Send className="mt-0.5 h-3.5 w-3.5" />
							<p className="m-0">
								{format} format. Max stitch length: 121 pts. Auto-split if
								needed.
							</p>
						</div>
					</Panel>
				</div>
				<div className="flex items-center justify-end gap-3 border-[color:var(--border-subtle)] border-t p-6">
					<Button onClick={() => setOpen(false)} variant="ghost">
						Cancel
					</Button>
					<Button variant="primary">Export {format}</Button>
				</div>
			</div>
		</div>
	);
}

export { ExportModal };
