import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { updateProfile } from "../profile-actions";
import type { ProfileDoc, UserDoc } from "@/lib/auth/types";

export default async function InternProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const lead = await requireRole("engagementLead");

  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    notFound();
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const profileSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data")
    .get();
  const profile = profileSnapshot.exists ? (profileSnapshot.data() as ProfileDoc) : null;

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s profile</h1>
      <form action={updateProfile}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Role
          <input name="role" defaultValue={profile?.role ?? ""} />
        </label>
        <label>
          Manager
          <input name="manager" defaultValue={profile?.manager ?? ""} />
        </label>
        <label>
          Department
          <input name="department" defaultValue={profile?.department ?? ""} />
        </label>
        <label>
          Start date
          <input type="date" name="startDate" defaultValue={profile?.startDate ?? ""} />
        </label>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile?.bio ?? ""} />
        </label>
        <label>
          Current capacity
          <input
            type="number"
            name="capacity"
            min={0}
            max={100}
            defaultValue={profile?.capacity ?? 0}
          />
        </label>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
