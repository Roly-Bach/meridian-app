import { createClient } from '@supabase/supabase-js'

export async function createTestUser(
  email: string,
  password: string,
  workspaceName = 'QA Test Workspace'
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars')

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { workspace_name: workspaceName },
  })

  if (error) throw new Error(`createTestUser failed: ${error.message}`)
}
