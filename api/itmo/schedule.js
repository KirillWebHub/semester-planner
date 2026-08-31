import { fetchItmoGroupSchedule } from "../../server/itmoSchedule.js";

function allowPublicRead(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!allowPublicRead(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }
  try {
    const input =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const value = await fetchItmoGroupSchedule({
      group: input?.group,
      curriculum: Array.isArray(input?.curriculum)
        ? input.curriculum.slice(0, 100)
        : [],
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    res.status(200).json(value);
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
}
