import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Single Supabase client factory, env-driven (dev/staging/prod), shared by
 * web + mobile. Per Stack Playbook §1: "single Supabase client factory ...
 * never point local dev at the prod project."
 *
 * Web (Next.js) reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Mobile (Expo) reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Pass them in explicitly rather than reaching into process.env here, so this
 * package stays framework-agnostic.
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase URL and anon key are required. Check your env vars for this app (web vs mobile use different prefixes)."
    );
  }
  return createClient(url, anonKey);
}

export * from "@portfolio-tracker/schemas";

/**
 * Calls the get-quote Edge Function (see supabase/functions/get-quote).
 * This is the ONLY place client code should ask for a price — never fetch
 * Yahoo Finance directly from web/mobile.
 */
export async function fetchQuote(
  client: SupabaseClient,
  ticker: string
): Promise<{ ticker: string; price_zar: number; fetched_at: string }> {
  const { data, error } = await client.functions.invoke("get-quote", {
    body: { ticker },
  });
  if (error) throw error;
  return data;
}
