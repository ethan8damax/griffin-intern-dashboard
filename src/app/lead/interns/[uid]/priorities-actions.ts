"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { PriorityDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["Done", "In Progress", "Not Started", "Blocked"];

export async function addPriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!uid || !text || !weekOf) {
    throw new Error("Missing intern id, text, or week.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const priority: PriorityDoc = {
    text,
    weekOf,
    status: "Not Started",
    linkedGoalId,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("priorities").add(priority);
  revalidatePath(`/lead/interns/${uid}/priorities`);
}

export async function updatePriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!uid || !priorityId || !text) {
    throw new Error("Missing intern id, priority id, or text.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .doc(priorityId)
    .update({ text, status, linkedGoalId });
  revalidatePath(`/lead/interns/${uid}/priorities`);
}

export async function deletePriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  if (!uid || !priorityId) {
    throw new Error("Missing intern id or priority id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .doc(priorityId)
    .delete();
  revalidatePath(`/lead/interns/${uid}/priorities`);
}
