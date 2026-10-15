import { eq } from "drizzle-orm";
import { createDb } from "../../src/server/db";
import { stores } from "../../src/server/db/schema";
import { THEME_STUDIO_PRESETS } from "../../src/lib/theme-studio/presets";
async function main() {
  const db = createDb("pglite://./.pglite");
  await db.update(stores).set({ themePublished: THEME_STUDIO_PRESETS[process.argv[2]!] }).where(eq(stores.slug, "hawler-bazaar"));
  process.exit(0);
}
main();
