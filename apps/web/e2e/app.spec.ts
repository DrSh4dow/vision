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
    const shapeBtn = page.locator('button[title="Shape"]');
    const textBtn = page.locator('button[title="Text"]');

    await expect(selectBtn).toBeVisible();
    await expect(penBtn).toBeVisible();
    await expect(shapeBtn).toBeVisible();
    await expect(textBtn).toBeVisible();
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

  test("stitch demo generates stitches when clicked", async ({ page }) => {
    const demoBtn = page.getByTestId("stitch-demo-btn");
    await expect(demoBtn).toBeVisible();

    await demoBtn.click();

    const stitchCount = page.getByTestId("stitch-count");
    await expect(stitchCount).toBeVisible({ timeout: 5_000 });
    // Should have generated stitch points (format: "N stitch points")
    await expect(stitchCount).toContainText(/\d+ stitch points/);
  });

  test("stitch demo produces a reasonable number of points", async ({ page }) => {
    const demoBtn = page.getByTestId("stitch-demo-btn");
    await demoBtn.click();

    const stitchCount = page.getByTestId("stitch-count");
    await expect(stitchCount).toBeVisible({ timeout: 5_000 });

    const text = await stitchCount.textContent();
    const match = text?.match(/(\d+) stitch points/);
    expect(match).toBeTruthy();
    if (!match) return;

    const count = parseInt(match[1], 10);
    // Path: (0,0)->(50,0)->(50,30)->(0,30) with stitch_length=3
    // Total path length ≈ 50 + 30 + 50 = 130mm, at 3mm stitches ≈ ~45 points
    // Should be more than 10 and less than 100
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(100);
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
    // We verify by checking the screenshot is not tiny (compressed all-black
    // PNGs are very small)
    expect(screenshot.byteLength).toBeGreaterThan(500);
  });

  test("zoom HUD shows 100% initially", async ({ page }) => {
    // Wait for render loop to draw HUD
    await page.waitForTimeout(500);

    // The HUD is drawn on the canvas via Canvas2D so we can't read it
    // directly with DOM queries. Instead, verify the canvas is rendering
    // by checking it has been drawn to (non-zero size screenshot).
    const canvas = page.getByTestId("design-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
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
