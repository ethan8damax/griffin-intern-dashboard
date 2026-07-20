// src/app/lead/interns/[uid]/journal/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import type { JournalEntryDoc, UserDoc } from "@/lib/auth/types";

export default async function InternJournalPage({
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

  const entriesSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("journal")
    .get();
  const entries = entriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as JournalEntryDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s journal</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.date} [{entry.type}] {entry.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
