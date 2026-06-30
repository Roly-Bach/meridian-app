#!/usr/bin/env tsx
/**
 * Judge-Key-Validitäts-Preflight (PROJ-40 D, Regel „Eval-Preflight: Judge-API-Key validieren").
 * Echter Mini-Request gegen Prod- + Referenz-Judge, damit ein ungültiger Key HART scheitert,
 * statt dass der Kalibrierungslauf still Fallback-Scores produziert. Kein Teil des Builds — Einweg.
 */
import path from 'path'
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env.local') })

import { generateText } from 'ai'
import { resolveModel } from '../src/lib/llm-provider'

async function main() {
  let ok = true
  for (const m of ['anthropic/claude-sonnet-4-5', 'anthropic/claude-haiku-4-5']) {
    try {
      const r = await generateText({ model: resolveModel(m), prompt: 'Antworte nur mit: ok', maxOutputTokens: 5 })
      console.log('PREFLIGHT', m, 'OK', JSON.stringify(r.text.trim().slice(0, 20)))
    } catch (e) {
      ok = false
      const msg = e instanceof Error ? e.message : String(e)
      console.log('PREFLIGHT', m, 'FAIL', msg.slice(0, 220))
    }
  }
  if (!ok) process.exitCode = 2
}
main()
