"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { completeSignIn } from "@/lib/auth/actions";

const EMAIL_STORAGE_KEY = "griffin-signin-email";

type Status = "idle" | "sent" | "completing" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    let storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!storedEmail) {
      storedEmail = window.prompt("Confirm your email to finish signing in");
    }
    if (!storedEmail) return;

    async function completeLinkSignIn(emailForLink: string) {
      setStatus("completing");
      try {
        const credential = await signInWithEmailLink(
          auth,
          emailForLink,
          window.location.href,
        );
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        const idToken = await credential.user.getIdToken();
        await completeSignIn(idToken);
      } catch (error) {
        setStatus("error");
        setErrorMessage((error as Error).message);
      }
    }

    completeLinkSignIn(storedEmail);
  }, []);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    await sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}/login`,
      handleCodeInApp: true,
    });
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    setStatus("sent");
  }

  if (status === "completing") {
    return <p>Signing you in…</p>;
  }

  if (status === "sent") {
    return <p>Check your email for a sign-in link.</p>;
  }

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        />
        <button type="submit">Send sign-in link</button>
        {status === "error" && <p role="alert">{errorMessage}</p>}
      </form>
    </main>
  );
}
