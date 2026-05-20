'use server'

import { createClient } from '@/lib/supabase-server'

export async function signup({
  email,
  password,
}: {
  email: string
  password: string
}) {
  // Invite-only allowlist (PROJ-10)
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (allowed.length > 0 && !allowed.includes(email.trim().toLowerCase())) {
    return { error: 'Registrierung ist nur auf Einladung möglich.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Diese E-Mail ist bereits registriert' }
    }
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  if (!data.session) {
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  return { success: true }
}
