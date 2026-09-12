type DB = D1Database;

export async function hasCapability(
  db: DB,
  userId: string,
  capability: "renting" | "listing"
): Promise<boolean> {
  const row = await db
    .prepare(`
      SELECT 1
      FROM user_capabilities
      WHERE user_id = ?
        AND capability = ?
      LIMIT 1
    `)
    .bind(userId, capability)
    .first();

  return !!row;
}

export async function hasApprovedAuthority(
  db: DB,
  userId: string,
  propertyId: string
): Promise<boolean> {
  const row = await db
    .prepare(`
      SELECT 1
      FROM property_authority
      WHERE user_id = ?
        AND property_id = ?
        AND status = 'approved'
      LIMIT 1
    `)
    .bind(userId, propertyId)
    .first();

  return !!row;
}