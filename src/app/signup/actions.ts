'use server'

import { createClient } from '@/lib/supabase-server'

export async function signup({
  email,
  password,
  workspaceName,
}: {
  email: string
  password: string
  workspaceName: string
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { workspace_name: workspaceName },
    },
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
