/**
 * E2E regression test: a NON-ADMIN household member can view a receipt.
 *
 * Bug history: receipts opened fine for the admin (desktop) but silently
 * failed for members on iOS Safari, because window.open() was called after
 * an await — outside the user-gesture call stack. Storage RLS was fine.
 * This test covers the whole member flow: upload (storage INSERT policy),
 * purchase insert (RLS), and viewing via the signed-URL popup.
 *
 * Prerequisites:
 * - Supabase running locally (supabase start)
 * - Frontend dev server running (npm run dev)
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn, TestUser } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// Fixed local-dev demo keys printed by `supabase start` (not secrets).
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const RUN_ID = Date.now();
const SHOP_NAME = `E2E Receipt Shop ${RUN_ID}`;
const RECEIPT_CONTENT = `fake pdf content ${RUN_ID}`;

const adminUser: TestUser = {
  email: `e2e-receipt-admin-${RUN_ID}@example.com`,
  password: "TestPassword123!",
  displayName: "E2E Admin",
};
const memberUser: TestUser = {
  email: `e2e-receipt-member-${RUN_ID}@example.com`,
  password: "TestPassword123!",
  displayName: "E2E Member",
};

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let adminId: string;
let memberId: string;
let householdId: string;
let receiptPath: string;

test.beforeAll(async () => {
  // Two users: household admin + regular member (the role under test)
  for (const [user, target] of [
    [adminUser, "admin"],
    [memberUser, "member"],
  ] as const) {
    const { data, error } = await svc.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });
    if (error) throw error;
    if (target === "admin") adminId = data.user.id;
    else memberId = data.user.id;
  }

  const { data: household, error: hhError } = await svc
    .from("households")
    .insert({
      name: `E2E Receipt Household ${RUN_ID}`,
      invite_code: `E2E${RUN_ID.toString(36).toUpperCase()}`,
      created_by: adminId,
    })
    .select("id")
    .single();
  if (hhError) throw hhError;
  householdId = household.id;

  const { error: membersError } = await svc.from("household_members").insert([
    { household_id: householdId, user_id: adminId, role: "admin" },
    { household_id: householdId, user_id: memberId, role: "member" },
  ]);
  if (membersError) throw membersError;

  // Seed purchase + receipt AS THE MEMBER, mirroring the app's uploadReceipt
  // flow, so the member-facing RLS policies are exercised too.
  const memberClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await memberClient.auth.signInWithPassword({
    email: memberUser.email,
    password: memberUser.password,
  });
  if (signInError) throw signInError;

  const { data: purchase, error: purchaseError } = await memberClient
    .from("purchases")
    .insert({
      household_id: householdId,
      shop_name: SHOP_NAME,
      purchased_at: new Date().toISOString(),
      paid_by: memberId,
      total_amount: 123.5,
      created_by: memberId,
    })
    .select("id")
    .single();
  if (purchaseError) throw purchaseError;

  receiptPath = `${householdId}/${purchase.id}.pdf`;
  const { error: uploadError } = await memberClient.storage
    .from("receipts")
    .upload(receiptPath, Buffer.from(RECEIPT_CONTENT), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: updateError } = await memberClient
    .from("purchases")
    .update({ receipt_url: receiptPath })
    .eq("id", purchase.id);
  if (updateError) throw updateError;

  await memberClient.auth.signOut();
});

test.afterAll(async () => {
  if (receiptPath) await svc.storage.from("receipts").remove([receiptPath]);
  // purchases + household_members cascade from the household delete
  if (householdId) await svc.from("households").delete().eq("id", householdId);
  if (adminId) await svc.auth.admin.deleteUser(adminId);
  if (memberId) await svc.auth.admin.deleteUser(memberId);
});

test("non-admin member can open a receipt from the budget page", async ({
  page,
  context,
}) => {
  await signIn(page, memberUser);

  await page.getByRole("button", { name: "Budget" }).click();
  await expect(page.getByText(SHOP_NAME)).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  // The popup navigates to the signed URL; headless Chromium treats the PDF
  // response as a download and aborts page load, so assert on the GET request
  // instead of the popup's final URL.
  const signedUrlRequestPromise = context.waitForEvent("request", (request) =>
    request.method() === "GET" &&
    /\/storage\/v1\/object\/sign\/receipts\//.test(request.url()),
  );
  await page.getByRole("button", { name: "View receipt" }).click();

  // The tab opens synchronously (iOS Safari popup-blocker regression guard),
  // then gets redirected to the signed storage URL.
  await popupPromise;
  const signedUrlRequest = await signedUrlRequestPromise;

  // The signed URL must actually serve the member's uploaded file.
  const response = await page.request.get(signedUrlRequest.url());
  expect(response.status()).toBe(200);
  expect((await response.body()).toString()).toBe(RECEIPT_CONTENT);

  await expect(page.getByText("Failed to open receipt")).toHaveCount(0);
});
