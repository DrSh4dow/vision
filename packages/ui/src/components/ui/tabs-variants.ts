import { cva } from "class-variance-authority";

const modeTabsListClass =
	"h-9 gap-0.5 rounded-full border border-[color:var(--border-default)] bg-[color:var(--input)] p-1 text-[color:var(--text-muted)]";

export const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground data-[variant=line]:rounded-none group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
	{
		variants: {
			variant: {
				default: "bg-muted",
				line: "gap-1 bg-transparent",
				mode: modeTabsListClass,
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);
