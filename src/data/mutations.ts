import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { baby } from '../db/schema';

export async function updateBabySettings(
  patch: Partial<{ name: string | null; birthdate: Date | null; welcomedAt: Date | null }>,
): Promise<void> {
  const rows = await db.select().from(baby);
  if (rows[0]) await db.update(baby).set(patch).where(eq(baby.id, rows[0].id));
}
