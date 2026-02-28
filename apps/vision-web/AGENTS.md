- Inherit global rules from root `AGENTS.md`.
- Use semantic tokens for colors to support dark mode and themes; avoid hardcoded values.
- No arbitrary Tailwind values → use design tokens unless explicitly required
- UI changes must be verified with screenshots using playwright MCP tools.

## Patterns

### Component Decision Tree (strict order)

1. Shadcn component exists? → use it
2. Reusable (3+ uses)? → `src/components/ui/`
3. Section-specific? → `src/components/[section]/`
4. One-off layout? → semantic HTML
