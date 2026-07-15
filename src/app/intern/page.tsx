import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";

export default async function InternPage() {
  const user = await requireRole("intern");

  return (
    <main>
      <p>Signed in as {user.email} (Intern)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <p>You&apos;re signed in as an intern. Nothing here yet.</p>
    </main>
  );
}
