import { useState, type FormEvent } from "react";
import type { FamilyMember } from "../types/app";

interface ProfilePageProps {
  member: FamilyMember;
  email: string;
  onSave: (name: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function ProfilePage({ member, email, onSave, onSignOut }: ProfilePageProps) {
  const [name, setName] = useState(member.display_name);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    try {
      await onSignOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La déconnexion a échoué.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await onSave(name);
      setMessage("Ton profil a été mis à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La mise à jour a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section narrow-section">
      <p className="eyebrow">Mon espace</p>
      <h1>Mon profil</h1>
      <p className="muted">Ton adresse e-mail sert uniquement à te connecter.</p>
      <form className="profile-card stack-form" onSubmit={submit}>
        <label>
          Adresse e-mail
          <input type="email" value={email} readOnly aria-readonly="true" />
        </label>
        <label>
          Prénom affiché à la famille
          <input
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
      <button className="button button-danger sign-out-button" onClick={() => void handleSignOut()}>
        Se déconnecter
      </button>
    </section>
  );
}
