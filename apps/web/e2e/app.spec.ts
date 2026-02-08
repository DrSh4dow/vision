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
    const selectBtn = page.getByTestId("tool-select");
    const penBtn = page.getByTestId("tool-pen");
    const rectBtn = page.getByTestId("tool-rect");
    const ellipseBtn = page.getByTestId("tool-ellipse");

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

  test("engine version matches expected format", async ({ page }) => {
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v\d+\.\d+\.\d+/);
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

  test("export DST triggers download after shape creation", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await expect(canvas).toBeVisible();

    // Create a shape by dragging with the rect tool
    const rectTool = page.getByTestId("tool-rect");
    await rectTool.click();

    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 40, { steps: 5 });
    await page.mouse.up();

    // Wait for the new shape node to appear in the layers tree
    await expect(page.locator("[data-testid^='layer-node-']")).toHaveCount(2, { timeout: 3_000 });

    const dstBtn = page.getByTestId("export-dst-btn");
    await expect(dstBtn).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await dstBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.dst");
  });

  test("export PES triggers download after shape creation", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await expect(canvas).toBeVisible();

    // Create a shape by dragging with the rect tool
    const rectTool = page.getByTestId("tool-rect");
    await rectTool.click();

    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 40, { steps: 5 });
    await page.mouse.up();

    // Wait for the new shape node to appear in the layers tree
    await expect(page.locator("[data-testid^='layer-node-']")).toHaveCount(2, { timeout: 3_000 });

    const pesBtn = page.getByTestId("export-pes-btn");
    await expect(pesBtn).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await pesBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.pes");
  });

  test("satin controls are available for selected shapes", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await expect(canvas).toBeVisible();

    await page.getByTestId("tool-rect").click();
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 40, { steps: 5 });
    await page.mouse.up();

    const stitchType = page.getByTestId("prop-stitch-type");
    await expect(stitchType).toBeVisible();
    await stitchType.selectOption("satin");

    await expect(page.getByTestId("prop-underlay-enabled")).toBeVisible();
    await expect(page.locator("#prop-pull-comp")).toBeVisible();
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

    // Wait for canvas to have non-trivial pixel data via requestAnimationFrame
    await page.waitForFunction(
      () => {
        const c = document.querySelector(
          "[data-testid='design-canvas']",
        ) as HTMLCanvasElement | null;
        if (!c) return false;
        const ctx = c.getContext("2d");
        if (!ctx) return false;
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        // Check that not all pixels are zero (black/blank)
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) return true;
        }
        return false;
      },
      null,
      { timeout: 5_000 },
    );

    // Take a screenshot of just the canvas and check it's not all black
    const screenshot = await canvas.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(500);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });

    // Wait for async operations to settle (network idle approximation)
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });

  test("clicking a layer node does not crash (BigInt regression)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // The default "Layer 1" should be visible in the layers panel
    const layersTree = page.getByTestId("layers-tree");
    await expect(layersTree).toBeVisible({ timeout: 5_000 });

    // Click on the first layer node
    const layerNode = page.locator("[data-testid^='layer-node-']").first();
    await expect(layerNode).toBeVisible();
    await layerNode.click();

    // Verify selection state is applied (aria-selected becomes true)
    await expect(layerNode).toHaveAttribute("aria-selected", "true");

    // No errors should have been thrown (previously crashed with "can't convert undefined to BigInt")
    expect(errors).toEqual([]);
  });

  test("keyboard tool switching", async ({ page }) => {
    const selectBtn = page.getByTestId("tool-select");
    const penBtn = page.getByTestId("tool-pen");
    const rectBtn = page.getByTestId("tool-rect");
    const ellipseBtn = page.getByTestId("tool-ellipse");

    // Press P — pen tool should become active
    await page.keyboard.press("p");
    await expect(penBtn).toHaveAttribute("aria-pressed", "true");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "false");

    // Press R — rect tool
    await page.keyboard.press("r");
    await expect(rectBtn).toHaveAttribute("aria-pressed", "true");
    await expect(penBtn).toHaveAttribute("aria-pressed", "false");

    // Press E — ellipse tool
    await page.keyboard.press("e");
    await expect(ellipseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(rectBtn).toHaveAttribute("aria-pressed", "false");

    // Press V — back to select
    await page.keyboard.press("v");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "true");
    await expect(ellipseBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("undo/redo works", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    const layerNodes = page.locator("[data-testid^='layer-node-']");

    // Initially should have 1 node (Layer 1)
    await expect(layerNodes).toHaveCount(1, { timeout: 5_000 });

    // Create a rectangle shape
    await page.keyboard.press("r");
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    // Wait for the new shape node to appear (Layer 1 + Rectangle = 2)
    await expect(layerNodes).toHaveCount(2, { timeout: 3_000 });

    // Ensure the page has focus for keyboard shortcuts
    await canvas.click({ position: { x: cx, y: cy } });

    // Undo — should remove the rectangle
    await page.keyboard.press("Control+z");
    await expect(layerNodes).toHaveCount(1, { timeout: 5_000 });

    // Redo — should restore the rectangle
    await page.keyboard.press("Control+Shift+z");
    await expect(layerNodes).toHaveCount(2, { timeout: 5_000 });
  });

  test("layer visibility toggle", async ({ page }) => {
    // Wait for the layer tree to be visible
    const layersTree = page.getByTestId("layers-tree");
    await expect(layersTree).toBeVisible({ timeout: 5_000 });

    // Find the first layer node
    const layerNode = page.locator("[data-testid^='layer-node-']").first();
    await expect(layerNode).toBeVisible();

    // Find the visibility toggle button for this layer
    const visibilityBtn = page.locator("[data-testid^='layer-visibility-']").first();

    // Force-click visibility (button is opacity-0 until hover)
    await visibilityBtn.click({ force: true });

    // After toggling, the layer node should have opacity-40 class (hidden state)
    await expect(layerNode).toHaveClass(/opacity-40/);

    // Toggle back
    await visibilityBtn.click({ force: true });

    // Should no longer have opacity-40
    await expect(layerNode).not.toHaveClass(/opacity-40/);
  });
});
