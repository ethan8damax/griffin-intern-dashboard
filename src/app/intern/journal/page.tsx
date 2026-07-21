// src/app/intern/journal/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { addJournalEntry, deleteJournalEntry } from "../journal-actions";
import type { JournalEntryDoc } from "@/lib/auth/types";

export default async function InternJournalPage() {
  const user = await requireRole("intern");

  const entriesSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("journal")
    .get();
  const entries = entriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as JournalEntryDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your journal</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.date} [{entry.type}] {entry.text}
            <form action={deleteJournalEntry}>
              <input type="hidden" name="entryId" value={entry.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add an entry</h2>
      <form action={addJournalEntry}>
        <label>
          Date
          <input type="date" name="date" required />
        </label>
        <label>
          Type
          <select name="type" defaultValue="note">
            <option value="win">Win</option>
            <option value="blocker">Blocker</option>
            <option value="checkin">Check-in</option>
            <option value="note">Note</option>
          </select>
        </label>
        <label>
          Text
          <textarea name="text" required />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
