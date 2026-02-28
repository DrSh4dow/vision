- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- Assume senior-level knowledge. No explanations for standard practices. Terse, scannable, constraint-first.
- Branch from `staging`.
- Always rebase, never merge.
- After changes, run: `bun run lazycheck`.
- Always check if local server is running to use that instead of spawning new processes.
- Don’t ignore linting or type errors-fix them, or ask for help if you’re unsure.
- If build mode requires human input (a decision, question, or manual step), pause and request it explicitly (what you need and why), then continue once provided.
- Don't turn off rules without a very good reason. If you think a rule should be changed, bring it up for discussion instead of bypassing it. Speed is important, but not at the cost of code quality or team agreement.

## Style Guide

### General Principles

- Avoid `try`/`catch` where possible
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- When you need to search docs or uncertain about a library, use `context7` tools.
- If you need to use webfetch, try to look for llms.txt in the page's root first for structured data.
- If you are unsure how to do something, use `gh_grep` to search code examples from GitHub. Prefer options that are more recent and have more stars.
- Type casting is a last resort, prefer type guards and runtime checks to maintain type safety.

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Prefer package level tests over workspace-level tests. If a test requires multiple packages, it likely belongs in a new package.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
