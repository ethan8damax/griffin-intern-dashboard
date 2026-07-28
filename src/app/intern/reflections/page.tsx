// src/app/intern/reflections/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { addOwnReflection, updateOwnReflection, deleteOwnReflection } from "../reflections-actions";
import type { ReflectionDoc } from "@/lib/auth/types";

export default async function InternReflectionsPage() {
  const user = await requireRole("intern");

  let reflections: (ReflectionDoc & { id: string })[] = [];
  if (user.engagementId) {
    const reflectionsSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .collection("reflections")
      .get();
    reflections = reflectionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as ReflectionDoc),
    }));
  }

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Reflections</h1>
      <ul>
        {reflections.map((reflection) => (
          <li key={reflection.id}>
            {reflection.authorUid === user.uid ? (
              <>
                <form action={updateOwnReflection}>
                  <input type="hidden" name="reflectionId" value={reflection.id} />
                  <p>
                    {reflection.weekOf} [{reflection.category}]
                  </p>
                  <label>
                    Text
                    <textarea name="text" defaultValue={reflection.text} required />
                  </label>
                  <button type="submit">Save</button>
                </form>
                <form action={deleteOwnReflection}>
                  <input type="hidden" name="reflectionId" value={reflection.id} />
                  <button type="submit">Delete</button>
                </form>
              </>
            ) : (
              <p>
                {reflection.weekOf} [{reflection.category}] {reflection.text}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h2>Add a reflection</h2>
      <form action={addOwnReflection}>
        <label>
          Category
          <select name="category" defaultValue="self">
            <option value="self">Self</option>
            <option value="peer">Peer</option>
          </select>
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
