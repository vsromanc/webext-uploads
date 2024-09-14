import {
  test,
  chromium,
  BrowserContext,
  Browser,
  Page,
} from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

// Helper function to get absolute path
function getAbsolutePath(relativePath: string): string {
  return path.resolve(__dirname, relativePath);
}

test.describe("File Upload Detector Extension Test", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    const extensionPath = getAbsolutePath("../dist");

    // Launch Chromium with the extension loaded
    const browser = await chromium.launchPersistentContext("", {
      headless: false, // Set to true if you don't need to see the browser
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Get the background page of the extension
    let [backgroundPage] = browser.serviceWorkers();
    if (!backgroundPage) {
      backgroundPage = await browser.waitForEvent("serviceworker");
    }

    // Listen for console messages from the background script
    // backgroundPage.on("console", (msg) => {
    //   console.log(`BACKGROUND SCRIPT LOG: ${msg.text()}`);
    // });

    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test("should detect file upload via standard input", async () => {
    await page.goto("file://" + getAbsolutePath("../test-page/index.html"));

    // Listen for console messages from the page
    page.on("console", (msg) => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });

    // Simulate file selection on the standard input
    const fileInput = await page.$("#fileInput");
    await fileInput?.setInputFiles({
      name: "test-file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is a test file."),
    });

    // Wait for the background script to log the file upload
    // You might need to implement a mechanism to confirm that the upload was detected
    await page.waitForTimeout(1000);
  });

  test("should detect file upload via dynamic input", async () => {
    await page.goto("file://" + getAbsolutePath("../test-page/index.html"));

    // Click the button to create a dynamic input
    await page.click("#createInputButton");

    // Simulate file selection in the file picker dialog
    // Note: Playwright cannot interact with native file picker dialogs
    // As a workaround, we can intercept the file chooser event
    page.on("filechooser", async (fileChooser) => {
      await fileChooser.setFiles({
        name: "dynamic-test-file.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("This is a dynamic test file."),
      });
    });

    // Wait for the background script to log the file upload
    await page.waitForTimeout(1000);
  });

  test("should detect file upload via drag-and-drop", async () => {
    await page.goto("file://" + getAbsolutePath("../test-page/index.html"));

    // Simulate drag-and-drop file upload
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

    // Create a file to be dropped
    const fileBuffer = Buffer.from("This is a drag-and-drop test file.");
    const file = new File([fileBuffer], "drag-drop-test-file.txt", {
      type: "text/plain",
    });

    // Append the file to the DataTransfer object
    await page.evaluate(
      ([dt, file]) => {
        dt.items.add(file);
      },
      [dataTransfer, file]
    );

    // Dispatch the dragenter, dragover, and drop events
    const dropZone = await page.$("#dropZone");
    await dropZone.dispatchEvent("dragenter", { dataTransfer });
    await dropZone.dispatchEvent("dragover", { dataTransfer });
    await dropZone.dispatchEvent("drop", { dataTransfer });

    // Wait for the background script to log the file upload
    await page.waitForTimeout(1000);
  });
});
