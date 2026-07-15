import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUid } from "@/lib/auth/session";
import type { UserDoc, UserRole } from "@/lib/auth/types";

export const getCurrentUser = cache(
  async (): Promise<(UserDoc & { uid: string }) | null> => {
    const uid = await getSessionUid();
    if (!uid) return null;

    const snapshot = await adminDb.collection("users").doc(uid).get();
    if (!snapshot.exists) return null;

    return { uid, ...(snapshot.data() as UserDoc) };
  }
);

export async function requireRole(
  role: UserRole
): Promise<UserDoc & { uid: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== role) {
    redirect("/login");
  }
  return user;
}
