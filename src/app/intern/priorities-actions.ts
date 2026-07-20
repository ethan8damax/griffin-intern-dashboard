"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { PriorityDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["Done", "In Progress", "Not Started", "Blocked"];

export async function addPriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const text = String(formData.get("text") ?? "").trim();
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!text || !weekOf) {
    throw new Error("Missing text or week.");
  }

  const priority: PriorityDoc = {
    text,
    weekOf,
    status: "Not Started",
    linkedGoalId,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(user.uid).collection("priorities").add(priority);
  revalidatePath("/intern/priorities");
}

export async function updatePriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!priorityId || !text) {
    throw new Error("Missing priority id or text.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .doc(priorityId)
    .update({ text, status, linkedGoalId });
  revalidatePath("/intern/priorities");
}

export async function deletePriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  if (!priorityId) {
    throw new Error("Missing priority id.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .doc(priorityId)
    .delete();
  revalidatePath("/intern/priorities");
}
