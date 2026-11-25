import { useEffect, useState, type FormEvent } from "react";
import type { ChildWishList, Wish, WishInput } from "../types/app";
import { validateWish } from "../utils/validation";

interface WishFormProps {
  wish?: Wish;
  childWishLists: ChildWishList[];
  defaultChildListId?: string | null;
  onSave: (input: WishInput, wishId?: string) => Promise<void>;
  onCancel: () => void;
}

export function WishForm({
  wish,
  childWishLists,
  defaultChildListId = null,
  onSave,
  onCancel,
}: WishFormProps) {
  const [title, setTitle] = useState(wish?.title ?? "");
  const [description, setDescription] = useState(wish?.description ?? "");
  const [productUrl, setProductUrl] = useState(wish?.product_url ?? "");
  const [imageUrl, setImageUrl] = useState(wish?.image_url ?? "");
  const [childListId, setChildListId] = useState(
    wish?.child_list_id ?? defaultChildListId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(wish?.title ?? "");
    setDescription(wish?.description ?? "");
    setProductUrl(wish?.product_url ?? "");
    setImageUrl(wish?.image_url ?? "");
    setChildListId(wish?.child_list_id ?? defaultChildListId ?? "");
    setError(null);
  }, [defaultChildListId, wish]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const input = {
        ...validateWish({
          title,
          description,
          productUrl,
          imageUrl,
        }),
        child_list_id: childListId || null,
      };
      setBusy(true);
      await onSave(input, wish?.id);
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Vérifie les champs du souhait.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="wish-form stack-form" onSubmit={submit}>
      <h2>{wish ? "Modifier le souhait" : "Ajouter un souhait"}</h2>
      <label>
        Titre <span aria-hidden="true">*</span>
        <input
          autoFocus
          maxLength={150}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      {childWishLists.length > 0 && (
        <label>
          Espace
          <select
            value={childListId}
            onChange={(event) => setChildListId(event.target.value)}
          >
            <option value="">Ma liste</option>
            {childWishLists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Description <span className="muted">(facultative)</span>
        <textarea
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <span className="field-hint">{description.length}/2 000 caractères</span>
      </label>
      <label>
        Lien du cadeau <span className="muted">(facultatif)</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          maxLength={2048}
          value={productUrl}
          onChange={(event) => setProductUrl(event.target.value)}
        />
      </label>
      <label>
        Lien d’image <span className="muted">(facultatif, non chargé automatiquement)</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          maxLength={2048}
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row">
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Annuler
        </button>
        <button className="button button-primary" disabled={busy}>
          {busy
            ? "Enregistrement…"
            : wish
              ? "Enregistrer"
              : childListId
                ? `Ajouter à la liste de ${childWishLists.find((list) => list.id === childListId)?.name ?? "l’enfant"}`
                : "Ajouter à ma liste"}
        </button>
      </div>
    </form>
  );
}
