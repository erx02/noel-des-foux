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
    priority,
  };
}
