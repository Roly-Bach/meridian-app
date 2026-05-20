'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, GitBranch, Lightbulb } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Interviews', Icon: MessageSquare },
  { href: '/dashboard/process-steps', label: 'Prozessschritte', Icon: GitBranch },
  { href: '/dashboard/use-cases', label: 'KI Use Cases', Icon: Lightbulb },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-4">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-[4px] text-[14px] transition-colors ${
              active
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon
              className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#E040FB]' : ''}`}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
