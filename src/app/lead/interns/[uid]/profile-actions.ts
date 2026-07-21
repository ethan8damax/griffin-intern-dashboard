"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { ProfileDoc } from "@/lib/auth/types";

export async function updateProfile(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const manager = String(formData.get("manager") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  if (!uid) {
    throw new Error("Missing intern id.");
  }
  if (!Number.isFinite(capacity) || capacity < 0 || capacity > 100) {
    throw new Error("Capacity must be a number between 0 and 100.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const profile: ProfileDoc = { role, manager, department, startDate, bio, capacity };
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data")
    .set(profile, { merge: true });
  revalidatePath(`/lead/interns/${uid}/profile`);
}
