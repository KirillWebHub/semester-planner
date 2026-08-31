import { validateWorkspace } from "../../../entities/schedule/index.js";

export async function requestWorkspace(method = "GET", body) {
  const response = await fetch("/api/workspace", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(7000),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Локальный сервер сохранения недоступен.");
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Не удалось сохранить на диск.");
    error.conflict = response.status === 409;
    throw error;
  }
  if (result.state) validateWorkspace(result.state);
  return result;
}
