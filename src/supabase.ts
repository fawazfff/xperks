const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rfuxxeiceieqffudwyaw.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_WDGuRMl4VT4ExCyffLA-3w_IfX0l0i9";

export async function perkIdForSlug(slug: string): Promise<bigint | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/perks?select=benefit_id&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error("Could not resolve perk link");
  const rows = await response.json() as Array<{ benefit_id: number }>;
  return rows[0] ? BigInt(rows[0].benefit_id) : null;
}
