export type PincodeServiceabilityResponse = {
  serviceable: boolean;
  pincode: string;
  message: string;
  location?: string;
  city?: string;
  district?: string;
  state?: string;
};

function sanitizePincode(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export function normalizePincode(value: string): string {
  return sanitizePincode(value);
}

export async function checkPincodeServiceability(pincodeInput: string): Promise<PincodeServiceabilityResponse> {
  const pincode = sanitizePincode(pincodeInput);
  const response = await fetch(`/api/pincode-serviceability?pincode=${encodeURIComponent(pincode)}`, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as PincodeServiceabilityResponse | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.message || "Unable to verify pincode right now. Please try again.");
  }

  return payload;
}
