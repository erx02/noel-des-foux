import { useMemo, useState } from "react";
import { WishCard } from "../components/WishCard";
import { WishForm } from "../components/WishForm";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  addFamilyMember,
  cancelReservation,
  readableError,
  removeFamilyMember,
  removeWish,
  renameFamily,
  reserveWish,
  saveWish,
  updateDisplayName,
} from "../services/workspace";
import type { FamilyMember, Wish, WishInput } from "../types/app";
import { AdminPage } from "./AdminPage";
import { LoginPage } from "./LoginPage";
import { ProfilePage } from "./ProfilePage";

type View =
  | { page: "home" }
  | { page: "list"; memberId: string }
  | { page: "admin" }
  | { page: "profile" };
type PriorityFilter = "all" | "low" | "normal" | "high";
type SortOrder = "newest" | "oldest" | "price";

const syncLabels = {
  syncing: "Synchronisation…",
  synced: "Synchronisé",
  offline: "Hors connexion",
  error: "À actualiser",
} as const;

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function App() {
  const { session, loading: authLoading, signOut } = useAuth();
  const [view, setView] = useState<View>({ page: "home" });
  const [editingWish, setEditingWish] = useState<Wish | null>(null);
  const [showWishForm, setShowWishForm] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [busyWishId, setBusyWishId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const userId = session?.user.id ?? "";
  const { workspace, status, lastSyncedAt, error, refresh } = useWorkspace(userId);

  const currentMember = useMemo(
    () => workspace?.members.find((member) => member.user_id === userId),
    [userId, workspace],
  );

  if (authLoading) {
    return <main className="center-state"><p role="status">Vérification de la session…</p></main>;
  }
  if (!session) return <LoginPage />;

  if (!workspace || !currentMember) {
    return (
      <main className="center-state">
        <div className="state-card">
          <div className="brand-mark" aria-hidden="true">✦</div>
          <h1>{error ? "La famille n’est pas accessible" : "Préparation de ton espace…"}</h1>
          {error && <p className="form-error" role="alert">{error}</p>}
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          <div className="button-row centered">
            <button type="button" className="button button-primary" onClick={() => void refresh()}>
              Réessayer
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                void signOut().catch(() => setActionError("La déconnexion a échoué. Réessaie."));
              }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </main>
    );
  }

  const loadedWorkspace = workspace;
  const viewingOwnList = view.page === "list" && view.memberId === userId;
  const targetMember =
    view.page === "list"
      ? workspace.members.find((member) => member.user_id === view.memberId)
      : undefined;
  const targetWishes =
    view.page === "list"
      ? workspace.wishes.filter((wish) => wish.owner_id === view.memberId)
      : [];
  const wishesForControls = view.page === "list" ? targetWishes : [];
  const displayedWishes =
    view.page === "list"
      ? [...targetWishes]
          .filter((wish) => priorityFilter === "all" || wish.priority === priorityFilter)
          .sort((a, b) => {
            if (sortOrder === "oldest") return a.created_at.localeCompare(b.created_at);
            if (sortOrder === "price") {
              return (a.estimated_price_cents ?? Number.MAX_SAFE_INTEGER) -
                (b.estimated_price_cents ?? Number.MAX_SAFE_INTEGER);
            }
            return b.created_at.localeCompare(a.created_at);
          })
      : [];

  async function performAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (reason) {
      setActionError(readableError(reason));
      await refresh();
      throw reason;
    }
  }

  async function submitWish(input: WishInput, wishId?: string) {
    await performAction(() => saveWish(input, wishId));
  }

  async function deleteWish(wish: Wish) {
    if (!window.confirm(`Supprimer « ${wish.title} » de ta liste ?`)) return;
    try {
      await performAction(() => removeWish(wish.id));
    } catch {
      // The action error is displayed in the persistent alert.
    }
  }

  async function reserve(wish: Wish) {
    setBusyWishId(wish.id);
    try {
      await performAction(() => reserveWish(wish.id));
    } catch {
      // The action error is displayed in the persistent alert.
    } finally {
      setBusyWishId(null);
    }
  }

  async function cancel(wish: Wish) {
    setBusyWishId(wish.id);
    try {
      await performAction(() => cancelReservation(wish.id, userId));
    } catch {
      // The action error is displayed in the persistent alert.
    } finally {
      setBusyWishId(null);
    }
  }

  function nav(viewToSet: View) {
    setActionError(null);
    setEditingWish(null);
    setShowWishForm(false);
    setPriorityFilter("all");
    setView(viewToSet);
  }

  function renderWishList(isOwn: boolean, owner: FamilyMember, wishes: Wish[]) {
    if (wishes.length === 0) {
      return (
        <div className="empty-state">
          <span aria-hidden="true">🎁</span>
          <h2>{isOwn ? "Ta liste est encore vide" : "Pas encore de souhait"}</h2>
          <p>{isOwn ? "Ajoute une première idée, même toute petite." : "Cette personne n’a pas encore partagé d’idée."}</p>
          {isOwn && (
            <button className="button button-primary" onClick={() => setShowWishForm(true)}>
              Ajouter un souhait
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="wish-grid">
        {wishes.map((wish) => {
          // Reservation rows for an owned wish are filtered by RLS. Never render
          // a reservation status on the owner's list, even if stale state exists.
          const reservation = isOwn
            ? undefined
            : loadedWorkspace.reservations.find((item) => item.wish_id === wish.id);
          return (
            <WishCard
              key={wish.id}
              wish={wish}
              ownerName={owner.display_name}
              currentUserId={userId}
              isOwn={isOwn}
              reservation={reservation}
              members={loadedWorkspace.members}
              busy={busyWishId === wish.id}
              onEdit={isOwn ? () => {
                setEditingWish(wish);
                setShowWishForm(true);
              } : undefined}
              onDelete={isOwn ? () => void deleteWish(wish) : undefined}
              onReserve={!isOwn && !reservation ? () => void reserve(wish) : undefined}
              onCancelReservation={
                !isOwn && reservation?.reserved_by === userId
                  ? () => void cancel(wish)
                  : undefined
              }
            />
          );
        })}
      </div>
    );
  }

  function renderListPage() {
    if (!targetMember) return null;
    const isOwn = targetMember.user_id === userId;
    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <button className="back-link" onClick={() => nav({ page: "home" })}>
              ← Retour à la famille
            </button>
            <p className="eyebrow">{isOwn ? "Mon espace" : "Liste partagée"}</p>
            <h1>{isOwn ? "Ma liste de cadeaux" : `Les idées de ${targetMember.display_name}`}</h1>
            <p className="muted">
              {isOwn
                ? "Tu gardes la main sur ce qui te ferait plaisir."
                : "Choisis une idée pour lui faire plaisir."}
            </p>
          </div>
          {isOwn && (
            <button
              className="button button-primary"
              onClick={() => {
                setEditingWish(null);
                setShowWishForm(true);
              }}
            >
              + Ajouter un souhait
            </button>
          )}
        </div>
        {showWishForm && isOwn && (
          <div className="form-panel">
            <WishForm
              wish={editingWish ?? undefined}
              onSave={submitWish}
              onCancel={() => {
                setShowWishForm(false);
                setEditingWish(null);
              }}
            />
          </div>
        )}
        {wishesForControls.length > 0 && (
          <div className="list-controls">
            <label>
              Filtrer par priorité
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              >
                <option value="all">Toutes</option>
                <option value="high">Élevée</option>
                <option value="normal">Normale</option>
                <option value="low">Faible</option>
              </select>
            </label>
            <label>
              Trier
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              >
                <option value="newest">Plus récents</option>
                <option value="oldest">Plus anciens</option>
                <option value="price">Prix croissant</option>
              </select>
            </label>
          </div>
        )}
        {displayedWishes.length === 0 && targetWishes.length > 0 ? (
          <div className="empty-state">
            <h2>Aucun souhait pour ce filtre</h2>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setPriorityFilter("all")}
            >
              Effacer le filtre
            </button>
          </div>
        ) : (
          renderWishList(isOwn, targetMember, displayedWishes)
        )}
      </section>
    );
  }

  const lastSyncedLabel = lastSyncedAt
    ? `Dernière mise à jour à ${dateTime.format(lastSyncedAt)}`
    : "En attente de synchronisation";

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => nav({ page: "home" })}>
          <span className="brand-mark small" aria-hidden="true">✦</span>
          <span>{workspace.family.name}</span>
        </button>
        <nav className="top-navigation" aria-label="Navigation principale">
          <button
            className={view.page === "home" ? "nav-link active" : "nav-link"}
            onClick={() => nav({ page: "home" })}
          >
            La famille
          </button>
          <button
            className={view.page === "list" && viewingOwnList ? "nav-link active" : "nav-link"}
            onClick={() => nav({ page: "list", memberId: userId })}
          >
            Ma liste
          </button>
          {currentMember.role === "admin" && (
            <button
              className={view.page === "admin" ? "nav-link active" : "nav-link"}
              onClick={() => nav({ page: "admin" })}
            >
              Administration
            </button>
          )}
        </nav>
        <button
          className="profile-button"
          onClick={() => nav({ page: "profile" })}
          aria-label={`Profil de ${currentMember.display_name}`}
        >
          <span className="avatar" aria-hidden="true">{currentMember.display_name.slice(0, 1).toUpperCase()}</span>
          <span className="profile-name">{currentMember.display_name}</span>
        </button>
        <button
          className="topbar-signout"
          onClick={() => {
            void signOut().catch(() => setActionError("La déconnexion a échoué. Réessaie."));
          }}
        >
          Déconnexion
        </button>
      </header>

      <main>
        {view.page === "home" && (
          <section className="page-section">
            <div className="welcome-panel">
              <div>
                <p className="eyebrow">Noël se prépare ensemble</p>
                <h1>Bonjour {currentMember.display_name} <span aria-hidden="true">☃</span></h1>
                <p>Les petites idées font les grands sourires.</p>
              </div>
              <span className="welcome-art" aria-hidden="true">🎄</span>
            </div>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Nos idées</p>
                <h2>La famille</h2>
              </div>
              <button
                className="button button-quiet refresh-button"
                onClick={() => void refresh()}
                disabled={status === "syncing"}
              >
                ↻ Actualiser
              </button>
            </div>
            <div className="family-grid">
              {workspace.members.map((member) => {
                const count = workspace.wishes.filter((wish) => wish.owner_id === member.user_id).length;
                return (
                  <button
                    className="family-card"
                    key={member.user_id}
                    onClick={() => nav({ page: "list", memberId: member.user_id })}
                  >
                    <span className="family-avatar" aria-hidden="true">
                      {member.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="family-card-content">
                      <strong>{member.display_name}{member.user_id === userId ? " · toi" : ""}</strong>
                      <span>{count} {count > 1 ? "souhaits" : "souhait"}</span>
                    </span>
                    <span className="family-card-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {view.page === "list" && renderListPage()}
        {view.page === "admin" && currentMember.role === "admin" && (
          <AdminPage
            family={workspace.family}
            members={workspace.members}
            currentUserId={userId}
            onRename={(name) => performAction(() => renameFamily(workspace.family.id, name))}
            onAddMember={(newUserId, name) =>
              performAction(() => addFamilyMember(workspace.family.id, newUserId, name))
            }
            onRemoveMember={(member: FamilyMember) =>
              performAction(() => removeFamilyMember(member.user_id))
            }
          />
        )}
        {view.page === "profile" && (
          <ProfilePage
            member={currentMember}
            email={session.user.email ?? ""}
            onSave={(name) => performAction(() => updateDisplayName(userId, name))}
            onSignOut={signOut}
          />
        )}
      </main>

      <footer className="sync-footer" role="status" aria-live="polite">
        <span className={`sync-dot sync-${status}`} aria-hidden="true" />
        <span>{syncLabels[status]}</span>
        <span className="sync-separator" aria-hidden="true">·</span>
        <span>{lastSyncedLabel}</span>
      </footer>
      {actionError && (
        <div className="toast-error" role="alert">
          <span>{actionError}</span>
          <button className="toast-close" onClick={() => setActionError(null)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
