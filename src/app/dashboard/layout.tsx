import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { logout } from '@/app/auth/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspaceName = (user.user_metadata?.workspace_name as string | undefined) ?? 'My Workspace'

  return (
    <div className="flex h-screen">
      <aside className="w-[240px] bg-[#0F0F11] flex flex-col flex-shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="text-[11px] text-white/40 uppercase tracking-widest font-medium mb-1">
            Workspace
          </p>
          <p className="text-[14px] text-white font-semibold truncate">{workspaceName}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-2 py-2 text-[13px] text-white/60 hover:text-white rounded-[4px] hover:bg-white/5 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/process-steps"
            className="flex items-center gap-2 px-2 py-2 text-[13px] text-white/60 hover:text-white rounded-[4px] hover:bg-white/5 transition-colors"
          >
            Prozessschritte
          </Link>
          <Link
            href="/dashboard/use-cases"
            className="flex items-center gap-2 px-2 py-2 text-[13px] text-white/60 hover:text-white rounded-[4px] hover:bg-white/5 transition-colors"
          >
            KI Use Cases
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-2 py-2 text-[14px] text-white/50 hover:text-white rounded-[4px] hover:bg-white/5 transition-colors"
            >
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 bg-[#FAFAFA] overflow-auto">
        {children}
      </main>
    </div>
  )
}
