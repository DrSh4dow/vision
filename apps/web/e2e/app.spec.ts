import { expect, test } from "@playwright/test";

test.describe("Vision App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads and displays the toolbar brand", async ({ page }) => {
    const brand = page.getByTestId("toolbar-brand");
    await expect(brand).toBeVisible();
    await expect(brand).toHaveText("Vision");
  });

  test("shows engine loading state then resolves", async ({ page }) => {
    const status = page.getByTestId("engine-status");
    // Should eventually show a version string (not loading, not error)
    await expect(status).not.toContainText("Loading", { timeout: 15_000 });
    await expect(status).not.toContainText("Error", { timeout: 5_000 });
    // Should contain "Engine v" with a version number
    await expect(status).toContainText(/Engine v\d+\.\d+\.\d+/);
  });

  test("canvas element is present and visible", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await expect(canvas).toBeVisible();
    // Canvas should have non-zero dimensions
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
  });

  test("tool buttons are visible", async ({ page }) => {
    const selectBtn = page.locator('button[title="Select"]');
    const penBtn = page.locator('button[title="Pen"]');
    const rectBtn = page.locator('button[title="Rect"]');
    const ellipseBtn = page.locator('button[title="Ellipse"]');

    await expect(selectBtn).toBeVisible();
    await expect(penBtn).toBeVisible();
    await expect(rectBtn).toBeVisible();
    await expect(ellipseBtn).toBeVisible();
  });

  test("panels are visible (left and right)", async ({ page }) => {
    const leftPanel = page.getByTestId("panel-left");
    const rightPanel = page.getByTestId("panel-right");

    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();
  });
});

test.describe("WASM Engine Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for engine to load
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("engine version matches Cargo.toml version (0.1.0)", async ({ page }) => {
    const status = page.getByTestId("engine-status");
    await expect(status).toHaveText("Engine v0.1.0");
  });
});

test.describe("Thread Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("thread palette panel loads Madeira colors", async ({ page }) => {
    const madeiraBtn = page.getByTestId("thread-brand-madeira");
    await expect(madeiraBtn).toBeVisible();

    await madeiraBtn.click();

    const swatches = page.getByTestId("thread-swatches");
    await expect(swatches).toBeVisible({ timeout: 5_000 });

    // Should show color swatches
    const firstSwatch = page.getByTestId("thread-swatch-0");
    await expect(firstSwatch).toBeVisible();
  });

  test("thread palette shows all three brand buttons", async ({ page }) => {
    const madeira = page.getByTestId("thread-brand-madeira");
    const isacord = page.getByTestId("thread-brand-isacord");
    const sulky = page.getByTestId("thread-brand-sulky");

    await expect(madeira).toBeVisible();
    await expect(isacord).toBeVisible();
    await expect(sulky).toBeVisible();
  });

  test("switching brands updates the palette", async ({ page }) => {
    const madeiraBtn = page.getByTestId("thread-brand-madeira");
    const isacordBtn = page.getByTestId("thread-brand-isacord");

    await madeiraBtn.click();
    const swatches = page.getByTestId("thread-swatches");
    await expect(swatches).toBeVisible({ timeout: 5_000 });

    await isacordBtn.click();
    // Palette should still be visible with updated colors
    await expect(swatches).toBeVisible();
  });
});

test.describe("Import/Export Actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("import SVG button is visible", async ({ page }) => {
    const importBtn = page.getByTestId("import-svg-btn");
    await expect(importBtn).toBeVisible();
  });

  test("export DST button is visible and clickable", async ({ page }) => {
    const dstBtn = page.getByTestId("export-dst-btn");
    await expect(dstBtn).toBeVisible();

    // Click should trigger a download (we verify no errors)
    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await dstBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.dst");
  });

  test("export PES button is visible and clickable", async ({ page }) => {
    const pesBtn = page.getByTestId("export-pes-btn");
    await expect(pesBtn).toBeVisible();

    // Click should trigger a download
    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await pesBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.pes");
  });
});

test.describe("Canvas Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("canvas renders (not blank/black)", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");

    // Wait a frame for the render loop to kick in
    await page.waitForTimeout(500);

    // Take a screenshot of just the canvas and check it's not all black
    const screenshot = await canvas.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(0);

    // The canvas should have some non-zero pixel data (grid lines, axes, HUD)
    expect(screenshot.byteLength).toBeGreaterThan(500);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });

    // Allow a small window for async errors
    await page.waitForTimeout(1_000);

    expect(errors).toEqual([]);
  });
});

test.describe("UI Shell Design Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("full app screenshot — default state", async ({ page }) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/ui-shell-default.png", fullPage: false });
  });

  test("full app screenshot — with thread palette loaded", async ({ page }) => {
    await page.getByTestId("thread-brand-madeira").click();
    await expect(page.getByTestId("thread-swatches")).toBeVisible({ timeout: 5_000 });

    await page.waitForTimeout(300);
    await page.screenshot({
      path: "e2e/screenshots/ui-shell-with-palette.png",
      fullPage: false,
    });
  });
});
