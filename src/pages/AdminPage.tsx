import { useState, type FormEvent } from "react";
import type { Family, FamilyMember } from "../types/app";

interface AdminPageProps {
  family: Family;
  members: FamilyMember[];
  currentUserId: string;
  onRename: (name: string) => Promise<void>;
  onAddMember: (userId: string, name: string) => Promise<void>;
  onRemoveMember: (member: FamilyMember) => Promise<void>;
}

export function AdminPage({
  family,
  members,
  currentUserId,
  onRename,
  onAddMember,
  onRemoveMember,
}: AdminPageProps) {
  const [familyName, setFamilyName] = useState(family.name);
  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Cette opération a échoué.");
    } finally {
      setBusy(false);
    }
  }

  function submitFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => onRename(familyName), "Le nom de la famille a été modifié.");
  }

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await onAddMember(newUserId, newDisplayName);
      setNewUserId("");
      setNewDisplayName("");
    }, "Le membre a été ajouté.");
  }

  return (
    <section className="page-section">
      <p className="eyebrow">Espace administrateur</p>
      <h1>Gérer la famille</h1>
      <p className="muted">
        Les changements sont contrôlés par les règles de la base de données.
      </p>
      <div className="admin-grid">
        <form className="profile-card stack-form" onSubmit={submitFamily}>
          <h2>Nom de la famille</h2>
          <label>
            Nom affiché
            <input
              maxLength={100}
              required
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
            />
          </label>
          <button className="button button-primary" disabled={busy}>Enregistrer</button>
        </form>
        <form className="profile-card stack-form" onSubmit={submitMember}>
          <h2>Ajouter un membre déjà invité</h2>
          <p className="field-hint">
            Crée d’abord le compte dans Supabase Auth. Aucun e-mail d’invitation
            n’est envoyé depuis cette application.
          </p>
          <label>
            UUID du compte Auth
            <input
              required
              autoComplete="off"
              spellCheck={false}
              value={newUserId}
              onChange={(event) => setNewUserId(event.target.value)}
            />
          </label>
          <label>
            Prénom affiché
            <input
              required
              maxLength={80}
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
            />
          </label>
          <button className="button button-primary" disabled={busy}>Ajouter à la famille</button>
        </form>
      </div>
      <section className="members-admin" aria-labelledby="members-title">
        <h2 id="members-title">Membres</h2>
        <ul className="member-admin-list">
          {members.map((member) => (
            <li key={member.user_id}>
              <span>
                <strong>{member.display_name}</strong>
                <span className="member-role">
                  {member.role === "admin" ? "Administrateur" : "Membre"}
                  {member.user_id === currentUserId ? " · toi" : ""}
                </span>
              </span>
              {member.user_id !== currentUserId && (
                <button
                  type="button"
                  className="button button-small button-danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(
                      `Retirer ${member.display_name} ? Ses souhaits et réservations seront supprimés.`,
                    )) {
                      void run(() => onRemoveMember(member), "Le membre a été retiré.");
                    }
                  }}
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {feedback && <p className="form-message" role="status">{feedback}</p>}
    </section>
  );
}
