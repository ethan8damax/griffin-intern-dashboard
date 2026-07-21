"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import { parsePercent, PROFILE_DOC_ID, type ProfileDoc } from "@/lib/auth/types";

export async function updateProfile(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const manager = String(formData.get("manager") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  if (!uid) {
    throw new Error("Missing intern id.");
  }
  const capacity = parsePercent(String(formData.get("capacity") ?? "0"), "Capacity");
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const profile: ProfileDoc = { role, manager, department, startDate, bio, capacity };
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc(PROFILE_DOC_ID)
    .set(profile, { merge: true });
  revalidatePath(`/lead/interns/${uid}/profile`);
}
