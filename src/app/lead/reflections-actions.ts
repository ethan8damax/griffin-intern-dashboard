// src/app/lead/reflections-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireLeadEngagementId } from "@/lib/auth/ownership";
import { REFLECTION_CATEGORIES, type ReflectionDoc } from "@/lib/auth/types";

export async function addReflection(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const category = String(formData.get("category") ?? "").trim();
  const authorUid = String(formData.get("authorUid") ?? "").trim() || null;
  const subjectUid = String(formData.get("subjectUid") ?? "").trim() || null;
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!weekOf || !text) {
    throw new Error("Missing week or text.");
  }
  if (!REFLECTION_CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }

  const reflection: ReflectionDoc = {
    category: category as ReflectionDoc["category"],
    authorUid: category === "work" ? null : authorUid,
    subjectUid: category === "peer" ? subjectUid : null,
    weekOf,
    text,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("engagements").doc(engagementId).collection("reflections").add(reflection);
  revalidatePath("/lead/reflections");
}

export async function updateReflection(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const reflectionId = String(formData.get("reflectionId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const authorUid = String(formData.get("authorUid") ?? "").trim() || null;
  const subjectUid = String(formData.get("subjectUid") ?? "").trim() || null;
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!reflectionId || !weekOf || !text) {
    throw new Error("Missing reflection id, week, or text.");
  }
  if (!REFLECTION_CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }

  await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("reflections")
    .doc(reflectionId)
    .update({
      category,
      authorUid: category === "work" ? null : authorUid,
      subjectUid: category === "peer" ? subjectUid : null,
      weekOf,
      text,
    });
  revalidatePath("/lead/reflections");
}

export async function deleteReflection(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const reflectionId = String(formData.get("reflectionId") ?? "").trim();
  if (!reflectionId) {
    throw new Error("Missing reflection id.");
  }

  await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("reflections")
    .doc(reflectionId)
    .delete();
  revalidatePath("/lead/reflections");
}
