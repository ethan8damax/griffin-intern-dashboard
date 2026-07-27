// src/app/lead/reflections/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireLeadEngagementId } from "@/lib/auth/ownership";
import { addReflection, updateReflection, deleteReflection } from "../reflections-actions";
import type { ReflectionDoc } from "@/lib/auth/types";

export default async function ReflectionsPage() {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);

  const reflectionsSnapshot = await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("reflections")
    .get();
  const reflections = reflectionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ReflectionDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back</a>
      </p>
      <h1>Reflections</h1>
      <ul>
        {reflections.map((reflection) => (
          <li key={reflection.id}>
            <form action={updateReflection}>
              <input type="hidden" name="reflectionId" value={reflection.id} />
              <label>
                Category
                <select name="category" defaultValue={reflection.category}>
                  <option value="self">Self</option>
                  <option value="peer">Peer</option>
                  <option value="work">Work</option>
                </select>
              </label>
              <label>
                Author uid
                <input name="authorUid" defaultValue={reflection.authorUid ?? ""} />
              </label>
              <label>
                Subject uid
                <input name="subjectUid" defaultValue={reflection.subjectUid ?? ""} />
              </label>
              <label>
                Week of
                <input type="date" name="weekOf" defaultValue={reflection.weekOf} required />
              </label>
              <label>
                Text
                <textarea name="text" defaultValue={reflection.text} required />
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteReflection}>
              <input type="hidden" name="reflectionId" value={reflection.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a reflection</h2>
      <form action={addReflection}>
        <label>
          Category
          <select name="category" defaultValue="work">
            <option value="self">Self</option>
            <option value="peer">Peer</option>
            <option value="work">Work</option>
          </select>
        </label>
        <label>
          Author uid (blank for Work)
          <input name="authorUid" />
        </label>
        <label>
          Subject uid (Peer only)
          <input name="subjectUid" />
        </label>
        <label>
          Week of
          <input type="date" name="weekOf" required />
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
