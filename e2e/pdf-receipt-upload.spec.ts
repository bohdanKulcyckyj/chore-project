/**
 * E2E test for PDF receipt upload and parsing in real browser.
 *
 * This test verifies that PDF.js works correctly in production browser environment,
 * specifically checking if the worker is properly configured.
 *
 * Prerequisites:
 * - Supabase running locally (supabase start)
 * - Frontend dev server running (npm run dev)
 * - Test user created and authenticated
 * - PDF receipts in receipts/<shop>/
 */

import { test, expect } from "@playwright/test";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { setupTestUserAndHousehold } from "./helpers/auth";

const BASE_URL = "http://localhost:5173";

// Shop folder → the shop name its parser reports. Image-only folders (lidl)
// are left out: browser OCR takes ~30s per receipt, and Node covers it.
const SHOPS: Record<string, string> = {
  albert: "Albert",
  ikea: "IKEA",
  kaufland: "Kaufland",
};

// One PDF per shop — enough to prove each parser runs in a real browser.
const findTestPDFs = (): { shop: string; file: string }[] =>
  Object.entries(SHOPS).flatMap(([folder, shop]) => {
    const dir = join("receipts", folder);
    if (!existsSync(dir)) return [];
    const pdf = readdirSync(dir).find((f: string) => f.endsWith(".pdf"));
    return pdf ? [{ shop, file: join(dir, pdf) }] : [];
  });

const num = (value: string): number => parseFloat(value.replace(",", "."));

test.describe("PDF Receipt Upload and Parsing", () => {
  const testPDFs = findTestPDFs();

  test.beforeEach(async ({ page }) => {
    // Enable verbose console logging
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();

      // Highlight PDF.js related messages
      if (
        text.includes("[PDF.js]") ||
        text.includes("pdf") ||
        text.includes("worker")
      ) {
        console.log(`🔍 [BROWSER ${type.toUpperCase()}]:`, text);
      } else {
        console.log(`[Browser ${type}]:`, text);
      }
    });

    // Catch errors
    page.on("pageerror", (error) => {
      console.error("❌ [BROWSER ERROR]:", error.message);
      console.error("Stack:", error.stack);
    });

    // Don't navigate here - each test will handle its own navigation
  });

  test("should upload PDF and extract receipt data without worker errors", async ({
    page,
  }) => {
    test.skip(testPDFs.length === 0, "No test PDF found in receipts/ folder");

    console.log("📄 Using test PDFs:", testPDFs.map((p) => p.file).join(", "));

    // Step 1: Create test user and household
    console.log("🔧 Setting up test user and household...");
    await setupTestUserAndHousehold(page);

    console.log("✅ Test user and household created");

    // Wait for app to be fully loaded
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // Step 2: Navigate to budget page
    console.log("📊 Navigating to budget page...");
    const budgetLink = page.locator(
      'a[href*="budget"], button:has-text("Budget")',
    );
    if ((await budgetLink.count()) > 0) {
      await budgetLink.first().click();
      await page.waitForLoadState("networkidle");
    } else {
      // Try direct navigation
      await page.goto(`${BASE_URL}/budget`);
      await page.waitForLoadState("networkidle");
    }

    // Step 3: Open the purchase editor modal
    console.log("➕ Opening purchase editor...");
    const addButton = page.locator(
      'button:has-text("Add Purchase"), button:has-text("Add"), button:has-text("New Purchase")',
    );
    await addButton.first().click({ timeout: 10000 });

    // Wait for modal/form to appear
    await page.waitForTimeout(1500);

    // The input is hidden but setInputFiles still works. Each upload replaces
    // the form state, so one modal covers every shop.
    const fileInput = page.locator('input[type="file"]').first();
    const shopInput = page.locator('input[placeholder="e.g., Albert"]');
    const totalInput = page.locator('input[placeholder^="Items sum"]');
    const itemNames = page.locator('input[placeholder="Item name"]');
    const itemPrices = page.locator('input[title="Price (Kč)"]');

    for (const { shop, file } of testPDFs) {
      console.log(`📤 Uploading ${file}...`);
      await fileInput.setInputFiles(file);

      // Wait for parsing to complete (look for "Reading receipt…" to disappear)
      await expect(page.locator("text=Reading receipt…"))
        .toBeVisible({ timeout: 2000 })
        .catch(() => {});
      await expect(page.locator("text=Reading receipt…")).not.toBeVisible({
        timeout: 60000,
      });

      // Right parser picked, and it filled the form
      await expect(shopInput).toHaveValue(shop);
      const total = num(await totalInput.inputValue());
      expect(total).toBeGreaterThan(0);
      expect(await itemNames.count()).toBeGreaterThan(0);

      // Same gate as the Node pipeline test: every item named and priced,
      // |Σ item totals − receipt total| < 0.01 Kč
      const names = await itemNames.evaluateAll((els) =>
        (els as HTMLInputElement[]).map((el) => el.value),
      );
      const prices = await itemPrices.evaluateAll((els) =>
        (els as HTMLInputElement[]).map((el) => el.value),
      );
      for (const name of names) expect(name).not.toBe("");
      const sum = prices.reduce((s, p) => s + num(p), 0);
      expect(Math.abs(sum - total)).toBeLessThan(0.01);

      console.log(`✅ ${shop}: ${names.length} items, total ${total}`);
      await page.screenshot({
        path: `e2e/screenshots/pdf-upload-${shop.toLowerCase()}.png`,
        fullPage: true,
      });
    }
  });

  test("should log worker configuration status", async ({ page }) => {
    // Check GlobalWorkerOptions in browser
    const workerConfig = await page.evaluate(async () => {
      // Try to access PDF.js if it's loaded
      return {
        hasWindow: typeof window !== "undefined",
        hasPdfjsDist:
          typeof (window as unknown as { pdfjsLib?: unknown }).pdfjsLib !==
          "undefined",
        // Try to trigger PDF.js load by importing
        timestamp: new Date().toISOString(),
      };
    });

    console.log("🔍 Browser environment:", workerConfig);
    expect(workerConfig.hasWindow).toBe(true);
  });
});
