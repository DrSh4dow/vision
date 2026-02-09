import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function drawRectangle(page: Page) {
  const canvas = page.getByTestId("design-canvas");
  await expect(canvas).toBeVisible();
  await page.getByTestId("tool-rect").click();

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounding box unavailable");
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 60, cy - 40);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 60, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator("[data-testid^='sequencer-row-']")).toHaveCount(1, {
    timeout: 3_000,
  });
}

test.describe("Visual Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("engine-status")).toContainText(/Engine v/, { timeout: 15_000 });
  });

  test("home workspace", async ({ page }) => {
    await page.getByTestId("routing-advanced-toggle").click();
    await expect(page.getByTestId("routing-advanced-panel")).toBeVisible();
    await expect(page).toHaveScreenshot("vision-home-workspace.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("satin controls workspace", async ({ page }) => {
    await drawRectangle(page);
    await page.getByTestId("prop-stitch-type").selectOption("satin");
    await expect(page.getByTestId("prop-underlay-mode")).toBeVisible();
    await expect(page.getByTestId("prop-comp-mode")).toBeVisible();
    await expect(page).toHaveScreenshot("vision-satin-controls-workspace.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
