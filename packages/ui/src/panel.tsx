import type { ComponentProps } from "react";
import { Card } from "./components/ui/card";
import { cn } from "./lib/utils";

export function Panel({ className, ...props }: ComponentProps<"div">) {
	return (
		<Card
			className={cn("gap-0 rounded-lg border border-border py-3", className)}
			{...props}
		/>
	);
}
