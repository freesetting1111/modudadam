export function isLocalAuthEnabled() {
  return process.env.LOCAL_AUTH_ENABLED === "true";
}
