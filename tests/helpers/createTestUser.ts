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

  // Create auth user — PROJ-10 trigger adds them to shared (oldest) workspace
  const { data: userData, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { workspace_name: workspaceName },
  })
  if (error) throw new Error(`createTestUser failed: ${error.message}`)
  if (!userData?.user) throw new Error('createTestUser: no user returned')

  const userId = userData.user.id

  // Remove from shared workspace (PROJ-10 trigger adds all users to oldest workspace)
  await admin.from('workspace_members').delete().eq('user_id', userId)

  // Create isolated private workspace for this test user
  const { data: wsData, error: wsError } = await admin
    .from('workspaces')
    .insert({ name: workspaceName, user_id: userId })
    .select('id')
    .single()
  if (wsError || !wsData) throw new Error(`createTestUser: workspace creation failed: ${wsError?.message}`)

  const workspaceId = wsData.id

  // Add to private workspace
  await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId })

  // Update user metadata with correct workspace_id for dashboard routing
  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { workspace_name: workspaceName, workspace_id: workspaceId },
  })
  if (metaError) throw new Error(`createTestUser: metadata update failed: ${metaError.message}`)
}
