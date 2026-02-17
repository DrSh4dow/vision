# Issue 2 UI Cleanup Checklist

Use this checklist before opening or updating the Issue #2 PR.

## Architecture

- [ ] No single file mixes shell composition, static data, and low-level controls without clear boundaries.
- [ ] Shared mock/static UI data is defined outside render paths.
- [ ] Repeated UI fragments are extracted into reusable view components.

## React Anti-Patterns

- [ ] No no-op handlers (for example `onChange={() => {}}`) in interactive controls.
- [ ] Derived values are computed once and reused.
- [ ] No unnecessary prop drilling when local composition can isolate concerns.

## Accessibility

- [ ] Menus close on outside-click and Escape.
- [ ] Dialog closes on Escape and backdrop click.
- [ ] Focus-visible states remain visible across keyboard navigation.
- [ ] Panel resize handles support keyboard arrow resizing.

## Design System Hygiene

- [ ] Color/spacing/size values prefer tokens and shared variants.
- [ ] Shared utility imports come from stable public entry points.
- [ ] Primitive wrappers stay presentation-focused and app-agnostic.

## Verification

- [ ] `bunx turbo run check --filter=@vision/web`
- [ ] `bunx turbo run typecheck --filter=@vision/web`
- [ ] `bun run --filter @vision/web test:visual`
- [ ] Playwright manual pass confirms desktop + mobile shell still loads and behaves.
