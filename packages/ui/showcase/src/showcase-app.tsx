import { useState } from "react";
import { Button } from "../../src/button";
import { Badge } from "../../src/components/ui/badge";
import { Card, CardContent } from "../../src/components/ui/card";
import { Input } from "../../src/components/ui/input";
import { Skeleton } from "../../src/components/ui/skeleton";
import { EmptyState } from "../../src/empty-state";
import { IconButton } from "../../src/icon-button";
import { Panel } from "../../src/panel";
import { SectionLabel } from "../../src/section-label";
import { Tabs } from "../../src/tabs";
import { Toggle } from "../../src/toggle";

type Page = "primitives" | "tokens" | "shell";

function ShowcaseApp() {
	const [page, setPage] = useState<Page>("primitives");

	return (
		<div className="min-h-screen bg-[color:var(--background)] p-6 text-[color:var(--foreground)]">
			<div className="mx-auto grid max-w-[1400px] gap-6">
				<header className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="m-0 font-semibold text-2xl">Vision UI Showcase</h1>
						<p className="m-0 text-[color:var(--text-muted)] text-sm">
							Fast visual checks for shared primitives and shell composition.
						</p>
					</div>
					<Tabs
						label="Showcase pages"
						onChange={(value) => setPage(value as Page)}
						options={[
							{ value: "primitives", label: "Primitives" },
							{ value: "tokens", label: "Tokens" },
							{ value: "shell", label: "Full Shell" },
						]}
						value={page}
					/>
				</header>
				{page === "primitives" ? <PrimitivesPage /> : null}
				{page === "tokens" ? <TokensPage /> : null}
				{page === "shell" ? <ShellPage /> : null}
			</div>
		</div>
	);
}

function PrimitivesPage() {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Panel className="gap-3">
				<SectionLabel>Buttons</SectionLabel>
				<div className="flex flex-wrap gap-2">
					<Button>Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button disabled>Disabled</Button>
				</div>
			</Panel>
			<Panel className="gap-3">
				<SectionLabel>Inputs & Toggle</SectionLabel>
				<Input placeholder="Command search" />
				<div className="flex items-center justify-between text-[color:var(--text-secondary)] text-sm">
					<span>Reduced motion</span>
					<Toggle checked label="Reduced motion" onChange={() => {}} />
				</div>
			</Panel>
			<Panel className="gap-3">
				<SectionLabel>Badges & Icons</SectionLabel>
				<div className="flex items-center gap-2">
					<Badge>Plugin</Badge>
					<Badge>Active</Badge>
					<IconButton icon="+" label="Plus" />
					<IconButton active icon="S" label="Select" />
				</div>
			</Panel>
			<Card>
				<CardContent className="grid gap-3 pt-4">
					<SectionLabel>Skeleton + Empty</SectionLabel>
					<Skeleton className="h-16" />
					<EmptyState
						description="Install plugins to populate this area."
						title="No Plugin Data"
					/>
				</CardContent>
			</Card>
		</div>
	);
}

function TokensPage() {
	const tokens = [
		"--background",
		"--surface",
		"--surface-elevated",
		"--canvas",
		"--primary",
		"--primary-faint",
		"--text-primary",
		"--text-muted",
		"--border",
		"--active-border",
	];

	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Panel>
				<SectionLabel>Token Swatches</SectionLabel>
				<div className="mt-3 grid gap-2">
					{tokens.map((token) => (
						<div
							className="flex items-center justify-between gap-4 text-sm"
							key={token}
						>
							<span>{token}</span>
							<span
								className="h-6 w-20 rounded border border-[color:var(--border-subtle)]"
								style={{ backgroundColor: `var(${token})` }}
							/>
						</div>
					))}
				</div>
			</Panel>
			<Panel>
				<SectionLabel>Typography</SectionLabel>
				<div className="mt-3 grid gap-2">
					<p className="m-0 text-[color:var(--text-primary)] text-sm">
						Primary text
					</p>
					<p className="m-0 text-[color:var(--text-secondary)] text-sm">
						Secondary text
					</p>
					<p className="m-0 text-[color:var(--text-muted)] text-sm">
						Muted text
					</p>
					<p className="m-0 text-[color:var(--text-faint)] text-sm">
						Faint text
					</p>
				</div>
			</Panel>
		</div>
	);
}

function ShellPage() {
	return (
		<div className="grid h-[780px] grid-rows-[56px_1fr_24px] overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
			<header className="flex items-center justify-between border-[color:var(--border-subtle)] border-b px-3">
				<div className="flex items-center gap-3">
					<div className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--primary)] font-bold text-[color:var(--primary-foreground)] text-xs">
						V
					</div>
					<span className="font-semibold">Vision</span>
				</div>
				<Tabs
					label="Mode"
					onChange={() => {}}
					options={[
						{ value: "objects", label: "Objects" },
						{ value: "sequencer", label: "Sequencer" },
						{ value: "preview", label: "Preview" },
					]}
					value="objects"
				/>
				<div className="flex items-center gap-2">
					<Button disabled variant="ghost">
						Share
					</Button>
					<Button>Export</Button>
				</div>
			</header>
			<div className="grid min-h-0 grid-cols-[280px_1fr_320px]">
				<aside className="border-[color:var(--border-subtle)] border-r p-2">
					<SectionLabel>Objects</SectionLabel>
					<div className="mt-2 grid gap-2">
						<Panel className="border-[color:var(--selected-border)] bg-[color:var(--selected-bg)] p-2">
							<p className="m-0 text-sm">Circle - Outline</p>
							<span className="text-[color:var(--text-muted)] text-xs">
								Vector
							</span>
						</Panel>
						<Panel className="p-2">
							<p className="m-0 text-sm">Star Shape</p>
							<span className="text-[color:var(--text-muted)] text-xs">
								Vector
							</span>
						</Panel>
					</div>
				</aside>
				<section className="grid place-items-center bg-[color:var(--canvas)] bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_8%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]">
					<div className="grid h-[340px] w-[340px] place-items-center border border-[color:var(--primary-faint)]">
						<div className="h-[180px] w-[180px] rounded-full border-2 border-[color:var(--primary)]/80" />
					</div>
				</section>
				<aside className="border-[color:var(--border-subtle)] border-l p-2">
					<SectionLabel>Inspector</SectionLabel>
					<div className="mt-2 grid gap-2">
						<Input readOnly value="X: 12.4" />
						<Input readOnly value="Y: -4.2" />
						<Panel className="p-2">
							<EmptyState description="No plugins loaded" title="Plugin Dock" />
						</Panel>
					</div>
				</aside>
			</div>
			<footer className="flex items-center justify-between border-[color:var(--border-subtle)] border-t px-3 text-[11px] text-[color:var(--text-muted)]">
				<span>Ready</span>
				<span>GPU Active</span>
			</footer>
		</div>
	);
}

export { ShowcaseApp };
