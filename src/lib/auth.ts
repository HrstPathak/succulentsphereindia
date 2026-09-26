export {
  AUTH_COOKIE_NAME,
  clearAuthCookies,
  createSessionCookie,
  ensureUserProfile,
  getAuthenticatedCustomer,
  getAuthenticatedUid,
  getSessionIdentity,
  requireAuthenticatedUid,
  revokeCurrentSession,
  setSessionCookie,
} from "@/lib/firebase-auth";
