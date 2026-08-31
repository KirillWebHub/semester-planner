import { apiUrl } from "../../../shared/api/apiUrl.js";

export async function requestPublicSchedule(profile) {
  const response = await fetch(apiUrl("/api/itmo/schedule"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group: profile.group,
      curriculum: profile.curriculum?.courses || [],
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(result?.error || "Не удалось проверить расписание ИТМО.");
  return result;
}
