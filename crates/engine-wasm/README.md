
# engine-wasm (Rust → WASM)

WASM bindings for the engine.

## Responsibilities

- wasm-bindgen exports
- Build configuration for wasm32
- Minimal glue code for JS/TS consumption

## Build

(Example; align with your scripts)

```bash
cargo build -p engine-wasm --target wasm32-unknown-unknown --release
```
