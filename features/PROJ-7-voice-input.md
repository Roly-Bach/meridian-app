# PROJ-7 Voice Input (Interview)

**Status:** In Review
**Priority:** P1
**Created:** 2026-05-20
**Depends:** PROJ-3

## Summary

Adds real-time voice input to the Interview UI via ElevenLabs Scribe v2 Realtime.
Employees can dictate answers into the interview chat instead of typing.

## Tech Design

- **Provider:** ElevenLabs Scribe v2 Realtime (`scribe_v2_realtime`)
- **Audio transport:** JSON + Base64 PCM over WebSocket (`wss://api.elevenlabs.io/v1/speech-to-text-realtime`)
- **VAD:** Configured server-side in token request (`vad_silence_threshold_secs: 1.5`)
- **Language:** Auto-detect (no `language_code` sent — supports DE/EN code-switching)
- **Resampling:** Browser AudioContext → 16 000 Hz via AudioWorklet (ScriptProcessor fallback)

## New Files

- `src/app/api/interview/[token]/voice-token/route.ts` — POST endpoint, fetches ElevenLabs session token
- `src/lib/audio/pcm-worklet.ts` — AudioWorklet processor source string (Blob URL approach)
- `src/hooks/useVoiceInput.ts` — React hook managing WS lifecycle, audio pipeline, state
- `src/hooks/useVoiceInput.test.ts` — Vitest unit + integration tests
- `src/components/interview/MicButton.tsx` — Mic icon button with idle/connecting/listening/error states

## Changed Files

- `src/components/interview/ChatInput.tsx` — Added optional `voiceToken`, `onVoiceCommitted`, `isStreamingAgent` props; MicButton + partial text display
- `src/components/interview/ChatInterface.tsx` — Passes `token` as `voiceToken` + `handleSend` as `onVoiceCommitted`
- `.env.local.example` — Added `ELEVENLABS_API_KEY`

## Implementation Notes

- Fully backward-compatible: `voiceToken`/`onVoiceCommitted` are optional. Without them, no MicButton renders.
- SSR-safe: MicButton only renders when `typeof window !== 'undefined' && navigator.mediaDevices` is truthy.
- API key never exposed to client — only returned `sessionToken` which expires in 900 s.

## QA Test Results

**Date:** 2026-05-21
**Tester:** /qa skill

### Test Suite

| Suite | Tests | Result |
|---|---|---|
| `useVoiceInput.test.ts` (helpers + hook) | 17 | PASS |
| `ChatInput.test.tsx` (voice states) | 3 | PASS |
| `voice-token.test.ts` (backend route) | 10 | PASS (written by QA) |
| Full worktree suite | 169 | PASS |

### Acceptance Criteria Coverage

| Criterion | Status |
|---|---|
| Mikrofon-Button erscheint neben Send-Button | PASS |
| Button nur wenn `navigator.mediaDevices` verfügbar | PASS |
| Button disabled während Agent-Stream | PASS (visually) |
| Zwei visuelle Zustände (inaktiv / aktiv-pulsierend Meridian Pink) | PASS |
| Klick auf inaktiv → Aufnahme startet | PASS |
| Klick auf aktiv → Aufnahme stoppt, kein Send | PASS (code review) |
| Textfeld disabled während Voice aktiv | PASS |
| Client ruft `POST /voice-token` auf | PASS |
| Browser baut WebSocket zu ElevenLabs auf | PASS |
| Audio als Mono-PCM 16 kHz Base64-Chunks | PASS |
| VAD `silence_threshold: 1.5s` | PASS (backend config) |
| `committed_transcript` → Auto-Send | PASS |
| `partial_transcript` als Live-Vorschau | PARTIAL — shown as caption below textarea, not inside textarea |
| Nach Auto-Send: Textfeld leert sich | PASS |
| Aufnahme läuft weiter nach Auto-Send | PASS (WS stays open) |
| Aufnahme pausiert während Agent antwortet | **FAIL — see BUG-01** |
| `voice-token` Endpunkt validiert Interview-Token | PASS |
| Ungültiger Token → 404/410 | PASS |
| Completed Interview → 409 | PASS |
| API-Key nur serverseitig | PASS |
| `getUserMedia` nicht verfügbar → kein Button | PASS |
| Mikrofonzugriff verweigert → Toast + zurück zu idle | PASS |
| WebSocket-Abbruch → Toast + zurück zu idle | PASS |
| voice-token API schlägt fehl → Toast, kein Start | PASS |

### Bugs Found

#### BUG-01 — HIGH: Voice recording continues while agent is streaming

**Severity:** High
**Steps:**
1. Start recording (click MicButton)
2. Speak a sentence → ElevenLabs commits → Auto-Send fires
3. While agent is responding (spinner visible), continue speaking
4. ElevenLabs commits again → `onCommittedRef.current` fires → `handleSend` called
5. `useInterviewStream.streamRequest` aborts the in-flight agent response and starts a new request

**Expected (spec):** "Aufnahme pausiert automatisch, Button disabled" — audio capture stops while agent responds.
**Actual:** MicButton is visually disabled but the WebSocket and AudioContext remain open. ElevenLabs can still emit `committed_transcript` events, sending another message and aborting the current agent stream.

**Location:** `src/hooks/useVoiceInput.ts` — the `disabled` prop only gates `start()`, not an active session.

**Fix:** In `useVoiceInput`, add a `useEffect` that watches the `disabled` prop and calls `stop()` when it transitions from `false → true` while `state !== 'idle'`. Or expose a `pause()/resume()` API that closes/reopens the WebSocket without resetting to idle.

---

#### BUG-02 — MEDIUM: Error state is a dead-end (mic button non-functional)

**Severity:** Medium
**Steps:**
1. Start recording
2. WebSocket error → `state = 'error'`
3. Click MicButton again
4. `handleMicClick` calls `start()` (state is 'error', not 'listening')
5. `start()` returns early because `state !== 'idle'`
6. User is stuck — mic button does nothing

**Expected:** Clicking the MicButton in error state should reset and retry.
**Actual:** `start()` checks `if (state !== 'idle') return`, so clicking in error state is a no-op.
**Location:** `src/hooks/useVoiceInput.ts:119` — add `|| state === 'error'` to the early-return check.

---

#### BUG-03 — MEDIUM: `stop()` may trigger unintended Auto-Send

**Severity:** Medium
**Steps:**
1. Start recording, speak half a sentence
2. Click MicButton to stop manually (mid-sentence)
3. `stop()` sends `{ message_type: 'input_audio_chunk', audio_base_64: '', commit: true }` before closing WS
4. If ElevenLabs processes the buffered VAD audio and returns `committed_transcript` before the WS close completes, `onCommittedRef.current` fires → Auto-Send

**Expected (spec edge case):** "Mitarbeiter stoppt Aufnahme manuell → kein committed_transcript, kein Send"
**Actual:** Sending `commit: true` is meant as a flush signal; it may trigger ElevenLabs to emit a final `committed_transcript` for buffered audio.
**Location:** `src/hooks/useVoiceInput.ts:99-112`

---

#### BUG-04 — MEDIUM: ElevenLabs response field name unconfirmed

**Severity:** Medium
**Location:** `src/app/api/interview/[token]/voice-token/route.ts:96-99`
**Detail:** The route tries three field names (`token`, `signed_url`, `session_id`) with a TODO comment: "confirm exact field name when API is stable". If none match the real ElevenLabs response, every voice-token request returns 502. Must be verified against the live API before deploy.

---

#### BUG-05 — LOW: `partial_transcript` shown as caption, not in textarea

**Severity:** Low
**Detail:** Spec says "Live-Vorschau im Textfeld angezeigt." Implementation renders it as `<p className="text-[12px] text-[#999] italic">` below the textarea. Functional equivalent but deviates from spec wording.
**Location:** `src/components/interview/ChatInput.tsx:98-102`

---

#### BUG-06 — LOW: Worktree test files pollute main branch test run

**Severity:** Low
**Detail:** Running `npm test` from the main project directory discovers test files inside `.claude/worktrees/agent-a326a1667b1aaa9b1/`, causing 6 failures because `@/hooks/useVoiceInput` doesn't exist on main. Needs vitest `exclude` config or the worktree should be merged.

---

### Security Audit

- `ELEVENLABS_API_KEY` never exposed to client — only the short-lived `sessionToken` is returned. PASS
- `voice-token` endpoint validates interview access token before issuing session token. PASS
- UUID format validation on `[token]` param (same regex as other routes). PASS
- Rate limiting applied before ElevenLabs API call. PASS
- No new attack surface for XSS or SQL injection.

### Production-Ready Decision

**NOT READY** — 2 High/Medium bugs must be fixed before deploy:

1. **BUG-01 (High):** Voice continues recording during agent stream → can abort agent responses unexpectedly.
2. **BUG-02 (Medium):** Error state is unrecoverable without page reload.
3. **BUG-04 (Medium):** ElevenLabs response field name must be verified against live API.
