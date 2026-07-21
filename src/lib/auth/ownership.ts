import { getAdminDb } from "@/lib/firebase-admin";
import type { UserDoc } from "./types";

export function isOwnedIntern(
  targetUser: UserDoc,
  leadEngagementId: string
): boolean {
  return (
    targetUser.role === "intern" &&
    leadEngagementId !== "" &&
    targetUser.engagementId === leadEngagementId
  );
}

export async function assertOwnedIntern(
  uid: string,
  leadEngagementId: string,
  notFoundMessage: string
): Promise<UserDoc> {
  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new Error(notFoundMessage);
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (!isOwnedIntern(targetUser, leadEngagementId)) {
    // Same message as the "doesn't exist" case above — don't let a lead
    // distinguish "wrong engagement" from "no such record" for a uid they
    // already hold, matching the collapsed-message convention in
    // src/app/lead/actions.ts.
    throw new Error(notFoundMessage);
  }
  return targetUser;
}
