import type { VisionEngine } from "@vision/wasm-bridge";

import { getEngine, initEngine } from "@vision/wasm-bridge";
import { useEffect, useState } from "react";

/** Engine initialization state. */
interface EngineState {
  engine: VisionEngine | null;
  loading: boolean;
  error: string | null;
  version: string | null;
}

/**
 * Hook to initialize and access the Vision WASM engine.
 *
 * Loads the WASM module on first mount and returns the engine API.
 * Safe to call from multiple components — initialization is idempotent
 * (the bridge caches the engine instance).
 *
 * Compatible with React StrictMode (effects run twice in dev).
 */
export function useEngine(): EngineState {
  const [state, setState] = useState<EngineState>({
    engine: getEngine(),
    loading: !getEngine(),
    error: null,
    version: null,
  });

  useEffect(() => {
    // If we already have the engine (from cache or a previous mount), skip.
    const cached = getEngine();
    if (cached) {
      setState({
        engine: cached,
        loading: false,
        error: null,
        version: cached.version(),
      });
      return;
    }

    let active = true;

    initEngine()
      .then((engine) => {
        if (active) {
          setState({
            engine,
            loading: false,
            error: null,
            version: engine.version(),
          });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to initialize engine";
          console.error("[vision] Engine initialization failed:", message);
          setState({
            engine: null,
            loading: false,
            error: message,
            version: null,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
