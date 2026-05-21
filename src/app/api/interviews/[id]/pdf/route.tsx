import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { InterviewReport } from '@/components/pdf/InterviewReport'
import { generateReportData } from '@/services/reportGenerator'

// ─── GET /api/interviews/[id]/pdf ────────────────────────────────────────────
// Auth: Supabase session cookie (workspace-member only)
// Returns: application/pdf binary — browser triggers download

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await params

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Load interview ──────────────────────────────────────────────────────────
  const admin = getSupabaseAdmin()
  const { data: interview, error: ivError } = await admin
    .from('interviews')
    .select('id, workspace_id, status, employee_name')
    .eq('id', interviewId)
    .single()

  if (ivError || !interview) {
    return NextResponse.json({ error: 'Interview nicht gefunden' }, { status: 404 })
  }

  if (interview.status !== 'completed') {
    return NextResponse.json(
      { error: 'Interview nicht abgeschlossen' },
      { status: 404 }
    )
  }

  // ── Verify workspace membership ─────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', interview.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Generate report data ────────────────────────────────────────────────────
  const reportData = await generateReportData(interviewId)
  if (!reportData) {
    return NextResponse.json(
      { error: 'Fehler beim Laden der Interview-Daten' },
      { status: 500 }
    )
  }

  const hasContent =
    reportData.processSteps.length > 0 ||
    reportData.painPoints.length > 0 ||
    reportData.tools.length > 0

  if (!hasContent) {
    return NextResponse.json(
      { error: 'Keine Daten vorhanden. Extraktion fehlgeschlagen oder Interview zu kurz.' },
      { status: 422 }
    )
  }

  // ── Render PDF ──────────────────────────────────────────────────────────────
  try {
    const element = React.createElement(InterviewReport, { data: reportData }) as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    const sanitizedName = interview.employee_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="meridian-report-${sanitizedName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf/route] renderToBuffer failed:', err)
    return NextResponse.json(
      { error: 'PDF-Generierung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
