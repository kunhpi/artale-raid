import { getStore } from "@netlify/blobs";

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^[0-6]-(14|15|21|22|23)$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const nameToKey = (name) =>
  "n" + Array.from(new TextEncoder().encode(name)).map((b) => b.toString(16).padStart(2, "0")).join("");

export default async (req) => {
  const url = new URL(req.url);
  const week = url.searchParams.get("week") || "";
  if (!WEEK_RE.test(week)) return json({ error: "week 格式錯誤" }, 400);

  const store = getStore({ name: "artale-raid", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: `${week}/` });
    const people = (
      await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
    return json({ week, people });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON 格式錯誤" }, 400); }
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 12) : "";
    if (!name) return json({ error: "缺少暱稱" }, 400);
    const slots = Array.isArray(body.slots)
      ? [...new Set(body.slots.filter((s) => typeof s === "string" && SLOT_RE.test(s)))].slice(0, 40)
      : [];
    const key = `${week}/${nameToKey(name)}`;
    if (slots.length === 0) await store.delete(key);
    else await store.setJSON(key, { name, slots, updatedAt: Date.now() });
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/schedule" };
