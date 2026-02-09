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

  test("workspace shell layout matches core regions", async ({ page }) => {
    const menuBar = page.getByTestId("menu-bar");
    await expect(menuBar).toBeVisible();

    for (const menu of ["file", "edit", "view", "design", "routing", "help"]) {
      await expect(page.getByTestId(`menu-${menu}`)).toBeVisible();
    }

    const leftPanel = page.getByTestId("panel-left");
    const canvas = page.getByTestId("design-canvas");
    const rightPanel = page.getByTestId("panel-right");
    const statusBar = page.getByTestId("status-bar");
    const toolbar = page.getByRole("toolbar", { name: "Drawing tools" });

    await expect(leftPanel).toBeVisible();
    await expect(canvas).toBeVisible();
    await expect(rightPanel).toBeVisible();
    await expect(statusBar).toBeVisible();
    await expect(toolbar).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    const statusBox = await statusBar.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(statusBox).toBeTruthy();
    if (!canvasBox || !statusBox) return;

    // Status bar should be anchored to bottom of the canvas region.
    expect(statusBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height - statusBox.height - 4);
  });

  test("file menu contains all required project and export entries", async ({ page }) => {
    await page.getByTestId("menu-file").click();
    await expect(page.getByTestId("menu-file-panel")).toBeVisible();

    await expect(page.getByTestId("menu-file-item-new")).toBeVisible();
    await expect(page.getByTestId("menu-file-item-open")).toBeVisible();

    const importSvg = page.getByTestId("menu-file-item-import-svg");
    const importBitmap = page.getByTestId("menu-file-item-import-bitmap");
    await expect(importSvg).toBeVisible();
    await expect(importSvg.getByTestId("menu-file-item-import-svg-shortcut")).toBeVisible();
    await expect(importBitmap).toBeVisible();
    await expect(importBitmap.getByTestId("menu-file-item-import-bitmap-shortcut")).toBeVisible();

    const exportItem = page.getByTestId("menu-file-item-export");
    await expect(exportItem).toBeVisible();
    await exportItem.hover();

    const exportSubmenu = page.getByTestId("menu-file-submenu-export");
    await expect(exportSubmenu).toBeVisible();
    for (const format of ["dst", "pes", "pec", "jef", "exp", "vp3", "hus", "xxx"]) {
      await expect(page.getByTestId(`menu-file-submenu-export-item-${format}`)).toBeVisible();
    }

    await expect(page.getByTestId("menu-file-item-export-production-worksheet")).toBeVisible();
    await expect(page.getByTestId("menu-file-item-save-project")).toBeVisible();
    await expect(page.getByTestId("menu-file-item-recent-files")).toBeVisible();
  });

  test("edit menu contains core editing actions with expected shortcuts", async ({ page }) => {
    await page.getByTestId("menu-edit").click();
    await expect(page.getByTestId("menu-edit-panel")).toBeVisible();

    await expect(page.getByTestId("menu-edit-item-undo")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-undo-shortcut")).toHaveText("Ctrl+Z");
    await expect(page.getByTestId("menu-edit-item-redo")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-redo-shortcut")).toHaveText("Ctrl+Shift+Z");
    await expect(page.getByTestId("menu-edit-item-cut")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-cut-shortcut")).toHaveText("Ctrl+X");
    await expect(page.getByTestId("menu-edit-item-copy")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-copy-shortcut")).toHaveText("Ctrl+C");
    await expect(page.getByTestId("menu-edit-item-paste")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-paste-shortcut")).toHaveText("Ctrl+V");
    await expect(page.getByTestId("menu-edit-item-duplicate")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-delete")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-select-all")).toBeVisible();
    await expect(page.getByTestId("menu-edit-item-select-all-shortcut")).toHaveText("Ctrl+A");
  });

  test("view menu contains zoom, toggles, simulation mode, diagnostics, and inspector", async ({
    page,
  }) => {
    await page.getByTestId("menu-view").click();
    await expect(page.getByTestId("menu-view-panel")).toBeVisible();

    await expect(page.getByTestId("menu-view-item-zoom-in")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-zoom-out")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-zoom-to-fit")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-zoom-to-selection")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-toggle-grid")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-toggle-snap")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-toggle-stitch-preview")).toBeVisible();

    const simulationMode = page.getByTestId("menu-view-item-simulation-mode");
    await expect(simulationMode).toBeVisible();
    await simulationMode.hover();
    await expect(page.getByTestId("menu-view-submenu-simulation-mode")).toBeVisible();
    await expect(page.getByTestId("menu-view-submenu-simulation-mode-item-fast")).toBeVisible();
    await expect(page.getByTestId("menu-view-submenu-simulation-mode-item-quality")).toBeVisible();

    await expect(page.getByTestId("menu-view-item-toggle-diagnostics-panel")).toBeVisible();
    await expect(page.getByTestId("menu-view-item-toggle-design-inspector")).toBeVisible();
  });

  test("design menu contains stitch type and design operations", async ({ page }) => {
    await page.getByTestId("menu-design").click();
    await expect(page.getByTestId("menu-design-panel")).toBeVisible();

    const stitchType = page.getByTestId("menu-design-item-stitch-type");
    await expect(stitchType).toBeVisible();
    await stitchType.hover();
    await expect(page.getByTestId("menu-design-submenu-stitch-type")).toBeVisible();
    for (const stitchTypeName of ["running", "satin", "tatami", "contour", "spiral", "motif"]) {
      await expect(
        page.getByTestId(`menu-design-submenu-stitch-type-item-${stitchTypeName}`),
      ).toBeVisible();
    }

    await expect(page.getByTestId("menu-design-item-assign-thread-color")).toBeVisible();
    await expect(page.getByTestId("menu-design-item-auto-digitize-selection")).toBeVisible();
    await expect(page.getByTestId("menu-design-item-validate-design")).toBeVisible();
    await expect(page.getByTestId("menu-design-item-repair-geometry")).toBeVisible();
  });

  test("routing menu contains policy, sequence mode, tie mode, reverse, and inspector link", async ({
    page,
  }) => {
    await page.getByTestId("menu-routing").click();
    await expect(page.getByTestId("menu-routing-panel")).toBeVisible();

    const routingPolicy = page.getByTestId("menu-routing-item-routing-policy");
    await expect(routingPolicy).toBeVisible();
    await routingPolicy.hover();
    await expect(page.getByTestId("menu-routing-submenu-routing-policy")).toBeVisible();
    await expect(
      page.getByTestId("menu-routing-submenu-routing-policy-item-balanced"),
    ).toBeVisible();
    await expect(
      page.getByTestId("menu-routing-submenu-routing-policy-item-min-travel"),
    ).toBeVisible();
    await expect(
      page.getByTestId("menu-routing-submenu-routing-policy-item-min-trims"),
    ).toBeVisible();

    const sequenceMode = page.getByTestId("menu-routing-item-sequence-mode");
    await expect(sequenceMode).toBeVisible();
    await sequenceMode.hover();
    await expect(page.getByTestId("menu-routing-submenu-sequence-mode")).toBeVisible();
    await expect(
      page.getByTestId("menu-routing-submenu-sequence-mode-item-strict-sequencer"),
    ).toBeVisible();
    await expect(
      page.getByTestId("menu-routing-submenu-sequence-mode-item-optimizer"),
    ).toBeVisible();

    await expect(page.getByTestId("menu-routing-item-global-tie-mode")).toBeVisible();
    await expect(page.getByTestId("menu-routing-item-allow-reverse")).toBeVisible();
    await expect(page.getByTestId("menu-routing-item-open-full-routing-settings")).toBeVisible();
  });

  test("help menu contains keyboard shortcuts, documentation, and about", async ({ page }) => {
    await page.getByTestId("menu-help").click();
    await expect(page.getByTestId("menu-help-panel")).toBeVisible();
    await expect(page.getByTestId("menu-help-item-keyboard-shortcuts")).toBeVisible();
    await expect(page.getByTestId("menu-help-item-documentation")).toBeVisible();
    await expect(page.getByTestId("menu-help-item-about-vision")).toBeVisible();
  });

  test("all menu actions show inline shortcuts and shortcuts trigger matching commands", async ({
    page,
  }) => {
    const menus = ["file", "edit", "view", "design", "routing", "help"] as const;

    for (const menu of menus) {
      await page.getByTestId(`menu-${menu}`).click();
      const panel = page.getByTestId(`menu-${menu}-panel`);
      await expect(panel).toBeVisible();

      const directItems = panel.locator(`button[data-testid^='menu-${menu}-item-']`);
      const count = await directItems.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const item = directItems.nth(index);
        await expect(item.locator("[data-testid$='-shortcut']")).toBeVisible();
      }
      await page.keyboard.press("Escape");
    }

    const submenuSpecs = [
      { menu: "file", trigger: "menu-file-item-export", panel: "menu-file-submenu-export" },
      {
        menu: "view",
        trigger: "menu-view-item-simulation-mode",
        panel: "menu-view-submenu-simulation-mode",
      },
      {
        menu: "design",
        trigger: "menu-design-item-stitch-type",
        panel: "menu-design-submenu-stitch-type",
      },
      {
        menu: "routing",
        trigger: "menu-routing-item-routing-policy",
        panel: "menu-routing-submenu-routing-policy",
      },
      {
        menu: "routing",
        trigger: "menu-routing-item-sequence-mode",
        panel: "menu-routing-submenu-sequence-mode",
      },
    ] as const;
    for (const submenuSpec of submenuSpecs) {
      await page.getByTestId(`menu-${submenuSpec.menu}`).click();
      await page.getByTestId(submenuSpec.trigger).hover();
      const submenu = page.getByTestId(submenuSpec.panel);
      await expect(submenu).toBeVisible();
      const submenuItems = submenu.locator("button[data-testid*='-item-']");
      const count = await submenuItems.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const item = submenuItems.nth(index);
        await expect(item.locator("[data-testid$='-shortcut']")).toBeVisible();
      }
      await page.keyboard.press("Escape");
    }

    await page.keyboard.press("Control+Shift+D");
    await expect(page.getByTestId("status-command")).toContainText(
      "View / Toggle Diagnostics Panel",
    );
    await page.keyboard.press("F1");
    await expect(page.getByTestId("status-command")).toContainText("Help / Documentation");
    await page.keyboard.press("Alt+2");
    await expect(page.getByTestId("status-command")).toContainText("File / Export > PES");
    await page.keyboard.press("Control+Shift+Z");
    await expect(page.getByTestId("status-command")).toContainText("Edit / Redo");
  });

  test("floating toolbar exposes only select pen text rect ellipse tools with shortcuts", async ({
    page,
  }) => {
    const toolbar = page.getByRole("toolbar", { name: "Drawing tools" });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveClass(/backdrop-blur/);

    const toolButtons = toolbar.locator("button[data-testid^='tool-']");
    await expect(toolButtons).toHaveCount(5);

    const select = page.getByTestId("tool-select");
    const pen = page.getByTestId("tool-pen");
    const text = page.getByTestId("tool-text");
    const rect = page.getByTestId("tool-rect");
    const ellipse = page.getByTestId("tool-ellipse");
    await expect(select).toBeVisible();
    await expect(pen).toBeVisible();
    await expect(text).toBeVisible();
    await expect(rect).toBeVisible();
    await expect(ellipse).toBeVisible();

    await page.keyboard.press("t");
    await expect(text).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("v");
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("p");
    await expect(pen).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("r");
    await expect(rect).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("e");
    await expect(ellipse).toHaveAttribute("aria-pressed", "true");
  });

  test("status bar reports live metrics and opens diagnostics from severity summary", async ({
    page,
  }) => {
    const statusBar = page.getByTestId("status-bar");
    const canvas = page.getByTestId("design-canvas");
    await expect(statusBar).toBeVisible();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    await expect(page.getByTestId("status-cursor")).toContainText(/mm/);
    await page.mouse.wheel(0, -200);
    await expect(page.getByTestId("status-zoom")).toContainText(/Zoom \d+%/);

    await page.getByTestId("tool-rect").click();
    await page.mouse.move(cx - 35, cy - 35);
    await page.mouse.down();
    await page.mouse.move(cx + 35, cy + 35, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByTestId("status-objects")).not.toHaveText("Objects 0", {
      timeout: 3_000,
    });
    await expect(page.getByTestId("status-stitches")).toContainText(/Stitches \d+/);
    await expect(page.getByTestId("status-colors")).toContainText(/Colors \d+/);
    await expect(page.getByTestId("status-sew-time")).toContainText(/Sew \d+:\d{2}/);
    await expect(page.getByTestId("status-severity")).toContainText("No diagnostics");

    await page.getByTestId("tool-pen").click();
    await page.mouse.click(cx - 50, cy - 30);
    await page.mouse.click(cx + 20, cy - 10);
    await page.mouse.click(cx + 10, cy + 35);
    await page.keyboard.press("Enter");

    const stitchType = page.getByTestId("prop-stitch-type");
    await expect(stitchType).toBeVisible();
    await stitchType.selectOption("tatami");

    await expect(page.getByTestId("status-severity")).toContainText(/error|warning/, {
      timeout: 4_000,
    });
    await page.getByTestId("status-severity-button").click();
    await expect(page.getByTestId("diagnostics-drawer")).toBeVisible();
    await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
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

    // Wait for the new shape row to appear in the sequencer
    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 3_000,
    });

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

    // Wait for the new shape row to appear in the sequencer
    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 3_000,
    });

    const pesBtn = page.getByTestId("export-pes-btn");
    await expect(pesBtn).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await pesBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.pes");
  });

  test("export PEC triggers download after shape creation", async ({ page }) => {
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

    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 3_000,
    });

    const pecBtn = page.getByTestId("export-pec-btn");
    await expect(pecBtn).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await pecBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("design.pec");
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

    await expect(page.getByTestId("prop-underlay-mode")).toBeVisible();
    await expect(page.getByTestId("prop-comp-mode")).toBeVisible();
    await expect(page.locator("#prop-pull-comp")).toBeVisible();

    await page.getByTestId("prop-comp-mode").selectOption("directional");
    await expect(page.locator("#prop-comp-x")).toBeVisible();
    await expect(page.locator("#prop-comp-y")).toBeVisible();
  });

  test("fill controls are available for tatami objects", async ({ page }) => {
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
    await stitchType.selectOption("tatami");

    await expect(page.locator("#prop-min-segment")).toBeVisible();
    await expect(page.locator("#prop-fill-overlap")).toBeVisible();
    await expect(page.getByTestId("prop-fill-start-mode")).toBeVisible();
    await expect(page.getByTestId("prop-edge-walk-fill")).toBeVisible();
  });

  test("routing reverse toggle is available", async ({ page }) => {
    await expect(page.getByTestId("routing-policy-select")).toBeVisible();
    await expect(page.getByTestId("routing-allow-reverse")).toBeVisible();
    await expect(page.getByTestId("toggle-simulation-mode")).toBeVisible();
  });

  test("advanced routing controls and metrics panel are available", async ({ page }) => {
    await page.getByTestId("routing-advanced-toggle").click();
    await expect(page.getByTestId("routing-advanced-panel")).toBeVisible();
    await expect(page.getByTestId("routing-sequence-mode")).toBeVisible();
    await expect(page.getByTestId("routing-entry-exit")).toBeVisible();
    await expect(page.getByTestId("routing-tie-mode")).toBeVisible();
    await expect(page.getByTestId("routing-max-jump")).toBeVisible();
    await expect(page.getByTestId("routing-trim-threshold")).toBeVisible();
    await expect(page.getByTestId("routing-min-run-before-trim")).toBeVisible();
    await expect(page.getByTestId("routing-allow-underpath")).toBeVisible();
    await expect(page.getByTestId("routing-allow-color-merge")).toBeHidden();
    await page.getByTestId("routing-sequence-mode").selectOption("optimizer");
    await expect(page.getByTestId("routing-allow-color-merge")).toBeVisible();
    await expect(page.getByTestId("routing-metrics-panel")).toBeVisible();
    await expect(page.getByTestId("routing-metrics-inline")).toBeVisible();
    await expect(page.getByTestId("quality-metrics-panel")).toBeVisible();
  });
});

test.describe("Diagnostics Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("engine-status");
    await expect(status).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("open tatami path appears in diagnostics", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-pen").click();
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx - 50, cy - 30);
    await page.mouse.click(cx + 20, cy - 10);
    await page.mouse.click(cx + 10, cy + 35);
    await page.keyboard.press("Enter");

    const stitchType = page.getByTestId("prop-stitch-type");
    await expect(stitchType).toBeVisible();
    await stitchType.selectOption("tatami");

    await page.getByTestId("status-severity-button").click();
    await expect(page.getByTestId("diagnostics-drawer")).toBeVisible();
    await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
    await expect(page.getByTestId("diagnostics-count-error")).not.toHaveText("0", {
      timeout: 3_000,
    });
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

  test("clicking a sequencer row does not crash (BigInt regression)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-rect").click();
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    const sequencerTree = page.getByTestId("sequencer-tree");
    await expect(sequencerTree).toBeVisible({ timeout: 5_000 });

    // Click on the first sequencer row
    const sequencerRow = page.locator("[data-testid^='sequencer-row-']").first();
    await expect(sequencerRow).toBeVisible();
    await sequencerRow.click();

    // Verify selection state is applied to the row container.
    await expect(sequencerRow.locator("div").first()).toHaveClass(/bg-accent\/70/);

    // No errors should have been thrown (previously crashed with "can't convert undefined to BigInt")
    expect(errors).toEqual([]);
  });

  test("per-row sequencer routing overrides can be edited from the left panel", async ({
    page,
  }) => {
    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-rect").click();

    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 5_000,
    });

    const routingToggle = page.locator("[data-testid^='sequencer-routing-toggle-']").first();
    await expect(routingToggle).toBeVisible();
    await routingToggle.click();

    const allowReverse = page.locator("[data-testid^='sequencer-routing-allow-reverse-']").first();
    const entryExit = page.locator("[data-testid^='sequencer-routing-entry-exit-']").first();
    const tieMode = page.locator("[data-testid^='sequencer-routing-tie-mode-']").first();
    const trimBefore = page.locator("[data-testid^='sequencer-command-trim-before-']").first();
    const trimAfter = page.locator("[data-testid^='sequencer-command-trim-after-']").first();
    const tieIn = page.locator("[data-testid^='sequencer-command-tie-in-']").first();
    const tieOut = page.locator("[data-testid^='sequencer-command-tie-out-']").first();

    await expect(allowReverse).toBeVisible();
    await expect(entryExit).toBeVisible();
    await expect(tieMode).toBeVisible();
    await expect(trimBefore).toBeVisible();
    await expect(trimAfter).toBeVisible();
    await expect(tieIn).toBeVisible();
    await expect(tieOut).toBeVisible();

    await allowReverse.selectOption("force_off");
    await entryExit.selectOption("preserve_shape_start");
    await tieMode.selectOption("color_change");
    await trimBefore.selectOption("force_on");
    await trimAfter.selectOption("force_off");
    await tieIn.selectOption("force_on");
    await tieOut.selectOption("force_off");

    await expect(
      page.locator("[data-testid^='sequencer-routing-badge-rev-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-routing-badge-entry-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-routing-badge-tie-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-command-badge-trim-before-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-command-badge-trim-after-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-command-badge-tie-in-']").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid^='sequencer-command-badge-tie-out-']").first(),
    ).toBeVisible();

    // Wait beyond the polling refresh interval to ensure overrides persist in engine state.
    await page.waitForTimeout(700);
    await expect(allowReverse).toHaveValue("force_off");
    await expect(entryExit).toHaveValue("preserve_shape_start");
    await expect(tieMode).toHaveValue("color_change");
    await expect(trimBefore).toHaveValue("force_on");
    await expect(trimAfter).toHaveValue("force_off");
    await expect(tieIn).toHaveValue("force_on");
    await expect(tieOut).toHaveValue("force_off");

    await allowReverse.selectOption("inherit");
    await entryExit.selectOption("inherit");
    await tieMode.selectOption("inherit");
    await trimBefore.selectOption("inherit");
    await trimAfter.selectOption("inherit");
    await tieIn.selectOption("inherit");
    await tieOut.selectOption("inherit");

    await expect(page.locator("[data-testid^='sequencer-routing-badge-rev-']")).toHaveCount(0);
    await expect(page.locator("[data-testid^='sequencer-routing-badge-entry-']")).toHaveCount(0);
    await expect(page.locator("[data-testid^='sequencer-routing-badge-tie-']")).toHaveCount(0);
    await expect(page.locator("[data-testid^='sequencer-command-badge-trim-before-']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-testid^='sequencer-command-badge-trim-after-']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-testid^='sequencer-command-badge-tie-in-']")).toHaveCount(0);
    await expect(page.locator("[data-testid^='sequencer-command-badge-tie-out-']")).toHaveCount(0);
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
    const sequencerRows = page.locator("[data-testid^='sequencer-row-']");

    // Initially should have no stitch rows
    await expect(sequencerRows).toHaveCount(0, { timeout: 5_000 });

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

    // Wait for the new shape row to appear
    await expect(sequencerRows).toHaveCount(1, { timeout: 3_000 });

    // Ensure the page has focus for keyboard shortcuts
    await canvas.click({ position: { x: cx, y: cy } });

    // Undo — should remove the rectangle
    await page.keyboard.press("Control+z");
    await expect(sequencerRows).toHaveCount(0, { timeout: 5_000 });

    // Redo — should restore the rectangle
    await page.keyboard.press("Control+Shift+z");
    await expect(sequencerRows).toHaveCount(1, { timeout: 5_000 });
  });

  test("select tool drag moves shape on canvas", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-rect").click();
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 5_000,
    });

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 30, { steps: 8 });
    await page.mouse.up();

    // If drag-move committed, first undo should revert movement but keep the shape.
    await canvas.click({ position: { x: cx, y: cy } });
    await page.keyboard.press("Control+z");
    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 5_000,
    });

    // Second undo should remove the shape creation command.
    await page.keyboard.press("Control+z");
    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(0, {
      timeout: 5_000,
    });
  });

  test("sequencer shows stitch objects after shape creation", async ({ page }) => {
    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-rect").click();
    const box = await canvas.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
      timeout: 5_000,
    });
  });
});
