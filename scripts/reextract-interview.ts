/**
 * Re-extracts knowledge objects + enriches process steps for a completed interview.
 * Usage: npx tsx scripts/reextract-interview.ts <interview_id>
 *
 * Loads env from .env.local automatically.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually (no dotenv dependency)
const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (key && !process.env[key]) process.env[key] = val
}

import { extractAndEmbed } from '../src/services/extraction'
import { enrichProcessSteps } from '../src/services/processEnrichment'
import { getSupabaseAdmin } from '../src/lib/supabase-admin'

async function main() {
  const interviewId = process.argv[2]
  if (!interviewId) {
    console.error('Usage: npx tsx scripts/reextract-interview.ts <interview_id>')
    process.exit(1)
  }

  const supabase = getSupabaseAdmin()

  const { data: interview, error: ivErr } = await supabase
    .from('interviews')
    .select('id, workspace_id, employee_name, status')
    .eq('id', interviewId)
    .single()

  if (ivErr || !interview) {
    console.error('Interview not found:', ivErr?.message)
    process.exit(1)
  }

  console.log(`Interview: ${interview.employee_name} (${interview.status})`)
  console.log(`Workspace: ${interview.workspace_id}`)

  const { data: turns } = await supabase
    .from('turns')
    .select('id, turn_number, user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  if (!turns || turns.length === 0) {
    console.error('No turns found.')
    process.exit(1)
  }

  console.log(`\nFound ${turns.length} turns. Running extraction...\n`)

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const transcript = turns.slice(0, i + 1).map(t => ({
      user_input: t.user_input,
      agent_response: t.agent_response,
    }))

    process.stdout.write(`  Turn ${turn.turn_number}: ${turn.user_input.slice(0, 50)}... `)
    await extractAndEmbed({
      interviewId,
      workspaceId: interview.workspace_id,
      turnId: turn.id,
      transcript,
    })
    console.log('✓')
  }

  const { count: koCount } = await supabase
    .from('knowledge_objects')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId)

  console.log(`\nKnowledge objects created: ${koCount ?? 0}`)

  if ((koCount ?? 0) > 0) {
    console.log('\nRunning process step enrichment...')
    await enrichProcessSteps({
      interviewId,
      workspaceId: interview.workspace_id,
    })

    const { count: psCount } = await supabase
      .from('process_steps')
      .select('*', { count: 'exact', head: true })
      .eq('interview_id', interviewId)

    console.log(`Process steps created: ${psCount ?? 0}`)
  } else {
    console.log('No knowledge objects extracted — enrichment skipped.')
    console.log('Possible reason: interview content did not contain extractable process data.')
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
