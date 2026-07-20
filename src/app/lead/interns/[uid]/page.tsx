// src/app/lead/interns/[uid]/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { addMilestone, updateMilestone, deleteMilestone } from "./timeline-actions";
import { Timeline } from "@/components/timeline";
import type { MilestoneDoc, UserDoc } from "@/lib/auth/types";

export default async function InternTimelinePage({
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
  if (
    targetUser.role !== "intern" ||
    targetUser.engagementId !== (lead.engagementId ?? "")
  ) {
    // Same "not found" outcome as a missing doc — don't let a lead
    // distinguish "wrong engagement" from "no such record" for a uid they
    // already hold. Coalescing lead.engagementId to "" (matching
    // assertOwnedIntern in timeline-actions.ts and assertSameEngagement in
    // ../actions.ts) also guards against a lead with no engagementId
    // matching an intern doc that likewise has no engagementId.
    notFound();
  }

  const timelineSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .get();
  const milestones = timelineSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as MilestoneDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back to roster</a>
      </p>
      <p>
        <a href={`/lead/interns/${uid}/goals`}>Goals</a>
      </p>
      <h1>{targetUser.name}&apos;s timeline</h1>
      <Timeline
        uid={uid}
        milestones={milestones}
        editable
        onAdd={addMilestone}
        onUpdate={updateMilestone}
        onDelete={deleteMilestone}
      />
    </main>
  );
}
