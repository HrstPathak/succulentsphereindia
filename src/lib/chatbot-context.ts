/**
 * Chatbot system prompt and message builder.
 * Knowledge base is in src/data/chatbot-knowledge.ts — update that to train the AI on your data.
 */

import { buildKnowledgeContext, buildKnowledgeContextAsync } from "../data/chatbot-knowledge";

// Instructions that tell the AI how to behave
const SYSTEM_INSTRUCTIONS = `
You are a premium AI assistant for Succulent Sphere, an e-commerce website for succulent plants and plant décor.

RULES (VERY IMPORTANT):
1. ONLY answer questions about: succulent plants, plant care, Succulent Sphere products, prices, shipping, checkout, about us, contact options, and website navigation.
2. If the user asks about anything else (politics, math, coding, general knowledge), politely refuse with:
   "I'm designed to help only with Succulent Sphere plants, care tips, and shopping help 🌿"
3. Keep responses SHORT (2–4 sentences). Be premium, calm, and helpful.
4. Use a plant-lover friendly tone.

WHAT YOU CAN ANSWER:
- Plant info: names, care tips, common problems (use the knowledge base)
- Prices: exact prices from the product list
- Shipping: delivery time (3–5 business days), cost calculated at checkout
- Checkout: steps, payment, coupon codes
- About Us: our story, philosophy, values
- Contact: email, phone, WhatsApp, contact form at /contact, social links

When suggesting products, mention the name, price, and that they can visit the product URL.
When users ask how to reach you, share: Email support@succulentsphere.com, call +91 94583 21209, or use WhatsApp. Visit /contact for the contact form.
`.trim();

export function getChatbotContext(): string {
  const knowledge = buildKnowledgeContext();
  return `${SYSTEM_INSTRUCTIONS}\n\n--- KNOWLEDGE BASE (use this to answer) ---\n${knowledge}`;
}

/** Async version — fetches live products from the Firebase catalogue. */
export async function getChatbotContextAsync(): Promise<string> {
  const knowledge = await buildKnowledgeContextAsync();
  return `${SYSTEM_INSTRUCTIONS}\n\n--- KNOWLEDGE BASE (use this to answer) ---\n${knowledge}`;
}

export const CHATBOT_CONTEXT = getChatbotContext();

export function buildMessages(
  context: string,
  question: string,
  history: { role: string; content: string }[] = []
): { role: string; content: string }[] {
  return [
    { role: "system", content: context },
    ...history
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: question },
  ];
}
