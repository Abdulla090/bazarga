import type { Db } from "../db";
import { waitlist } from "../db/schema";
import type { z } from "zod";
import type { waitlistSchema } from "@/lib/validation";

export async function joinWaitlist(database: Db, input: z.infer<typeof waitlistSchema>) {
  const [row] = await database.insert(waitlist).values(input).returning({ id: waitlist.id });
  return row!;
}
