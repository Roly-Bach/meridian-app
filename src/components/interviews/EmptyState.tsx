import { Button } from '@/components/ui/button'
import { MessageSquarePlus } from 'lucide-react'

export function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F3E5FF] flex items-center justify-center mb-4">
        <MessageSquarePlus className="h-5 w-5 text-[#E040FB]" />
      </div>
      <p className="text-[14px] font-semibold text-[#111111] mb-1">Noch keine Interviews</p>
      <p className="text-[14px] text-[#6B7280] mb-6 max-w-[320px]">
        Legen Sie das erste Interview an und teilen Sie den Link mit dem Mitarbeiter.
      </p>
      <Button
        onClick={onNew}
        className="bg-[#E040FB] hover:bg-[#AA00FF] text-white text-[14px] rounded-[6px]"
      >
        Erstes Interview anlegen
      </Button>
    </div>
  )
}
