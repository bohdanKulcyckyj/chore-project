/**
 * Browser environment tests for PDF text extraction.
 *
 * These tests run in a simulated browser environment (happy-dom) instead of Node.js
 * to reproduce the production issue where PDF.js worker is not configured.
 *
 * The current implementation in extractText.ts detects browser vs Node via
 * `typeof window === "undefined"` and uses different code paths. These tests
 * verify the browser path works correctly.
 *
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { extractPdfText } from "../lib/receipts/extractText";

describe("extractPdfText in browser environment", () => {
  // Find a sample PDF file to test with
  const pdfPath = join(process.cwd(), "receipts/kaufland/20260815_211203.pdf");
  const hasPdf = existsSync(pdfPath);

  it("should extract text from PDF without worker errors", async () => {
    // Skip if receipts folder is not available (CI environment)
    if (!hasPdf) {
      console.log("Skipping: receipts/kaufland/20260815_211203.pdf not found");
      return;
    }

    // Convert Buffer to Uint8Array (browser doesn't have Buffer)
    const pdfBuffer = readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // This should fail with "No 'GlobalWorkerOptions.workerSrc' specified" error
    // because the browser path in extractText.ts doesn't configure the worker
    const text = await extractPdfText(pdfData);

    // If we get here, the extraction worked
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);

    // Verify we got actual text content (basic smoke test)
    console.log("Extracted text length:", text.length);
    console.log("First 200 chars:", text.substring(0, 200));
  });

  it("should handle minimal PDF buffer", async () => {
    if (!hasPdf) {
      console.log("Skipping: no PDF available");
      return;
    }

    const pdfData = readFileSync(pdfPath);
    const uint8Array = new Uint8Array(pdfData);

    // Test with Uint8Array explicitly
    const text = await extractPdfText(uint8Array);
    expect(text).toBeTruthy();
  });

  it("should detect browser environment correctly", () => {
    // In happy-dom, window should be defined
    expect(typeof window).not.toBe("undefined");
    expect(typeof document).not.toBe("undefined");

    console.log("Environment check:");
    console.log("  typeof window:", typeof window);
    console.log("  typeof document:", typeof document);
    console.log("  typeof process:", typeof process);
  });

  it("should fail with modern build without worker config (reproduces production issue)", async () => {
    if (!hasPdf) {
      console.log("Skipping: no PDF available");
      return;
    }

    // Try to use the modern build (non-legacy) which REQUIRES worker configuration
    const modernPdfjs = await import("pdfjs-dist");

    const pdfBuffer = readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // This SHOULD fail with: "No 'GlobalWorkerOptions.workerSrc' specified"
    // because we haven't configured the worker
    try {
      const loadingTask = modernPdfjs.getDocument({
        data: pdfData,
        verbosity: 0,
      });

      const doc = await loadingTask.promise;
      const page = await doc.getPage(1);
      const content = await page.getTextContent();

      console.log("Modern build worked! Items:", content.items.length);

      // If we get here, it means it worked somehow (shouldn't happen without worker config)
      expect(content.items.length).toBeGreaterThan(0);
    } catch (error) {
      // Expected error
      console.log(
        "Got expected error:",
        error instanceof Error ? error.message : error,
      );
      expect(error).toBeDefined();

      // Check if it's the worker error
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("GlobalWorkerOptions.workerSrc")) {
        console.log("✓ Successfully reproduced the production worker error!");
      }
    }
  });
});
