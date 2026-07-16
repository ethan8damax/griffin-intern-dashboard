"use client";

import { useState, type FormEvent } from "react";
import { createInvite } from "./actions";

interface EngagementOption {
  id: string;
  name: string;
}

export function InviteLeadForm({
  engagements,
}: {
  engagements: EngagementOption[];
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setLink(null);
    setSubmitting(true);

    const form = formEvent.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await createInvite(formData);
      setLink(result.link);
      (form.elements.namedItem("name") as HTMLInputElement).value = "";
      (form.elements.namedItem("email") as HTMLInputElement).value = "";
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (engagements.length === 0) {
    return <p>Create an engagement first before inviting a lead.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="lead-name">Name</label>
      <input id="lead-name" name="name" required />

      <label htmlFor="lead-email">Email</label>
      <input id="lead-email" name="email" type="email" required />

      <label htmlFor="lead-engagement">Engagement</label>
      <select
        id="lead-engagement"
        name="engagementId"
        defaultValue={engagements[0]?.id ?? ""}
        required
      >
        {engagements.map((engagement) => (
          <option key={engagement.id} value={engagement.id}>
            {engagement.name}
          </option>
        ))}
      </select>

      <button type="submit" disabled={submitting}>
        Create invite
      </button>
      {error && <p role="alert">{error}</p>}
      {link && (
        <p>
          Invite link: <code>{link}</code>{" "}
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            Copy
          </button>
        </p>
      )}
    </form>
  );
}
