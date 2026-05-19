import { redirect } from 'next/navigation'

// Middleware handles auth-based redirect (authenticated → /dashboard).
// This server-side redirect is a safety net for unauthenticated access.
export default function RootPage() {
  redirect('/login')
}
