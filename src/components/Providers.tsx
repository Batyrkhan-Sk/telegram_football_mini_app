'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useUserStore } from '@/store'
import { getTelegramUser, expandApp } from '@/lib/telegram'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function UserInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useUserStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    expandApp()

    const tgUser = getTelegramUser()
    if (!tgUser) {
      setLoading(false)
      return
    }

    fetch('/api/user/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId: String(tgUser.id),
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        avatarUrl: tgUser.photo_url,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setUser(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [setUser, setLoading])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <UserInitializer>{children}</UserInitializer>
    </QueryClientProvider>
  )
}
