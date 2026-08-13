import "server-only";

function apiKey() {
  const key = String(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
  if (!key) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY.");
  return key;
}

async function identityRequest(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey())}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload?.error?.message || "Firebase Authentication request failed.").replace(/_/g, " "));
  return payload;
}

export function signUpWithPassword(email: string, password: string) { return identityRequest("accounts:signUp", { email, password, returnSecureToken: true }); }
export function signInWithPassword(email: string, password: string) { return identityRequest("accounts:signInWithPassword", { email, password, returnSecureToken: true }); }
export function sendPasswordReset(email: string, continueUrl: string) { return identityRequest("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email, continueUrl, canHandleCodeInApp: false }); }
export function confirmPasswordReset(oobCode: string, newPassword: string) { return identityRequest("accounts:resetPassword", { oobCode, newPassword }); }
