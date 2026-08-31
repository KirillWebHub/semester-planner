import { apiUrl } from "../../../shared/api/apiUrl.js";

export async function loadIsuCurriculum(profile) {
  const query = new URLSearchParams({
    academicYear: profile.academicYear.replace(/[^\d/]/g, ""),
    group: profile.group,
    semester: String(profile.semester),
  });
  const response = await fetch(apiUrl(`/api/isu/curriculum?${query}`));
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error || "Не удалось прочитать открытый план ИСУ.");
  return result;
}
