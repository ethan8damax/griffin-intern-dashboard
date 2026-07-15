import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import type { EngagementDoc } from "@/lib/auth/types";

export default async function LeadPage() {
  const user = await requireRole("engagementLead");

  let engagementName = "your engagement";
  if (user.engagementId) {
    const engagementSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .get();
    if (engagementSnapshot.exists) {
      engagementName = (engagementSnapshot.data() as EngagementDoc).name;
    }
  }

  return (
    <main>
      <p>Signed in as {user.email} (Engagement Lead)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>{engagementName}</h1>
      <p>Intern management is coming in Sprint 1.</p>
    </main>
  );
}
