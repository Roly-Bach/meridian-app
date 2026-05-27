'use client'

import { use, useEffect, useState } from 'react'
import { ChatErrorScreen } from '@/components/interview/ChatErrorScreen'
import { ChatCompletedScreen } from '@/components/interview/ChatCompletedScreen'
import { ChatInterface } from '@/components/interview/ChatInterface'

type Interview = {
  id: string
  employee_name: string
  status: 'created' | 'active' | 'completed'
  token_expires_at: string
  max_duration_minutes: number
}

type Turn = {
  id: string
  turn_number: number
  user_input: string
  agent_response: string
  created_at: string
}

type ActiveStatus = 'created' | 'active'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; type: 'not_found' | 'expired' }
  | { status: 'completed' }
  | { status: 'ready'; interview: Interview & { status: ActiveStatus }; turns: Turn[]; openerText: string | null }

export default function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    fetch(`/api/interview/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setPageState({ status: 'error', type: 'not_found' })
          return
        }
        if (res.status === 410) {
          setPageState({ status: 'error', type: 'expired' })
          return
        }
        const data = await res.json() as { interview: Interview; turns: Turn[]; openerText?: string | null }
        if (data.interview.status === 'completed') {
          setPageState({ status: 'completed' })
        } else {
          setPageState({
            status: 'ready',
            interview: data.interview as Interview & { status: ActiveStatus },
            turns: data.turns ?? [],
            openerText: data.openerText ?? null,
          })
        }
      })
      .catch(() => setPageState({ status: 'error', type: 'not_found' }))
  }, [token])

  if (pageState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#E040FB] border-t-transparent animate-spin" />
          <p className="text-[14px] text-[#6B7280]">Wird geladen…</p>
        </div>
      </div>
    )
  }

  if (pageState.status === 'error') {
    return <ChatErrorScreen type={pageState.type} />
  }

  if (pageState.status === 'completed') {
    return <ChatCompletedScreen />
  }

  return (
    <ChatInterface
      token={token}
      employeeName={pageState.interview.employee_name}
      existingTurns={pageState.turns}
      openerText={pageState.openerText}
      status={pageState.interview.status}
      onCompleted={() => setPageState({ status: 'completed' })}
    />
  )
}
