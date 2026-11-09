import { useEffect, useState, type FormEvent } from "react";
import type { Priority, Wish, WishInput } from "../types/app";
import { validateWish } from "../utils/validation";

interface WishFormProps {
  wish?: Wish;
  onSave: (input: WishInput, wishId?: string) => Promise<void>;
  onCancel: () => void;
}

export function WishForm({ wish, onSave, onCancel }: WishFormProps) {
  const [title, setTitle] = useState(wish?.title ?? "");
  const [description, setDescription] = useState(wish?.description ?? "");
  const [productUrl, setProductUrl] = useState(wish?.product_url ?? "");
  const [imageUrl, setImageUrl] = useState(wish?.image_url ?? "");
  const [priceEuros, setPriceEuros] = useState(
    wish?.estimated_price_cents == null
      ? ""
      : (wish.estimated_price_cents / 100).toFixed(2),
  );
  const [priority, setPriority] = useState<Priority>(wish?.priority ?? "normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(wish?.title ?? "");
    setDescription(wish?.description ?? "");
    setProductUrl(wish?.product_url ?? "");
    setImageUrl(wish?.image_url ?? "");
    setPriceEuros(
      wish?.estimated_price_cents == null
        ? ""
        : (wish.estimated_price_cents / 100).toFixed(2),
    );
    setPriority(wish?.priority ?? "normal");
    setError(null);
  }, [wish]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const input = validateWish({
        title,
        description,
        productUrl,
        imageUrl,
        priceEuros,
        priority,
      });
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
      <div className="form-row">
        <label>
          Prix estimé
          <span className="input-with-suffix">
            <input
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              inputMode="decimal"
              placeholder="Ex. 25"
              value={priceEuros}
              onChange={(event) => setPriceEuros(event.target.value)}
            />
            <span aria-hidden="true">€</span>
          </span>
        </label>
        <label>
          Priorité
          <select
            value={priority}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "low" || value === "normal" || value === "high") {
                setPriority(value);
              }
            }}
          >
            <option value="low">Faible</option>
            <option value="normal">Normale</option>
            <option value="high">Élevée</option>
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row">
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Annuler
        </button>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Enregistrement…" : wish ? "Enregistrer" : "Ajouter à ma liste"}
        </button>
      </div>
    </form>
  );
}
