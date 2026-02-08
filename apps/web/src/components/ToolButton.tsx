import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  active?: boolean;
  onClick?: () => void;
}

export function ToolButton({ icon, label, shortcut, active, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="icon"
          title={label}
          data-testid={`tool-${label.toLowerCase().replace(/\s+/g, "-")}`}
          aria-pressed={active}
          className={
            active
              ? "h-8 w-8 rounded-lg shadow-sm shadow-primary/20 ring-1 ring-primary/20"
              : "h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }
          onClick={onClick}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}{" "}
        <kbd className="ml-1.5 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-mono">
          {shortcut}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
