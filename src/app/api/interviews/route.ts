import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']

// ─── GET /api/interviews ─────────────────────────────────────────────────────
// Returns all interviews for the authenticated user's workspace, newest first.

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    if (!member) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    const workspaceId = member.workspace_id

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('interviews')
      .select('id, employee_name, employee_role, department, focus_topics, status, access_token, token_expires_at, max_duration_minutes, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ interviews: (data as InterviewRow[]) ?? [] })
  } catch (err) {
    console.error('[GET /api/interviews]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/interviews ────────────────────────────────────────────────────
// Creates a new interview and returns it with the generated access_token.

const CreateInterviewSchema = z.object({
  employee_name: z.string().min(1).max(200),
  employee_role: z.string().min(1).max(200),
  department: z.string().min(1).max(200),
  focus_topics: z.string().max(2000).optional(),
  max_duration_minutes: z.union([z.literal(10), z.literal(30)]).default(30),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    if (!member) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    const workspaceId = member.workspace_id

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

    const { employee_name, employee_role, department, focus_topics, max_duration_minutes } = parsed.data

    const accessToken = crypto.randomUUID()
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const admin = getSupabaseAdmin()

    const { data: rawInterview, error: insertError } = await admin
      .from('interviews')
      .insert({
        workspace_id: workspaceId,
        employee_name,
        employee_role: employee_role,
        department,
        focus_topics: focus_topics ?? null,
        status: 'created',
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        max_duration_minutes,
      })
      .select()
      .single()

    const interview = rawInterview as InterviewRow | null

    if (insertError || !interview) {
      console.error('[POST /api/interviews] insert error:', insertError?.message)
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
      console.error('[POST /api/interviews] state insert error:', stateError.message)
      await admin.from('interviews').delete().eq('id', interview.id)
      return NextResponse.json({ error: 'Failed to initialize interview state' }, { status: 500 })
    }

    return NextResponse.json({ interview }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/interviews]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
