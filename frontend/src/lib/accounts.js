// Solo el dominio correcto: las variantes mal escritas que habia aqui no
// pertenecen a nadie, y quien las registrara pasaba a ser superadministrador.
const SUPERADMIN_EMAILS = new Set(["luis.gamarra@techdatasync.com"]);
const isPlatformAdmin = (account) =>
  account &&
  (["admin", "superadmin"].includes(account.role) ||
    SUPERADMIN_EMAILS.has((account.email || "").trim().toLowerCase()));
const normalizeAccount = (account) =>
  account && isPlatformAdmin(account)
    ? { ...account, role: "superadmin" }
    : account;
const loadCurrentUser = () => {
  const current = JSON.parse(localStorage.getItem("choping-user") || "null");
  if (!current) return null;
  const registeredAccount = JSON.parse(localStorage.getItem("choping-registered-users") || "[]")
    .find((account) => account.email === current.email);
  return normalizeAccount({ ...current, ...registeredAccount });
};

export { SUPERADMIN_EMAILS, isPlatformAdmin, loadCurrentUser, normalizeAccount };
