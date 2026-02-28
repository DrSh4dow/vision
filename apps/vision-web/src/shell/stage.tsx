import {
	Circle,
	Crop,
	MousePointer2,
	Pencil,
	PenTool,
	RectangleHorizontal,
	Scan,
	Sparkles,
	Square,
	Type,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { MiniSeparator, ToolButton, ZoomActionButton } from "./chrome";

type StageProps = {
	mode: "objects" | "sequencer" | "preview";
};

function Stage({ mode }: StageProps) {
	return (
		<section className="relative min-h-0 min-w-0 overflow-hidden bg-[color:var(--canvas)]">
			{mode !== "preview" ? <ModeTools /> : null}
			<div className="absolute top-4 right-4 z-20 font-medium text-[9px] text-[color:var(--text-ghost)]">
				RENDER_ENGINE v2.1
			</div>
			<CanvasBoard />
			<ZoomBar />
		</section>
	);
}

function ModeTools() {
	return (
		<div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface)]/90 p-1.5 shadow-2xl backdrop-blur-lg">
			<div className="pointer-events-auto flex items-center gap-1">
				<ToolButton
					active
					icon={<MousePointer2 className="h-4 w-4" />}
					label="Select tool"
				/>
				<MiniSeparator />
				<ToolButton icon={<PenTool className="h-4 w-4" />} label="Pen tool" />
				<ToolButton
					icon={<Pencil className="h-4 w-4" />}
					label="Freehand tool"
				/>
				<MiniSeparator />
				<ToolButton
					icon={<Circle className="h-4 w-4" />}
					label="Ellipse tool"
				/>
				<ToolButton
					icon={<Square className="h-4 w-4" />}
					label="Rectangle tool"
				/>
				<MiniSeparator />
				<ToolButton icon={<Type className="h-4 w-4" />} label="Text tool" />
			</div>
		</div>
	);
}

function CanvasBoard() {
	return (
		<div className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_7%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]">
			<div
				className="relative grid place-items-center border border-[color:var(--primary-faint)]"
				style={{
					width: "min(calc(100% - 56px), 620px)",
					height: "min(calc(100% - 56px), 620px)",
				}}
			>
				<span className="absolute top-[-18px] left-0 font-medium text-[9px] text-[color:var(--text-ghost)]">
					100 x 100 mm
				</span>
				<span className="absolute top-[-18px] right-0 inline-flex items-center gap-1 font-medium text-[9px] text-[color:var(--text-ghost)]">
					<Crop className="h-2.5 w-2.5" /> Brother PE910L
				</span>
				<div className="relative h-56 w-56 md:h-64 md:w-64">
					<div className="absolute inset-0 rounded-full border-2 border-[color:var(--primary)]/70 shadow-[0_0_40px_color-mix(in_srgb,var(--primary)_12%,transparent)]" />
					<svg
						aria-hidden="true"
						className="absolute inset-0 h-full w-full opacity-55"
						viewBox="0 0 100 100"
					>
						<path
							d="M50 10 L90 90 L10 90 Z"
							fill="none"
							stroke="var(--primary)"
							strokeWidth="0.7"
						/>
						<circle
							cx="50"
							cy="50"
							fill="none"
							r="30"
							stroke="var(--primary)"
							strokeDasharray="2 1.5"
							strokeWidth="0.5"
						/>
					</svg>
					<div className="absolute inset-0 grid place-items-center text-[color:var(--primary)]/50">
						<Sparkles className="h-12 w-12" />
					</div>
				</div>
			</div>
		</div>
	);
}

function ZoomBar() {
	return (
		<div className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--surface)]/90 px-1.5 py-1 backdrop-blur-md">
			<ZoomActionButton
				icon={<ZoomOut className="h-3.5 w-3.5" />}
				label="Zoom out"
			/>
			<span className="min-w-10 px-1 text-center font-semibold text-[10px] text-[color:var(--text-secondary)]">
				100%
			</span>
			<ZoomActionButton
				icon={<ZoomIn className="h-3.5 w-3.5" />}
				label="Zoom in"
			/>
			<div className="mx-0.5 h-3.5 w-px bg-[color:var(--border-subtle)]" />
			<ZoomActionButton
				icon={<Scan className="h-3.5 w-3.5" />}
				label="Center design"
			/>
			<ZoomActionButton
				icon={<RectangleHorizontal className="h-3.5 w-3.5" />}
				label="Fit screen"
			/>
		</div>
	);
}

export { Stage };
