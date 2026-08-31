const configuredBase = String(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

export function apiUrl(path) {
  return `${configuredBase}${path.startsWith("/") ? path : `/${path}`}`;
}
