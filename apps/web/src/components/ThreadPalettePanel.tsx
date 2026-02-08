import type { ThreadBrand, ThreadColor, VisionEngine } from "@vision/wasm-bridge";
import { Palette } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_PALETTE_DISPLAY, THREAD_BRANDS } from "@/constants/embroidery";

interface ThreadPalettePanelProps {
  engine: VisionEngine;
}

export function ThreadPalettePanel({ engine }: ThreadPalettePanelProps) {
  const [palette, setPalette] = useState<ThreadColor[]>([]);
  const [activeBrand, setActiveBrand] = useState<ThreadBrand | null>(null);

  const loadPalette = useCallback(
    (brand: ThreadBrand) => {
      const colors = engine.getThreadPalette(brand);
      setPalette(colors.slice(0, MAX_PALETTE_DISPLAY));
      setActiveBrand(brand);
    },
    [engine],
  );

  return (
    <div className="flex flex-col gap-2.5" data-testid="thread-palette">
      <div className="flex gap-1">
        {THREAD_BRANDS.map((brand) => (
          <Button
            key={brand}
            variant={activeBrand === brand ? "default" : "ghost"}
            size="sm"
            onClick={() => loadPalette(brand)}
            className={
              activeBrand === brand
                ? "h-7 flex-1 text-[10px] capitalize"
                : "h-7 flex-1 text-[10px] capitalize text-muted-foreground hover:text-foreground"
            }
            data-testid={`thread-brand-${brand}`}
          >
            {brand}
          </Button>
        ))}
      </div>
      {palette.length > 0 && (
        <div className="grid grid-cols-6 gap-1" data-testid="thread-swatches">
          {palette.map((thread, i) => (
            <Tooltip key={`${thread.code}-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="aspect-square rounded-md border border-border/40 transition-all hover:scale-110 hover:ring-1 hover:ring-primary/30"
                  style={{
                    backgroundColor: `rgb(${thread.r}, ${thread.g}, ${thread.b})`,
                  }}
                  aria-label={thread.name}
                  data-testid={`thread-swatch-${i}`}
                />
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                <span className="font-medium">{thread.name}</span>
                <br />
                <span className="text-muted-foreground">{thread.code}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
      {activeBrand && (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
          <Palette className="h-3 w-3" />
          {palette.length} colors shown
        </p>
      )}
    </div>
  );
}
