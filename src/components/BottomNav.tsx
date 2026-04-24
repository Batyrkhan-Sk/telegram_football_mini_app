'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, Swords, Trophy, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/cards', icon: LayoutGrid, label: 'Cards' },
  { href: '/battle', icon: Swords, label: 'Battle' },
  { href: '/leaderboard', icon: Trophy, label: 'Board' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200',
                active
                  ? 'text-brand'
                  : 'text-gray-500 active:text-gray-300'
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={cn('transition-transform duration-200', active && 'scale-110')}
              />
              <span className={cn('text-[10px] font-display font-700 tracking-wide uppercase', active ? 'text-brand' : 'text-gray-500')}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-brand" style={{ bottom: '6px' }} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
