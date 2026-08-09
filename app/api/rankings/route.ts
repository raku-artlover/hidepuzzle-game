import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_size INTEGER NOT NULL,
  time_ms INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare(createTable),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS rankings_size_time_idx ON rankings (board_size, time_ms, created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS rankings_created_idx ON rankings (created_at)"),
  ]);
}

function jstDayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 9 * 60 * 60 * 1000;
}

function validSize(value: number) {
  return Number.isInteger(value) && value >= 4 && value <= 9;
}

async function topFive(boardSize: number, daily: boolean) {
  const cutoff = jstDayStart();
  const query = daily
    ? env.DB.prepare("SELECT name, time_ms, created_at FROM rankings WHERE board_size = ? AND created_at >= ? ORDER BY time_ms ASC, created_at ASC LIMIT 5").bind(boardSize, cutoff)
    : env.DB.prepare("SELECT name, time_ms, created_at FROM rankings WHERE board_size = ? ORDER BY time_ms ASC, created_at ASC LIMIT 5").bind(boardSize);
  const result = await query.all<{ name: string; time_ms: number; created_at: number }>();
  return result.results;
}

export async function GET(request: Request) {
  await ensureSchema();
  const url = new URL(request.url);
  const boardSize = Number(url.searchParams.get("size"));
  if (!validSize(boardSize)) return Response.json({ error: "Invalid board size" }, { status: 400 });

  if (url.searchParams.get("mode") === "qualify") {
    const timeMs = Number(url.searchParams.get("time"));
    if (!Number.isInteger(timeMs) || timeMs < 500 || timeMs > 3_600_000) return Response.json({ qualifies: false });
    const [allTime, daily] = await Promise.all([topFive(boardSize, false), topFive(boardSize, true)]);
    const rank = (rows: Array<{ time_ms: number }>) => rows.filter(row => row.time_ms <= timeMs).length + 1;
    const allRank = rank(allTime), dailyRank = rank(daily);
    const records = [
      ...(allRank <= 5 ? [{ scope: "all", rank: allRank }] : []),
      ...(dailyRank <= 5 ? [{ scope: "daily", rank: dailyRank }] : []),
    ];
    return Response.json({ qualifies: records.length > 0, records }, { headers: { "Cache-Control": "no-store" } });
  }

  const scope = url.searchParams.get("scope") === "daily";
  return Response.json({ rows: await topFive(boardSize, scope), scope: scope ? "daily" : "all" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json().catch(() => null) as { size?: number; timeMs?: number; name?: string } | null;
  const boardSize = Number(body?.size), timeMs = Number(body?.timeMs), name = String(body?.name ?? "").trim().normalize("NFC");
  if (!validSize(boardSize) || !Number.isInteger(timeMs) || timeMs < 500 || timeMs > 3_600_000 || !name || Array.from(name).length > 5) {
    return Response.json({ error: "Invalid score" }, { status: 400 });
  }
  const [allTime, daily] = await Promise.all([topFive(boardSize, false), topFive(boardSize, true)]);
  const qualifies = (rows: Array<{ time_ms: number }>) => rows.length < 5 || timeMs < rows[4].time_ms;
  const allQualified = qualifies(allTime), dailyQualified = qualifies(daily);
  if (!allQualified && !dailyQualified) return Response.json({ error: "Score no longer qualifies" }, { status: 409 });
  await env.DB.prepare("INSERT INTO rankings (board_size, time_ms, name, created_at) VALUES (?, ?, ?, ?)").bind(boardSize, timeMs, name, Date.now()).run();
  return Response.json({ ok: true, scopes: [...(allQualified ? ["all"] : []), ...(dailyQualified ? ["daily"] : [])] });
}
