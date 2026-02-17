import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => {
		window.localStorage.removeItem("vision.layout.v1");
		window.localStorage.removeItem("vision.reduced-motion");
	});
	await page.reload();
	await page.waitForLoadState("networkidle");
});

test("objects mode shell", async ({ page }) => {
	await expect(page).toHaveScreenshot("shell-objects.png", { fullPage: true });
});

test("header file menu open", async ({ page }) => {
	await page.getByRole("button", { name: "File" }).click();
	await expect(page.getByRole("menu")).toBeVisible();
	await expect(
		page.getByRole("menuitem", { name: "Save Ctrl+S", exact: true }),
	).toBeVisible();
});

test("sequencer mode shell", async ({ page }) => {
	await page.getByRole("tab", { name: "Sequencer" }).click();
	await expect(page).toHaveScreenshot("shell-sequencer.png", {
		fullPage: true,
	});
});

test("preview mode shell", async ({ page }) => {
	await page.getByRole("tab", { name: "Preview" }).click();
	await expect(page).toHaveScreenshot("shell-preview.png", { fullPage: true });
});

test("export modal", async ({ page }) => {
	await page.goto("/?state=export-open");
	await page.waitForLoadState("networkidle");
	await expect(page).toHaveScreenshot("shell-export-modal.png", {
		fullPage: true,
	});
});

test("export modal closes on escape", async ({ page }) => {
	await page.goto("/?state=export-open");
	await page.waitForLoadState("networkidle");
	await expect(
		page.getByRole("dialog", { name: "Export Design" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("dialog", { name: "Export Design" }),
	).toBeHidden();
});

test("collapsed panel states", async ({ page }) => {
	await page.getByLabel("Collapse Objects").click();
	await page.getByLabel("Collapse Design").click({ force: true });
	await expect(page).toHaveScreenshot("shell-collapsed-panels.png", {
		fullPage: true,
	});
});

test("panel collapse persists on reload", async ({ page }) => {
	await page.getByLabel("Collapse Objects").click();
	await page.getByLabel("Collapse Design").click({ force: true });
	await page.reload();
	await expect(page.getByLabel("Expand Objects")).toBeVisible();
	await expect(page.getByLabel("Expand Design")).toBeVisible();
});

test("skeleton states", async ({ page }) => {
	await page.goto("/?mode=sequencer&state=skeleton-sequencer");
	await page.waitForLoadState("networkidle");
	await expect(page).toHaveScreenshot("shell-skeletons.png", {
		fullPage: true,
	});
});

test("reduced motion state", async ({ page }) => {
	await page.evaluate(() => {
		window.localStorage.setItem("vision.reduced-motion", "1");
	});
	await page.reload();
	await page.waitForLoadState("networkidle");
	await page.getByRole("tab", { name: "Preview" }).click();
	await expect(page).toHaveScreenshot("shell-reduced-motion.png", {
		fullPage: true,
	});
});

test.describe("mobile", () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test("objects mode under md", async ({ page }) => {
		await expect(page).toHaveScreenshot("shell-mobile-objects.png", {
			fullPage: true,
		});
	});
});
