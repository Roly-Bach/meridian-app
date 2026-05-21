import { createClient } from '@supabase/supabase-js'

export async function deleteTestUsers(emails: string[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || emails.length === 0) return

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emailSet = new Set(emails)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error || !data) return

  for (const user of data.users) {
    if (user.email && emailSet.has(user.email)) {
      await admin.auth.admin.deleteUser(user.id)
    }
  }
}
