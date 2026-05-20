import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']

// ─── GET /api/interviews ─────────────────────────────────────────────────────
// Returns all interviews for the authenticated user's workspace, newest first.

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user }, error: authError } = await (supabase.auth as any).getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = user.user_metadata?.workspace_id as string | undefined
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('interviews')
    .select('id, employee_name, employee_role, department, focus_topics, status, access_token, token_expires_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ interviews: (data as InterviewRow[]) ?? [] })
}

// ─── POST /api/interviews ────────────────────────────────────────────────────
// Creates a new interview and returns it with the generated access_token.

const CreateInterviewSchema = z.object({
  employee_name: z.string().min(1).max(200),
  employee_role: z.string().max(200).optional(),
  department: z.string().min(1).max(200),
  focus_topics: z.string().max(2000).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user }, error: authError } = await (supabase.auth as any).getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = user.user_metadata?.workspace_id as string | undefined
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateInterviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { employee_name, employee_role, department, focus_topics } = parsed.data

  const accessToken = crypto.randomUUID()
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any

  const { data: rawInterview, error: insertError } = await admin
    .from('interviews')
    .insert({
      workspace_id: workspaceId,
      employee_name,
      employee_role: employee_role ?? null,
      department,
      focus_topics: focus_topics ?? null,
      status: 'created',
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
    })
    .select()
    .single()

  const interview = rawInterview as InterviewRow | null

  if (insertError || !interview) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  const { error: stateError } = await admin
    .from('interview_state')
    .insert({
      interview_id: interview.id,
      phase: 'intro',
      timer_minutes: 0,
      topics_covered: [],
      topics_open: [],
    })

  if (stateError) {
    await admin.from('interviews').delete().eq('id', interview.id)
    return NextResponse.json({ error: 'Failed to initialize interview state' }, { status: 500 })
  }

  return NextResponse.json({ interview }, { status: 201 })
}
