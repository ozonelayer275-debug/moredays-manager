import { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import BottomNav from './BottomNav'

interface Props {
  title: string
  children: ReactNode
  action?: ReactNode
}

export default function AppShell({ title, children, action }: Props) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
