const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ajqukplphetzavnfcxio.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_p7M3OA6dClrOTRM5sKHM2A_c8kjIPvu";
const API = `${SUPABASE_URL}/functions/v1/xperks-api`;

export type Campaign = {
  id: number;
  contract_address: `0x${string}`;
  onchain_benefit_id: number;
  creator_wallet: string;
  asset_symbol: string;
  title: string;
  description: string;
  minimum_display: number;
  status: "published" | "paused";
  created_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "xPerks could not complete this request.");
  return result as T;
}

export async function listCampaigns() {
  return (await request<{ campaigns: Campaign[] }>("/campaigns")).campaigns;
}

export async function getCampaign(id: number) {
  return (await request<{ campaign: Campaign }>(`/campaigns/${id}`)).campaign;
}

export async function getActiveContract() {
  return (await request<{ contract: `0x${string}` | null }>("/active-contract")).contract;
}

export async function createCampaign(payload: Record<string, unknown>) {
  return request<{ campaignId: number; path: string }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unlockCampaign(payload: Record<string, unknown>) {
  return request<{ destination: string }>("/unlock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDashboard(payload: Record<string, unknown>) {
  return (await request<{ campaigns: Campaign[] }>("/dashboard", {
    method: "POST",
    body: JSON.stringify(payload),
  })).campaigns;
}

export async function updateCampaignDestination(id: number, payload: Record<string, unknown>) {
  return request<{ ok: boolean }>(`/campaigns/${id}/destination`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
