import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ─── DELETE /api/interviews/[id] ─────────────────────────────────────────────
// Deletes an interview and all cascaded data (turns, knowledge_objects,
// process_steps, use_cases, interview_state) for the authenticated workspace.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

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

    const admin = getSupabaseAdmin()

    // Verify the interview belongs to the user's workspace before deleting
    const { data: interview } = await admin
      .from('interviews')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const { error: deleteError } = await admin
      .from('interviews')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/interviews/[id]]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
