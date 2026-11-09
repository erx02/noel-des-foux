import type { WishInput, Priority } from "../types/app";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function parseOptionalUrl(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) throw new Error(`${label} est trop longue.`);

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} doit être une URL complète.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} doit commencer par https:// ou http://.`);
  }
  return url.toString();
}

export function validateWish(values: {
  title: string;
  description: string;
  productUrl: string;
  imageUrl: string;
  priceEuros: string;
  priority: string;
}): WishInput {
  const title = values.title.trim();
  const description = values.description.trim();
  if (title.length < 1 || title.length > 150) {
    throw new Error("Le titre doit contenir entre 1 et 150 caractères.");
  }
  if (description.length > 2000) {
    throw new Error("La description ne peut pas dépasser 2 000 caractères.");
  }

  let estimatedPriceCents: number | null = null;
  if (values.priceEuros.trim()) {
    const price = Number(values.priceEuros.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      throw new Error("Le prix doit être compris entre 0,01 € et 100 000 €.");
    }
    estimatedPriceCents = Math.round(price * 100);
    if (estimatedPriceCents < 1 || estimatedPriceCents > 10000000) {
      throw new Error("Le prix indiqué n'est pas valide.");
    }
  }

  const priorities: Priority[] = ["low", "normal", "high"];
  const priority = priorities.find((candidate) => candidate === values.priority);
  if (!priority) {
    throw new Error("Choisis une priorité valide.");
  }

  return {
    title,
    description: description || null,
    product_url: parseOptionalUrl(values.productUrl, "Le lien du cadeau"),
    image_url: parseOptionalUrl(values.imageUrl, "Le lien de l’image"),
    estimated_price_cents: estimatedPriceCents,
    priority,
  };
}
