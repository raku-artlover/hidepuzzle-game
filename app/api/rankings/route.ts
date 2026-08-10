import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RankingRow = {
  name: string;
  time_ms: number;
  created_at: number;
};

const createTable = `CREATE TABLE IF NOT EXISTS rankings (
  id BIGSERIAL PRIMARY KEY,
  board_size INTEGER NOT NULL,
  time_ms INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
)`;

function databaseUrl() {
  const value =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() {
  return neon(databaseUrl());
}

async function ensureSchema() {
  const query = sql();
  await query.query(createTable);
  await query.query(
    "CREATE INDEX IF NOT EXISTS rankings_size_time_idx ON rankings (board_size, time_ms, created_at)",
  );
  await query.query(
    "CREATE INDEX IF NOT EXISTS rankings_created_idx ON rankings (created_at)",
  );
}

function jstDayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) -
    9 * 60 * 60 * 1000
  );
}

function validSize(value: number) {
  return Number.isInteger(value) && value >= 4 && value <= 9;
}

async function topFive(boardSize: number, daily: boolean) {
  const query = sql();
  const rows = daily
    ? await query`
        SELECT name, time_ms, created_at
        FROM rankings
        WHERE board_size = ${boardSize} AND created_at >= ${jstDayStart()}
        ORDER BY time_ms ASC, created_at ASC
        LIMIT 5
      `
    : await query`
        SELECT name, time_ms, created_at
        FROM rankings
        WHERE board_size = ${boardSize}
        ORDER BY time_ms ASC, created_at ASC
        LIMIT 5
      `;
  return rows.map((row) => ({
    name: String(row.name),
    time_ms: Number(row.time_ms),
    created_at: Number(row.created_at),
  })) as RankingRow[];
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const boardSize = Number(url.searchParams.get("size"));
    if (!validSize(boardSize)) {
      return Response.json({ error: "Invalid board size" }, { status: 400 });
    }

    if (url.searchParams.get("mode") === "qualify") {
      const timeMs = Number(url.searchParams.get("time"));
      if (!Number.isInteger(timeMs) || timeMs < 500 || timeMs > 3_600_000) {
        return Response.json({ qualifies: false });
      }
      const [allTime, daily] = await Promise.all([
        topFive(boardSize, false),
        topFive(boardSize, true),
      ]);
      const rank = (rows: RankingRow[]) =>
        rows.filter((row) => row.time_ms <= timeMs).length + 1;
      const allRank = rank(allTime);
      const dailyRank = rank(daily);
      const records = [
        ...(allRank <= 5 ? [{ scope: "all", rank: allRank }] : []),
        ...(dailyRank <= 5 ? [{ scope: "daily", rank: dailyRank }] : []),
      ];
      return Response.json(
        { qualifies: records.length > 0, records },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const daily = url.searchParams.get("scope") === "daily";
    return Response.json(
      {
        rows: await topFive(boardSize, daily),
        scope: daily ? "daily" : "all",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Ranking GET failed", error);
    return Response.json(
      { error: "Ranking database is unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = (await request.json().catch(() => null)) as {
      size?: number;
      timeMs?: number;
      name?: string;
    } | null;
    const boardSize = Number(body?.size);
    const timeMs = Number(body?.timeMs);
    const name = String(body?.name ?? "").trim().normalize("NFC");
    if (
      !validSize(boardSize) ||
      !Number.isInteger(timeMs) ||
      timeMs < 500 ||
      timeMs > 3_600_000 ||
      !name ||
      Array.from(name).length > 5
    ) {
      return Response.json({ error: "Invalid score" }, { status: 400 });
    }

    const [allTime, daily] = await Promise.all([
      topFive(boardSize, false),
      topFive(boardSize, true),
    ]);
    const qualifies = (rows: RankingRow[]) =>
      rows.length < 5 || timeMs < rows[4].time_ms;
    const allQualified = qualifies(allTime);
    const dailyQualified = qualifies(daily);
    if (!allQualified && !dailyQualified) {
      return Response.json(
        { error: "Score no longer qualifies" },
        { status: 409 },
      );
    }

    const query = sql();
    await query`
      INSERT INTO rankings (board_size, time_ms, name, created_at)
      VALUES (${boardSize}, ${timeMs}, ${name}, ${Date.now()})
    `;
    return Response.json({
      ok: true,
      scopes: [
        ...(allQualified ? ["all"] : []),
        ...(dailyQualified ? ["daily"] : []),
      ],
    });
  } catch (error) {
    console.error("Ranking POST failed", error);
    return Response.json(
      { error: "Ranking database is unavailable" },
      { status: 503 },
    );
  }
}
