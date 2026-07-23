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

  // Create auth user — PROJ-10 trigger adds them to shared (oldest) workspace.
  // The GoTrue admin API on this project intermittently fails with
  // "unrecognized JWT kid <nil> for algorithm ES256" (KI-31, ~3% of calls,
  // transient — likely a signing-key propagation/LB inconsistency). It is
  // NOT deterministic and NOT a prod path (prod uses the public auth endpoints,
  // never auth.admin). Bounded retry makes the harness reliably green; same
  // resilience pattern as KI-11/KI-18 elsewhere in the codebase.
  let userData: Awaited<ReturnType<typeof admin.auth.admin.createUser>>['data'] | null = null
  let lastError: string | null = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { workspace_name: workspaceName },
    })
    if (!error && data?.user) {
      userData = data
      break
    }
    lastError = error?.message ?? 'no user returned'
    if (attempt < 4) await new Promise((r) => setTimeout(r, 300 * attempt))
  }
  if (!userData?.user) throw new Error(`createTestUser failed after retries: ${lastError}`)

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

  // NOTE: We intentionally do NOT write workspace_id into user_metadata via
  // admin.auth.admin.updateUserById here. On this project (asymmetric ES256 JWT
  // signing keys) that GoTrue admin path fails with "unrecognized JWT kid <nil>
  // for algorithm ES256" (KI-31). It is not needed: the dashboard resolves the
  // workspace_id from user_metadata OR falls back to the (single) workspace_members
  // row we just inserted — see dashboard/{use-cases,process-steps,use-cases/roadmap}/page.tsx.
  // Dropping the call also makes the harness match how real users resolve their
  // workspace (fallback-based). workspace_name is already set by createUser above.
}
