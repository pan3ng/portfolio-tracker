// File: lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for Client Components.
 *
 * This uses @supabase/ssr's browser client which automatically handles
 * cookie management in the browser. Per the architecture doc, this wraps
 * the existing createSupabaseClient() factory from packages/api-client
 * but uses the SSR-specific browser client implementation.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
