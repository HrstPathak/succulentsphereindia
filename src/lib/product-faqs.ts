export type ProductFaq = {
  question: string;
  answer: string;
};

function normalizeFaqText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toProductFaq(value: unknown): ProductFaq | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const question = normalizeFaqText((value as { question?: unknown }).question);
  const answer = normalizeFaqText((value as { answer?: unknown }).answer);

  if (!question || !answer) {
    return null;
  }

  return { question, answer };
}

function normalizeFaqList(value: unknown): ProductFaq[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toProductFaq).filter((faq): faq is ProductFaq => Boolean(faq)).slice(0, 5);
}

export function parseProductFaqs(input: unknown): ProductFaq[] {
  if (Array.isArray(input)) {
    return normalizeFaqList(input);
  }

  const raw = String(input ?? "").trim();
  if (!raw) {
    return [];
  }

  try {
    return normalizeFaqList(JSON.parse(raw));
  } catch {
    return [];
  }
}
