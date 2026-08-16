// File: apps/mobile/lib/auth.ts
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import { supabase } from './supabase'

/**
 * Exchanges the access/refresh tokens carried in a magic-link or OAuth deep
 * link for a Supabase session. Mirrors what apps/web/app/auth/callback/route.ts
 * does server-side, but there's no server route in React Native — this runs
 * client-side against whatever URL the OS handed the app.
 */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url)
  if (errorCode) throw new Error(errorCode)

  const { access_token, refresh_token } = params
  if (!access_token || !refresh_token) return null

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
  return data.session
}
