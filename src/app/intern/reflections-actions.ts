// src/app/intern/reflections-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { ReflectionDoc } from "@/lib/auth/types";

const INTERN_REFLECTION_CATEGORIES = ["self", "peer"];

export async function addOwnReflection(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  if (!user.engagementId) {
    throw new Error("You are not assigned to an engagement.");
  }
  const category = String(formData.get("category") ?? "").trim();
  const subjectUid = String(formData.get("subjectUid") ?? "").trim() || null;
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!weekOf || !text) {
    throw new Error("Missing week or text.");
  }
  if (!INTERN_REFLECTION_CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }

  const reflection: ReflectionDoc = {
    category: category as ReflectionDoc["category"],
    authorUid: user.uid,
    subjectUid: category === "peer" ? subjectUid : null,
    weekOf,
    text,
    createdAt: Date.now(),
  };
  await getAdminDb()
    .collection("engagements")
    .doc(user.engagementId)
    .collection("reflections")
    .add(reflection);
  revalidatePath("/intern/reflections");
}

export async function updateOwnReflection(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  if (!user.engagementId) {
    throw new Error("You are not assigned to an engagement.");
  }
  const reflectionId = String(formData.get("reflectionId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!reflectionId || !text) {
    throw new Error("Missing reflection id or text.");
  }

  const reflectionRef = getAdminDb()
    .collection("engagements")
    .doc(user.engagementId)
    .collection("reflections")
    .doc(reflectionId);
  const snapshot = await reflectionRef.get();
  if (!snapshot.exists || (snapshot.data() as ReflectionDoc).authorUid !== user.uid) {
    throw new Error("Reflection not found.");
  }

  await reflectionRef.update({ text });
  revalidatePath("/intern/reflections");
}

export async function deleteOwnReflection(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  if (!user.engagementId) {
    throw new Error("You are not assigned to an engagement.");
  }
  const reflectionId = String(formData.get("reflectionId") ?? "").trim();
  if (!reflectionId) {
    throw new Error("Missing reflection id.");
  }

  const reflectionRef = getAdminDb()
    .collection("engagements")
    .doc(user.engagementId)
    .collection("reflections")
    .doc(reflectionId);
  const snapshot = await reflectionRef.get();
  if (!snapshot.exists || (snapshot.data() as ReflectionDoc).authorUid !== user.uid) {
    throw new Error("Reflection not found.");
  }

  await reflectionRef.delete();
  revalidatePath("/intern/reflections");
}
