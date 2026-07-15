"use client";

import { useState, type FormEvent } from "react";
import { inviteIntern } from "./actions";

export function InviteInternForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setLink(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);

    try {
      const result = await inviteIntern(formData);
      setLink(result.link);
      setName("");
      setEmail("");
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="intern-name">Name</label>
      <input
        id="intern-name"
        value={name}
        onChange={(inputEvent) => setName(inputEvent.target.value)}
        required
      />

      <label htmlFor="intern-email">Email</label>
      <input
        id="intern-email"
        type="email"
        value={email}
        onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        required
      />

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
