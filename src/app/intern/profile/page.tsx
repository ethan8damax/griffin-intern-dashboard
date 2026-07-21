import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateOwnBio } from "../profile-actions";
import { PROFILE_DOC_ID, type ProfileDoc } from "@/lib/auth/types";

export default async function InternProfilePage() {
  const user = await requireRole("intern");

  const profileSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("profile")
    .doc(PROFILE_DOC_ID)
    .get();
  const profile = profileSnapshot.exists ? (profileSnapshot.data() as ProfileDoc) : null;

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your profile</h1>
      <p>Role: {profile?.role || "—"}</p>
      <p>Manager: {profile?.manager || "—"}</p>
      <p>Department: {profile?.department || "—"}</p>
      <p>Start date: {profile?.startDate || "—"}</p>
      <p>Current capacity: {profile?.capacity ?? 0}%</p>

      <form action={updateOwnBio}>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile?.bio ?? ""} />
        </label>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
