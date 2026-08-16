// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's auth account. Every user-data table
// (transactions, targets, deposits, user_settings) has `references
// auth.users(id) on delete cascade`, so deleting the auth user removes all
// of their data automatically — no manual table cleanup needed here.
//
// This is the ONLY place in the codebase that touches the Supabase service
// role key. It is never sent to any client — SUPABASE_SERVICE_ROLE_KEY is an
// env var Supabase injects automatically into every Edge Function, not a
// secret we configure ourselves.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Scoped to the caller's own JWT — used only to find out who's calling.
    // Never used to perform the deletion itself (RLS would block a user from
    // deleting anyone but themselves anyway, but auth.admin.deleteUser needs
    // the service-role client below regardless, since it's not an RLS-governed
    // table operation).
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    // Service-role client — the only client in this function that can call
    // the admin API. Deleting the auth user cascades to every data table.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
