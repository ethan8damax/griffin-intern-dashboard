import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { Timeline } from "@/components/timeline";
import type { MilestoneDoc } from "@/lib/auth/types";

export default async function InternPage() {
  const user = await requireRole("intern");

  const timelineSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("timeline")
    .get();
  const milestones = timelineSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as MilestoneDoc),
  }));

  return (
    <main>
      <p>Signed in as {user.email} (Intern)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <p>
        <a href="/intern/goals">Goals</a>
      </p>
      <p>
        <a href="/intern/journal">Journal</a>
      </p>
      <p>
        <a href="/intern/priorities">Priorities</a>
      </p>
      <p>
        <a href="/intern/projects">Projects</a>
      </p>
      <p>
        <a href="/intern/profile">Profile</a>
      </p>
      <p>
        <a href="/intern/team-goals">Team goals</a>
      </p>
      <p>
        <a href="/intern/team-priorities">Team priorities</a>
      </p>
      <p>
        <a href="/intern/reflections">Reflections</a>
      </p>

      <h2>Your timeline</h2>
      <Timeline uid={user.uid} milestones={milestones} editable={false} />
    </main>
  );
}
