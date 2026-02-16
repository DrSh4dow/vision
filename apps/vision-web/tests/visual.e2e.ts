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

test("collapsed panel states", async ({ page }) => {
	await page.getByLabel("Collapse Objects").click();
	await page.getByLabel("Collapse Design").click();
	await expect(page).toHaveScreenshot("shell-collapsed-panels.png", {
		fullPage: true,
	});
});

test("skeleton states", async ({ page }) => {
	await page.getByRole("button", { name: "Objects Skeleton" }).click();
	await page.getByRole("button", { name: "Sequencer Skeleton" }).click();
	await page.getByRole("tab", { name: "Sequencer" }).click();
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
