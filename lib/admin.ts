export function isTeamAdmin(teamName: string | null | undefined) {
  if (!teamName) return false;

  const raw = process.env.ADMIN_TEAMS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(teamName.trim().toLowerCase());
}
