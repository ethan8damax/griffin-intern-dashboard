import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { createEngagement } from "./actions";
import { InviteLeadForm } from "./invite-lead-form";
import type { EngagementDoc } from "@/lib/auth/types";

export default async function AdminPage() {
  const user = await requireRole("companyAdmin");

  const engagementsSnapshot = await adminDb.collection("engagements").get();
  const engagements = engagementsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EngagementDoc),
  }));

  return (
    <main>
      <p>Signed in as {user.email} (Company Admin)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>Engagements</h1>
      <ul>
        {engagements.map((engagement) => (
          <li key={engagement.id}>
            {engagement.name} ({engagement.client}) —{" "}
            {engagement.leadUserId ? "lead assigned" : "no lead yet"}
          </li>
        ))}
      </ul>

      <h2>Create engagement</h2>
      <form action={createEngagement}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />

        <label htmlFor="client">Client</label>
        <input id="client" name="client" required />

        <button type="submit">Create</button>
      </form>

      <h2>Invite an engagement lead</h2>
      <InviteLeadForm
        engagements={engagements.map(({ id, name }) => ({ id, name }))}
      />
    </main>
  );
}
