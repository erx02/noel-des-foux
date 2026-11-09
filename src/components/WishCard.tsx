import type { FamilyMember, Reservation, Wish } from "../types/app";

interface WishCardProps {
  wish: Wish;
  ownerName: string;
  currentUserId: string;
  isOwn: boolean;
  reservation: Reservation | undefined;
  members: FamilyMember[];
  onEdit?: () => void;
  onDelete?: () => void;
  onReserve?: () => void;
  onCancelReservation?: () => void;
  busy?: boolean;
}

const priorityLabels = {
  low: "Pourquoi pas",
  normal: "J’aimerais bien",
  high: "Mon grand souhait",
} as const;

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function WishCard({
  wish,
  ownerName,
  currentUserId,
  isOwn,
  reservation,
  members,
  onEdit,
  onDelete,
  onReserve,
  onCancelReservation,
  busy = false,
}: WishCardProps) {
  const reserver = reservation
    ? members.find((member) => member.user_id === reservation.reserved_by)
    : undefined;

  return (
    <article className="wish-card">
      <div className="wish-card-top">
        <span className={`priority priority-${wish.priority}`}>
          {priorityLabels[wish.priority]}
        </span>
        {!isOwn && (
          <span className={`availability ${reservation ? "availability-taken" : ""}`}>
            {reservation ? "Déjà réservé" : "Disponible"}
          </span>
        )}
      </div>
      <h3>{wish.title}</h3>
      {!isOwn && <p className="wish-owner">Pour {ownerName}</p>}
      {wish.description && <p className="wish-description">{wish.description}</p>}
      <div className="wish-details">
        {wish.estimated_price_cents != null && (
          <span>{euro.format(wish.estimated_price_cents / 100)}</span>
        )}
        {wish.product_url && (
          <a href={wish.product_url} target="_blank" rel="noreferrer">
            Voir le cadeau <span aria-hidden="true">↗</span>
          </a>
        )}
        {wish.image_url && (
          <a href={wish.image_url} target="_blank" rel="noreferrer">
            Voir l’image <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      {!isOwn && reservation && reserver && (
        <p className="reservation-note" aria-live="polite">
          Réservé par {reserver.display_name}
        </p>
      )}
      {isOwn ? (
        <div className="wish-actions">
          <button type="button" className="button button-small button-quiet" onClick={onEdit}>
            Modifier
          </button>
          <button type="button" className="button button-small button-danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      ) : (
        <div className="wish-actions">
          {!reservation && onReserve && (
            <button
              type="button"
              className="button button-primary button-small"
              onClick={onReserve}
              disabled={busy}
            >
              {busy ? "Réservation…" : "Réserver ce cadeau"}
            </button>
          )}
          {reservation?.reserved_by === currentUserId && onCancelReservation && (
            <button
              type="button"
              className="button button-small button-quiet"
              onClick={onCancelReservation}
              disabled={busy}
            >
              Annuler ma réservation
            </button>
          )}
        </div>
      )}
    </article>
  );
}
