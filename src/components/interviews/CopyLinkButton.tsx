'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check } from 'lucide-react'

export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleCopy() {
    const url = `${window.location.origin}/interview/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setFallbackUrl(url)
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 px-2 text-[12px] text-[#6B7280] hover:text-[#111111]"
      >
        {copied ? (
          <><Check className="h-3 w-3 mr-1 text-[#10B981]" />Kopiert!</>
        ) : (
          <><Copy className="h-3 w-3 mr-1" />Link kopieren</>
        )}
      </Button>
      {fallbackUrl && (
        <Input
          ref={inputRef}
          value={fallbackUrl}
          readOnly
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="h-6 text-[11px] font-mono text-[#6B7280] border-[#E5E5E5] rounded-[4px] w-64"
        />
      )}
    </div>
  )
}
