import { useMemo, useState, type FormEvent } from "react";
import { MemberAvatar } from "../components/MemberAvatar";
import { WishCard, type WishTagColor } from "../components/WishCard";
import { WishForm } from "../components/WishForm";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  addFamilyMember,
  cancelReservation,
  createChildWishList,
  readableError,
  removeChildWishList,
  removeFamilyMember,
  removeWish,
  renameFamily,
  reserveWish,
  saveWish,
  updateFamilyMemberProfile,
} from "../services/workspace";
import type { FamilyMember, Wish, WishInput } from "../types/app";
import { AdminPage } from "./AdminPage";
import { LoginPage } from "./LoginPage";
import { ProfilePage } from "./ProfilePage";

type View =
  | { page: "home" }
  | { page: "all-wishes" }
  | { page: "list"; memberId: string }
  | { page: "admin" }
  | { page: "profile" };
type SortOrder = "newest" | "oldest";

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
  const [newWishChildListId, setNewWishChildListId] = useState<string | null>(null);
  const [showChildListForm, setShowChildListForm] = useState(false);
  const [childListName, setChildListName] = useState("");
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
  const tagColors: WishTagColor[] = [
    "berry",
    "forest",
    "ocean",
    "sunshine",
    "violet",
    "coral",
    "teal",
    "slate",
  ];
  const listColorByOwner = new Map<string, number>();
  const childWishListTagColors = new Map<string, WishTagColor>();
  for (const list of [...loadedWorkspace.childWishLists].sort(
    (a, b) =>
      a.owner_id.localeCompare(b.owner_id) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )) {
    const colorIndex = listColorByOwner.get(list.owner_id) ?? 0;
    childWishListTagColors.set(list.id, tagColors[colorIndex % tagColors.length]);
    listColorByOwner.set(list.owner_id, colorIndex + 1);
  }
  const viewingOwnList = view.page === "list" && view.memberId === userId;
  const targetMember =
    view.page === "list"
      ? workspace.members.find((member) => member.user_id === view.memberId)
      : undefined;
  const targetWishes =
    view.page === "list"
      ? workspace.wishes.filter((wish) => wish.owner_id === view.memberId)
      : [];
  const displayedWishes =
    view.page === "list"
      ? [...targetWishes]
          .sort((a, b) => {
            if (sortOrder === "oldest") return a.created_at.localeCompare(b.created_at);
            return b.created_at.localeCompare(a.created_at);
          })
      : [];
  const consolidatedWishes = [...workspace.wishes]
    .sort((a, b) => {
      if (sortOrder === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });

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

  async function submitChildList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await performAction(() => createChildWishList(childListName));
      setChildListName("");
      setShowChildListForm(false);
    } catch {
      // The action error is displayed in the persistent alert.
    }
  }

  async function deleteChildList(listId: string, name: string, wishCount: number) {
    const contents = wishCount
      ? ` ainsi que ses ${wishCount} souhait${wishCount > 1 ? "s" : ""} et leurs réservations`
      : "";
    if (!window.confirm(`Supprimer la sous-liste « ${name} »${contents} ?`)) return;
    try {
      await performAction(() => removeChildWishList(listId));
    } catch {
      // The action error is displayed in the persistent alert.
    }
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
    setNewWishChildListId(null);
    setShowChildListForm(false);
    setView(viewToSet);
  }

  function renderWishList(
    isOwn: boolean,
    owner: FamilyMember,
    wishes: Wish[],
    groupLabel?: string,
    childListId?: string,
  ) {
    if (wishes.length === 0) {
      return (
        <div className="empty-state">
          <span aria-hidden="true">🎁</span>
          <h2>{isOwn ? "Ta liste est encore vide" : "Pas encore de souhait"}</h2>
          <p>{isOwn ? "Ajoute une première idée, même toute petite." : "Cette personne n’a pas encore partagé d’idée."}</p>
          {isOwn && (
            <button
              className="button button-primary"
              onClick={() => {
                setEditingWish(null);
                setNewWishChildListId(childListId ?? null);
                setShowChildListForm(false);
                setShowWishForm(true);
              }}
            >
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
              ownerName={
                loadedWorkspace.childWishLists.find((list) => list.id === wish.child_list_id)
                  ?.name ?? owner.display_name
              }
              groupLabel={
                groupLabel ?? loadedWorkspace.childWishLists.find(
                  (list) => list.id === wish.child_list_id,
                )?.name
              }
              groupColor={
                wish.child_list_id
                  ? childWishListTagColors.get(wish.child_list_id)
                  : undefined
              }
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
            <div className="list-heading-actions">
              <button
                className="button button-quiet"
                onClick={() => {
                  setShowWishForm(false);
                  setEditingWish(null);
                  setShowChildListForm((shown) => !shown);
                }}
              >
                + Sous-liste
              </button>
              <button
                className="button button-primary"
                onClick={() => {
                  setEditingWish(null);
                  setNewWishChildListId(null);
                  setShowChildListForm(false);
                  setShowWishForm(true);
                }}
              >
                + Ajouter un souhait
              </button>
            </div>
          )}
        </div>
        {showChildListForm && isOwn && (
          <div className="form-panel">
            <form className="stack-form child-list-form" onSubmit={(event) => void submitChildList(event)}>
              <h2>Créer une sous-liste</h2>
              <p className="field-hint">
                Donne-lui le prénom de ton enfant. Ses cadeaux seront séparés de ta liste.
              </p>
              <label>
                Prénom ou nom de la sous-liste
                <input
                  autoFocus
                  maxLength={80}
                  required
                  value={childListName}
                  onChange={(event) => setChildListName(event.target.value)}
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowChildListForm(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary">Créer la sous-liste</button>
              </div>
            </form>
          </div>
        )}
        {showWishForm && isOwn && (
          <div className="form-panel">
            <WishForm
              wish={editingWish ?? undefined}
              defaultChildListId={newWishChildListId}
              childWishLists={loadedWorkspace.childWishLists.filter(
                (list) => list.owner_id === userId,
              )}
              onSave={submitWish}
              onCancel={() => {
                setShowWishForm(false);
                setEditingWish(null);
              }}
            />
          </div>
        )}
        {targetWishes.length > 0 && (
          <div className="list-controls">
            <label>
              Trier
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              >
                <option value="newest">Plus récents</option>
                <option value="oldest">Plus anciens</option>
              </select>
            </label>
          </div>
        )}
        {isOwn && loadedWorkspace.childWishLists.some((list) => list.owner_id === userId) ? (
          <>
            <section className="wish-list-group">
              <h2>Ma liste</h2>
              {renderWishList(
                true,
                targetMember,
                displayedWishes.filter((wish) => wish.child_list_id === null),
              )}
            </section>
            {loadedWorkspace.childWishLists
              .filter((list) => list.owner_id === userId)
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((list) => {
                const listWishes = displayedWishes.filter(
                  (wish) => wish.child_list_id === list.id,
                );
                return (
                  <section className="wish-list-group" key={list.id}>
                    <div className="wish-list-group-heading">
                      <div>
                        <h2>{list.name}</h2>
                        <p>{listWishes.length} {listWishes.length === 1 ? "souhait" : "souhaits"}</p>
                      </div>
                      <button
                        type="button"
                        className="button button-small button-danger"
                        onClick={() => void deleteChildList(list.id, list.name, listWishes.length)}
                      >
                        Supprimer la sous-liste
                      </button>
                    </div>
                    {renderWishList(true, targetMember, listWishes, list.name, list.id)}
                  </section>
                );
              })}
          </>
        ) : renderWishList(isOwn, targetMember, displayedWishes)}
      </section>
    );
  }

  function renderConsolidatedPage() {
    return (
      <section className="page-section consolidated-page">
        <div className="page-heading">
          <div>
            <button className="back-link" onClick={() => nav({ page: "home" })}>
              ← Retour à la famille
            </button>
            <p className="eyebrow">Le grand carnet de Noël</p>
            <h1>Tous les souhaits</h1>
            <p className="muted">
              Les idées de toute la famille, réunies au même endroit.
            </p>
          </div>
          <span className="consolidated-total" aria-label={`${consolidatedWishes.length} souhaits au total`}>
            <span aria-hidden="true">🎁</span>
            {consolidatedWishes.length} {consolidatedWishes.length === 1 ? "souhait" : "souhaits"}
          </span>
        </div>
        <div className="list-controls">
          <label>
            Trier
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
            </select>
          </label>
        </div>
        {showWishForm && view.page === "all-wishes" && (
          <div className="form-panel">
            <WishForm
              wish={editingWish ?? undefined}
              defaultChildListId={newWishChildListId}
              childWishLists={loadedWorkspace.childWishLists.filter(
                (list) => list.owner_id === userId,
              )}
              onSave={submitWish}
              onCancel={() => {
                setShowWishForm(false);
                setEditingWish(null);
              }}
            />
          </div>
        )}
        {loadedWorkspace.members.map((member) => {
          const memberWishes = consolidatedWishes.filter(
            (wish) => wish.owner_id === member.user_id,
          );
          const isOwn = member.user_id === userId;
          return (
            <section className="consolidated-member" key={member.user_id}>
              <div className="consolidated-member-heading">
                <MemberAvatar avatarId={member.avatar_id} size="member" />
                <div>
                  <h2>{member.display_name}{isOwn ? " · toi" : ""}</h2>
                  <p>{memberWishes.length} {memberWishes.length === 1 ? "souhait" : "souhaits"}</p>
                </div>
                <div className="consolidated-member-actions">
                  {isOwn && (
                    <button
                      type="button"
                      className="button button-small button-primary"
                      onClick={() => {
                        setEditingWish(null);
                        setNewWishChildListId(null);
                        setShowWishForm(true);
                      }}
                    >
                      + Ajouter
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-small button-quiet"
                    onClick={() => nav({ page: "list", memberId: member.user_id })}
                  >
                    Voir sa liste
                  </button>
                </div>
              </div>
              {memberWishes.length > 0
                ? renderWishList(isOwn, member, memberWishes)
                : <p className="consolidated-empty">Pas encore d’idée dans cette hotte.</p>}
            </section>
          );
        })}
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
          <span>La liste au Papa Noël des Foux</span>
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
          <button
            className={view.page === "all-wishes" ? "nav-link active" : "nav-link"}
            onClick={() => nav({ page: "all-wishes" })}
          >
            Tous les souhaits
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
          <MemberAvatar avatarId={currentMember.avatar_id} size="profile" />
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
                <p className="eyebrow">La magie se prépare en famille</p>
                <h1>Bonjour {currentMember.display_name} <span aria-hidden="true">✦</span></h1>
                <p>Quelques idées, beaucoup de joie sous le sapin.</p>
              </div>
              <div className="welcome-ornaments" aria-hidden="true">
                <span className="ornament ornament-gold">✦</span>
                <span className="ornament ornament-red">●</span>
                <span className="ornament ornament-snow">❄</span>
                <span className="welcome-art">🎄</span>
              </div>
            </div>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Nos idées</p>
                <h2>La famille</h2>
              </div>
              <div className="home-actions">
                <button
                  className="button button-quiet refresh-button"
                  onClick={() => void refresh()}
                  disabled={status === "syncing"}
                >
                  ↻ Actualiser
                </button>
                <button
                  className="button button-primary"
                  onClick={() => nav({ page: "all-wishes" })}
                >
                  <span aria-hidden="true">🎁</span> Vue d’ensemble
                </button>
              </div>
            </div>
            <div className="family-grid">
              {workspace.members.map((member) => {
                const count = workspace.wishes.filter((wish) => wish.owner_id === member.user_id).length;
                const childListCount =
                  member.user_id === userId
                    ? loadedWorkspace.childWishLists.filter((list) => list.owner_id === userId).length
                    : 0;
                return (
                  <button
                    className="family-card"
                    key={member.user_id}
                    onClick={() => nav({ page: "list", memberId: member.user_id })}
                  >
                    <MemberAvatar avatarId={member.avatar_id} size="member" />
                    <span className="family-card-content">
                      <strong>{member.display_name}{member.user_id === userId ? " · toi" : ""}</strong>
                      <span>{count} {count > 1 ? "souhaits" : "souhait"}</span>
                      {childListCount > 0 && (
                        <span>
                          {childListCount} sous-liste{childListCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                    <span className="family-card-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {view.page === "all-wishes" && renderConsolidatedPage()}
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
            onSave={(name, avatarId) =>
              performAction(() => updateFamilyMemberProfile(userId, name, avatarId))
            }
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
