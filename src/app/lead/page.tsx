import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { removeIntern, reactivateIntern, cancelInvite } from "./actions";
import { InviteInternForm } from "./invite-intern-form";
import { buildRosterRows } from "./roster";
import type { EngagementDoc, InviteDoc, UserDoc } from "@/lib/auth/types";

export default async function LeadPage() {
  const user = await requireRole("engagementLead");

  let engagementName = "your engagement";
  let rosterRows: ReturnType<typeof buildRosterRows> = [];

  if (user.engagementId) {
    const engagementSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .get();
    if (engagementSnapshot.exists) {
      engagementName = (engagementSnapshot.data() as EngagementDoc).name;
    }

    const internsSnapshot = await getAdminDb()
      .collection("users")
      .where("role", "==", "intern")
      .where("engagementId", "==", user.engagementId)
      .get();
    const interns = internsSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...(doc.data() as UserDoc),
    }));

    const invitesSnapshot = await getAdminDb()
      .collection("invites")
      .where("role", "==", "intern")
      .where("engagementId", "==", user.engagementId)
      .where("usedAt", "==", null)
      .get();
    const invites = invitesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as InviteDoc),
    }));

    rosterRows = buildRosterRows(interns, invites);
  }

  return (
    <main>
      <p>Signed in as {user.email} (Engagement Lead)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>{engagementName}</h1>

      <h2>Interns</h2>
      <ul>
        {rosterRows.map((row) => (
          <li key={row.key}>
            {row.name} ({row.email}) — {row.state}
            {row.state === "active" && (
              <>
                <a href={`/lead/interns/${row.uid}`}>Timeline</a>
                <form action={removeIntern}>
                  <input type="hidden" name="uid" value={row.uid} />
                  <button type="submit">Remove</button>
                </form>
              </>
            )}
            {row.state === "removed" && (
              <form action={reactivateIntern}>
                <input type="hidden" name="uid" value={row.uid} />
                <button type="submit">Reactivate</button>
              </form>
            )}
            {row.state === "invited" && (
              <form action={cancelInvite}>
                <input type="hidden" name="inviteId" value={row.inviteId} />
                <button type="submit">Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <p>
        <a href="/lead/team-goals">Team goals</a>
      </p>
      <p>
        <a href="/lead/team-priorities">Team priorities</a>
      </p>

      <h2>Invite an intern</h2>
      <InviteInternForm />
    </main>
  );
}
