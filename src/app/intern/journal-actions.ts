// src/app/intern/journal-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { JournalEntryDoc } from "@/lib/auth/types";

const VALID_TYPES = ["win", "blocker", "checkin", "note"];

export async function addJournalEntry(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const date = String(formData.get("date") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!date || !text) {
    throw new Error("Missing date or entry text.");
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error("Invalid entry type.");
  }

  const entry: JournalEntryDoc = { date, type: type as JournalEntryDoc["type"], text, createdAt: Date.now() };
  await getAdminDb().collection("users").doc(user.uid).collection("journal").add(entry);
  revalidatePath("/intern/journal");
}

export async function deleteJournalEntry(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!entryId) {
    throw new Error("Missing entry id.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("journal")
    .doc(entryId)
    .delete();
  revalidatePath("/intern/journal");
}
