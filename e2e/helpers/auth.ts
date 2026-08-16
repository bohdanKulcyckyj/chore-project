/**
 * E2E test authentication helpers
 *
 * Handles user signup, login, and household creation for tests.
 */

import { Page } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export interface TestHousehold {
  name: string;
  inviteCode?: string;
}

/**
 * Generate a unique test user for this test run
 */
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: "TestPassword123!",
    displayName: `Test User ${timestamp}`,
  };
}

/**
 * Generate a unique household name
 */
export function generateTestHousehold(): TestHousehold {
  const timestamp = Date.now();
  return {
    name: `E2E Test Household ${timestamp}`,
  };
}

/**
 * Sign up a new user via the UI
 */
export async function signUp(page: Page, user: TestUser): Promise<void> {
  console.log(`📝 Signing up user: ${user.email}`);

  // Navigate to signup page
  await page.goto("/");

  // Wait for page to load
  await page.waitForLoadState("networkidle");

  // Look for sign up link/button
  const signUpButton = page.locator(
    'a[href*="signup"], button:has-text("Sign Up"), a:has-text("Sign Up")',
  );

  if ((await signUpButton.count()) > 0) {
    await signUpButton.first().click();
    await page.waitForLoadState("networkidle");
  }

  // Fill in signup form
  await page.fill('input[type="email"], input[name="email"]', user.email);
  await page.fill(
    'input[type="password"], input[name="password"]',
    user.password,
  );

  // Display name might be optional
  const displayNameInput = page.locator(
    'input[name="display_name"], input[placeholder*="name"]',
  );
  if ((await displayNameInput.count()) > 0) {
    await displayNameInput.first().fill(user.displayName);
  }

  // Submit form
  await page.click(
    'button[type="submit"], button:has-text("Sign Up"), button:has-text("Create Account")',
  );

  // Wait for navigation after signup
  await page.waitForLoadState("networkidle");

  console.log("✅ User signed up successfully");
}

/**
 * Sign in an existing user
 */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  console.log(`🔐 Signing in user: ${user.email}`);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Look for sign in link/button
  const signInButton = page.locator(
    'a[href*="signin"], a[href*="login"], button:has-text("Sign In"), a:has-text("Sign In")',
  );

  if ((await signInButton.count()) > 0) {
    await signInButton.first().click();
    await page.waitForLoadState("networkidle");
  }

  // Fill in login form
  await page.fill('input[type="email"], input[name="email"]', user.email);
  await page.fill(
    'input[type="password"], input[name="password"]',
    user.password,
  );

  // Submit
  await page.click(
    'button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")',
  );

  await page.waitForLoadState("networkidle");

  console.log("✅ User signed in successfully");
}

/**
 * Create a new household via the UI
 */
export async function createHousehold(
  page: Page,
  household: TestHousehold,
): Promise<void> {
  console.log(`🏠 Creating household: ${household.name}`);

  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Look for "Create Household" button - might be in a card or directly on the page
  const createButton = page.locator(
    'button:has-text("Create Household"), button:has-text("New Household"), a:has-text("Create")',
  );

  // Wait for the button to appear
  await createButton.first().waitFor({ state: "visible", timeout: 10000 });
  await createButton.first().click();

  // Wait for modal/form to appear
  await page.waitForTimeout(1000);

  // Fill in household name - look for the input with "Smith Family" placeholder or similar
  const nameInput = page
    .locator('input[placeholder*="Smith"], input[placeholder*="household"]')
    .first();
  await nameInput.waitFor({ state: "visible", timeout: 5000 });
  await nameInput.fill(household.name);

  // Optional: fill description
  const descInput = page.locator('textarea[placeholder*="description"]');
  if ((await descInput.count()) > 0) {
    await descInput
      .first()
      .fill(`E2E test household created at ${new Date().toISOString()}`);
  }

  // Submit - look for submit button
  const submitButton = page.locator('button[type="submit"]:has-text("Create")');
  await submitButton.click();

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("✅ Household created successfully");
}

/**
 * Complete authentication flow: signup + create household
 */
export async function setupTestUserAndHousehold(
  page: Page,
): Promise<{ user: TestUser; household: TestHousehold }> {
  const user = generateTestUser();
  const household = generateTestHousehold();

  await signUp(page, user);
  await createHousehold(page, household);

  return { user, household };
}
