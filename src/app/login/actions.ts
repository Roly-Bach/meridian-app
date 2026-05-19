'use server'

import { createClient } from '@/lib/supabase-server'

export async function login({ email, password }: { email: string; password: string }) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Ungültige Anmeldedaten' }
  }

  return { success: true }
}
