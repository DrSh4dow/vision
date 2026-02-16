# engine

Typed TypeScript façade for the Rust/WASM engine.

## Responsibilities

- Load/instantiate WASM
- Provide a stable TS API for the app and plugins
- Run heavy work in Worker-friendly APIs when possible

## Notes

- Keep WASM boundary narrow and well-typed
- Prefer pure data in/out (no DOM objects)
