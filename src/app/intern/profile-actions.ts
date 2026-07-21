"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { PROFILE_DOC_ID } from "@/lib/auth/types";

export async function updateOwnBio(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const bio = String(formData.get("bio") ?? "").trim();

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("profile")
    .doc(PROFILE_DOC_ID)
    .set({ bio }, { merge: true });
  revalidatePath("/intern/profile");
}
