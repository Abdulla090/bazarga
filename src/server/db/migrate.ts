import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Db } from "./index";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function runMigrations(database: Db, url: string) {
  if (url.startsWith("pglite://")) {
    await migratePglite(database as unknown as PgliteDatabase<Record<string, never>>, {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  } else {
    await migratePg(database as unknown as NodePgDatabase<Record<string, never>>, {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  }
}
