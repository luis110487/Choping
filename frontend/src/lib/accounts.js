const SUPERADMIN_EMAILS = new Set([
  "luis.gamarra@techdatasync.com",
  "luis.gamarra@techdatasaync.com",
  "luis.gamarra@techdatasyn.com",
]);
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
