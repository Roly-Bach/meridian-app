import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// Lazily initialised — null if env vars are missing (local dev without Upstash)
let redis: Redis | null = null
let tokenLimiter: Ratelimit | null = null
let ipLimiter: Ratelimit | null = null
let processStepsLimiter: Ratelimit | null = null
let useCasesLimiter: Ratelimit | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

function getLimiters() {
  const r = getRedis()
  if (!r) return null

  if (!tokenLimiter) {
    tokenLimiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(120, '1 h'), prefix: 'interview_token' })
  }
  if (!ipLimiter) {
    ipLimiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(200, '1 h'), prefix: 'interview_ip' })
  }
  if (!processStepsLimiter) {
    processStepsLimiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'user_processsteps' })
  }
  if (!useCasesLimiter) {
    useCasesLimiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'user_usecases' })
  }

  return { tokenLimiter, ipLimiter, processStepsLimiter, useCasesLimiter }
}

export function extractIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

type LimitCheckResult =
  | { blocked: false }
  | { blocked: true; response: NextResponse }

async function runLimit(limiter: Ratelimit, key: string, message: string): Promise<LimitCheckResult> {
  try {
    const result = await limiter.limit(key)
    if (result.success) return { blocked: false }
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    return {
      blocked: true,
      response: NextResponse.json(
        { error: message },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      ),
    }
  } catch {
    // fail-open: Upstash unreachable → let request through
    return { blocked: false }
  }
}

// For token-based (public) endpoints: checks per-token + per-IP limits.
// Returns a 429 response if either limit is exceeded, null otherwise.
export async function checkTokenEndpointLimits(
  token: string,
  ip: string
): Promise<NextResponse | null> {
  const limiters = getLimiters()
  if (!limiters) return null

  const tokenResult = await runLimit(
    limiters.tokenLimiter,
    token,
    'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.'
  )
  if (tokenResult.blocked) return tokenResult.response

  const ipResult = await runLimit(
    limiters.ipLimiter,
    ip,
    'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.'
  )
  if (ipResult.blocked) return ipResult.response

  return null
}

// For session-auth endpoints: checks per-user limits.
export async function checkUserLimitProcessSteps(userId: string): Promise<NextResponse | null> {
  const limiters = getLimiters()
  if (!limiters) return null

  const result = await runLimit(
    limiters.processStepsLimiter,
    userId,
    'Rate limit exceeded. Try again later.'
  )
  return result.blocked ? result.response : null
}

export async function checkUserLimitUseCases(userId: string): Promise<NextResponse | null> {
  const limiters = getLimiters()
  if (!limiters) return null

  const result = await runLimit(
    limiters.useCasesLimiter,
    userId,
    'Rate limit exceeded. Try again later.'
  )
  return result.blocked ? result.response : null
}
