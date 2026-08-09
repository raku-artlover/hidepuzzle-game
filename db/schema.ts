import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rankings = sqliteTable("rankings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  boardSize: integer("board_size").notNull(),
  timeMs: integer("time_ms").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("rankings_size_time_idx").on(table.boardSize, table.timeMs, table.createdAt),
  index("rankings_created_idx").on(table.createdAt),
]);
