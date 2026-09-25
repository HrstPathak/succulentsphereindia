export type DelhiveryStateName = { code: string; name: string };

/**
 * Delhivery's pin-code API returns only a state *code* (UK, DL, MH, ...) for
 * most pincodes, so the full name is resolved locally for display. Unknown
 * codes fall back to whatever the carrier returned.
 */
const STATE_CODES: Record<string, string> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  CH: "Chandigarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HP: "Himachal Pradesh",
  HR: "Haryana",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TG: "Telangana",
  TN: "Tamil Nadu",
  TR: "Tripura",
  TS: "Telangana",
  UK: "Uttarakhand",
  UP: "Uttar Pradesh",
  WB: "West Bengal",
};

/** Expands a Delhivery state code to its full name, leaving names untouched. */
export function resolveDelhiveryStateName(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const name = STATE_CODES[raw.toUpperCase()];
  return name || raw;
}

export function buildDelhiveryTrackingUrl(awb: unknown) {
  const waybill = String(awb || "").trim();
  return waybill
    ? `https://www.delhivery.com/track/package/${encodeURIComponent(waybill)}`
    : "";
}

/**
 * Delhivery treats a shipment's `order` reference as unique, so a second
 * shipment for the same store order must carry a distinct reference.
 *
 *   sequence 1 -> "1009"
 *   sequence 2 -> "1009(2)"
 *   sequence 3 -> "1009(3)"
 */
export function buildDelhiveryOrderReference(base: unknown, sequence = 1) {
  const clean = String(base ?? "").trim();
  const count = Math.floor(Number(sequence));
  if (!clean) return "";
  if (!Number.isFinite(count) || count <= 1) return clean;
  return `${clean}(${count})`;
}

/**
 * Reads the highest sequence already used for a base reference so the next
 * additional shipment continues the numbering instead of colliding.
 */
export function nextDelhiverySequence(base: unknown, used: unknown[] = []) {
  const clean = String(base ?? "").trim();
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = clean ? new RegExp(`^${escaped}\\((\\d+)\\)$`) : null;
  let highest = 1;
  for (const entry of used) {
    const value = String(entry ?? "").trim();
    if (!value) continue;
    if (value === clean) {
      highest = Math.max(highest, 1);
      continue;
    }
    const match = pattern ? value.match(pattern) : null;
    if (match) highest = Math.max(highest, Number(match[1]) || 1);
  }
  return highest + 1;
}

export type ManualOrderDraft = {
  orderId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  amount: string;
  paymentMode: "COD" | "Prepaid";
};

const EMPTY_DRAFT: ManualOrderDraft = {
  orderId: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  amount: "",
  paymentMode: "COD",
};

const digits = (value: string) => value.replace(/\D/g, "");

// The rupee sign is normalised to "Rs" before any money regex runs, which keeps
// the pattern set small and avoids fragile capture-group indices. Written as a
// unicode escape so this file stays pure ASCII.
const RUPEE_SIGN = "\u20B9";
const RE_RUPEE_SIGN = new RegExp(RUPEE_SIGN, "g");

/** Turns "₹400" into "Rs 400" so one money pattern handles every currency form. */
function normaliseCurrency(input: string): string {
  return String(input ?? "").replace(RE_RUPEE_SIGN, "Rs ");
}

// Matches "Rs 400", "400Rs", "400/-" and "400 INR", but never the "rs" inside
// ordinary names such as Harshit / Prasad / Ramesh. The forward slash in "\/-"
// must stay escaped: an unescaped slash ends the regex literal early.
const RE_MONEY =
  /(?:\brs|\binr\b)\.?[\s:=-]*([\d,]+(?:\.\d{1,2})?)\b|([\d,]+(?:\.\d{1,2})?)\s*(?:\/-|(?:rs|rupees|inr)\.?)(?![a-z])/i;
const RE_MONEY_PREFIX = /(?:\brs|\binr\b)\.?[\s:=-]*[\d,]+(?:\.\d{1,2})?\b/gi;
const RE_MONEY_SUFFIX = /[\d,]+(?:\.\d{1,2})?\s*(?:\/-|(?:rs|rupees|inr)\.?)(?![a-z])/gi;
const RE_BARE_AMOUNT = /^([\d,]+(?:\.\d{1,2})?)$/;
const RE_PAYMENT_WORD =
  /\b(prepaid|pre paid|cod|cash on delivery|cash|paid|online payment|online|upi|advance)\b/i;
const RE_PAYMENT_GLOBAL =
  /\b(prepaid|pre paid|cod|cash on delivery|cash|paid|online payment|online|upi|advance)\b/gi;
// A line that is only money/payment wording must never become the address.
const RE_NON_ADDRESS =
  /(?:\brs|\binr\b)\.?(?![a-z])|\/-|\bprepaid\b|\bcod\b|\bcash\b|\bpaid\b|\bonline\b|\bupi\b|\badvance\b|\bamount\b|\btotal\b|\bprice\b|\bvalue\b/i;

/**
 * Accepts 10-15 digit input and returns exactly 10 digits.
 *
 *   "9876543210"      -> "9876543210"
 *   "+91 98765 43210" -> "9876543210"
 *   "919876543210"    -> "9876543210"
 *   "0987654321"      -> "0987654321"  (kept as typed so the admin can see and
 *                                        correct a stray leading zero)
 */
function normalizeManualPhone(value: unknown): string {
  let result = digits(String(value ?? ""));
  if (result.length > 10 && result.startsWith("91")) result = result.slice(2);
  if (result.length > 10) result = result.slice(-10);
  return result.length === 10 ? result : "";
}

/** Pulls a monetary amount out of a free-text fragment, if present. */
function readAmount(fragment: string): string {
  const match = normaliseCurrency(fragment).match(RE_MONEY);
  if (match) {
    const value = (match[1] || match[2] || "").replace(/,/g, "");
    if (Number(value) > 0) return value;
  }
  return "";
}

/** Reads a payment mode out of a free-text fragment, if present. */
function readPaymentMode(fragment: string): "COD" | "Prepaid" | "" {
  const match = fragment.match(RE_PAYMENT_WORD);
  if (!match) return "";
  return /^(prepaid|pre paid|paid|online|online payment|upi|advance)/.test(match[1])
    ? "Prepaid"
    : "COD";
}

/** Strips money and payment wording from a line, leaving the address text. */
function stripMoneyAndPayment(fragment: string): string {
  return normaliseCurrency(fragment)
    .replace(RE_MONEY_PREFIX, " ")
    .replace(RE_MONEY_SUFFIX, " ")
    .replace(RE_PAYMENT_WORD, " ")
    // Collapse only whitespace runs; commas in a real address must survive.
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/^[\s,]+/, "")
    .replace(/[,;]+$/, "")
    .trim();
}

/**
 * Infers the structured fields of a manually-typed order (typically pasted from
 * a WhatsApp conversation) so the admin does not have to re-key them.
 *
 *   SS-1 / 1009 / Order 42  -> order id
 *   10-15 digit number      -> phone (country code trimmed to 10 digits)
 *   anything with an "@"    -> email
 *   exactly 6 digits        -> pincode
 *   400Rs / Rs 400 / 400    -> amount
 *   Prepaid / COD           -> payment mode
 *   remaining lines         -> name (first short line) + address
 */
export function parseManualOrderText(input: unknown): ManualOrderDraft {
  const draft: ManualOrderDraft = { ...EMPTY_DRAFT };
  const raw = String(input ?? "");
  if (!raw.trim()) return draft;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const leftovers: string[] = [];
  const explicitAddress: string[] = [];

  // "Name: Rajesh Kumar" -> label "name", value "Rajesh Kumar".
  // A bare token such as "SS-1001" must NOT be read as a label, so the label
  // has to end in a letter and the value must not start with a digit.
  const LABELLED = /^([A-Za-z][A-Za-z ]{0,14})\s*[:\u2013-]\s*(\D.*)$/;

  for (const line of lines) {
    const labelled = line.match(LABELLED);
    const label = labelled
      ? labelled[1].trim().toLowerCase().replace(/\s+/g, " ")
      : "";
    const value = labelled ? labelled[2].trim() : "";

    if (labelled) {
      if (/^(name|customer|recipient|buyer|contact ?person)$/.test(label) && !draft.name) {
        draft.name = value;
        continue;
      }
      if (/^(address|addr|delivery ?address|shipping ?address|house|street)$/.test(label)) {
        explicitAddress.push(value);
        continue;
      }
      if (/^(order|order ?id|order ?no|order ?number|id|ref|reference)$/.test(label) && !draft.orderId) {
        draft.orderId = value.toUpperCase();
        continue;
      }
      if (/^(phone|mobile|contact|tel|whatsapp|mobile ?no)$/.test(label) && !draft.phone) {
        draft.phone = normalizeManualPhone(value);
        continue;
      }
      if (/^(email|e-?mail ?id|mail)$/.test(label) && !draft.email) {
        draft.email = value.toLowerCase();
        continue;
      }
      if (/^(pincode|pin|zip ?code|postal ?code)$/.test(label) && !draft.pincode) {
        draft.pincode = digits(value).slice(0, 6);
        continue;
      }
      if (/^(city|town|district)$/.test(label) && !draft.city) {
        draft.city = value;
        continue;
      }
      if (/^(state|province)$/.test(label) && !draft.state) {
        draft.state = value;
        continue;
      }
      if (
        /^(total|amount|price|value|cod|cod ?amount|grand ?total|order ?value)$/.test(label) &&
        !draft.amount
      ) {
        const found = readAmount(value) || digits(value.replace(/\.\d{1,2}.*$/, ""));
        if (Number(found) > 0) draft.amount = found;
        continue;
      }
      if (/^(payment|payment ?mode|mode|type)$/.test(label)) {
        const mode = readPaymentMode(value);
        if (mode) draft.paymentMode = mode;
        continue;
      }
    }

    const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) {
      if (!draft.email) draft.email = email[0].toLowerCase();
      continue;
    }

    const pinMatch = line.match(/\b(\d{6})\b/);
    if (pinMatch && !draft.pincode) {
      draft.pincode = pinMatch[1];
      continue;
    }

    const phoneMatch = line.match(/\b(\+?\d[\d\s-]{8,16}\d)\b/);
    if (phoneMatch) {
      const candidate = normalizeManualPhone(phoneMatch[1]);
      if (candidate && !draft.phone) {
        draft.phone = candidate;
        continue;
      }
    }

    // Money / payment lines. Checked after pincode and phone so those digits
    // are never read as an amount. A line that still has address wording after
    // removing its money/payment parts is NOT consumed here; it is left for the
    // cleanup pass below so the address itself is preserved.
    const moneyOnly = stripMoneyAndPayment(line);
    const hasAddressWording = /[A-Za-z]{3,}/.test(moneyOnly);
    if (!hasAddressWording) {
      const amount = readAmount(line);
      if (amount) {
        if (!draft.amount) draft.amount = amount;
        const mode = readPaymentMode(line);
        if (mode) draft.paymentMode = mode;
        else if (draft.paymentMode !== "Prepaid") draft.paymentMode = "COD";
        continue;
      }
      const mode = readPaymentMode(line);
      if (mode) {
        draft.paymentMode = mode;
        continue;
      }
    }

    // A bare number is the amount only once a pincode has been read.
    const bareAmount = line.match(RE_BARE_AMOUNT);
    if (bareAmount && draft.pincode && !draft.amount) {
      const found = bareAmount[1].replace(/,/g, "");
      if (Number(found) > 0) {
        draft.amount = found;
        if (draft.paymentMode !== "Prepaid") draft.paymentMode = "COD";
        continue;
      }
    }

    // Payment mode lines are read after amounts so an explicit "Prepaid" that
    // follows "400Rs" overrides the COD implied by the amount. A line that
    // also carries address wording is left for the cleanup pass below.
    if (!hasAddressWording) {
      const mode = readPaymentMode(line);
      if (mode) {
        draft.paymentMode = mode;
        continue;
      }
    }

    leftovers.push(line);
  }
  // A pasted line can carry the address plus its amount and payment mode, e.g.
  // "main market dehradun 2500Rs prepaid". Pull the money/payment out and push
  // the remaining text into a dedicated address bucket so it can never be
  // mistaken for the customer's name.
  const moneyAddressLines: string[] = [];
  for (const line of [...leftovers]) {
    if (!RE_NON_ADDRESS.test(line)) continue;
    if (!draft.amount) draft.amount = readAmount(line);
    const mode = readPaymentMode(line);
    if (mode) draft.paymentMode = mode;
    const cleaned = stripMoneyAndPayment(line);
    const index = leftovers.indexOf(line);
    if (index >= 0) leftovers.splice(index, 1);
    if (cleaned) moneyAddressLines.push(cleaned);
  }
  // A line that was only "Prepaid" / "400Rs" leaves no address text behind.
  explicitAddress.push(...moneyAddressLines);

  const idPattern = /^[A-Za-z]{0,6}[-_ ]?\d{1,8}$/;

  for (const line of leftovers) {
    if (!draft.orderId && idPattern.test(line) && !/\s/.test(line.trim())) {
      draft.orderId = line.trim().toUpperCase();
      continue;
    }
    // A person name: up to 4 words, no digits, not an address or money line.
    if (
      !draft.name &&
      !/address/i.test(line) &&
      !RE_NON_ADDRESS.test(line) &&
      /^[A-Za-z][A-Za-z.' \-]{2,48}$/.test(line) &&
      line.trim().split(/\s+/).length <= 4
    ) {
      draft.name = line.trim().replace(/\s+/g, " ");
      continue;
    }
  }

  const addressLines = leftovers.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === draft.name) return false;
    if (trimmed.toUpperCase() === draft.orderId) return false;
    if (!draft.amount && /^[\d.,]+\s*(?:rs\.?|inr)\s*$/i.test(trimmed)) return false;
    if (
      RE_NON_ADDRESS.test(trimmed) &&
      !/[A-Za-z]{4,}/.test(
        trimmed.replace(RE_NON_ADDRESS, "").replace(/\d+/g, ""),
      )
    ) {
      return false;
    }
    return trimmed.length > 0;
  });

  draft.address = [...explicitAddress, ...addressLines]
    .map((line) =>
      stripMoneyAndPayment(
        line.replace(/^address\s*[:\u2013-]?\s*/i, "").trim(),
      ),
    )
    .filter(Boolean)
    .join(", ");

  // Best-effort only: the server overrides these with Delhivery's own
  // serviceability record for the pincode, which is authoritative.
  if (!draft.city && !draft.state) {
    const parts = draft.address.split(",").map((part) => part.trim()).filter(Boolean);
    const state = parts[parts.length - 1] || "";
    const city = parts[parts.length - 2] || "";
    const looksLikeState = state && !/\d/.test(state) && state.length <= 30;
    const looksLikeCity = city && !/\d/.test(city) && city.length <= 30;
    if (looksLikeState && looksLikeCity) {
      draft.city = city;
      draft.state = state;
    }
  }

  // An explicit payment word anywhere in the paste is the most deliberate
  // signal of intent, so let it win over the COD implied by an amount line.
  // Scan for every payment word and prefer Prepaid when both appear, because
  // "Prepaid" is never implied while "COD" is the fallback for a cash amount.
  const paymentWords = raw.match(RE_PAYMENT_GLOBAL) || [];
  if (paymentWords.some((word) => /^(prepaid|pre paid|paid|online|online payment|upi|advance)/i.test(word))) {
    draft.paymentMode = "Prepaid";
  } else if (paymentWords.length) {
    draft.paymentMode = "COD";
  }

  return draft;
}

