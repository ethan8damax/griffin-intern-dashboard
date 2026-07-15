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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [engagementId, setEngagementId] = useState(engagements[0]?.id ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setLink(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    formData.set("engagementId", engagementId);

    try {
      const result = await createInvite(formData);
      setLink(result.link);
      setName("");
      setEmail("");
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  }

  if (engagements.length === 0) {
    return <p>Create an engagement first before inviting a lead.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="lead-name">Name</label>
      <input
        id="lead-name"
        value={name}
        onChange={(inputEvent) => setName(inputEvent.target.value)}
        required
      />

      <label htmlFor="lead-email">Email</label>
      <input
        id="lead-email"
        type="email"
        value={email}
        onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        required
      />

      <label htmlFor="lead-engagement">Engagement</label>
      <select
        id="lead-engagement"
        value={engagementId}
        onChange={(inputEvent) => setEngagementId(inputEvent.target.value)}
        required
      >
        {engagements.map((engagement) => (
          <option key={engagement.id} value={engagement.id}>
            {engagement.name}
          </option>
        ))}
      </select>

      <button type="submit">Create invite</button>
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
