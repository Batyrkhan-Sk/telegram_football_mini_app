'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

const TITLES = [
  { label: 'Мазасыз', icon: '⚡' },
  { label: 'Душнила', icon: '🧠' },
  { label: 'Ұмытшақ', icon: '🌀' },
  { label: 'В тильте', icon: '🔥' },
  { label: 'Не в теме', icon: '❔' },
]

const STORAGE_KEY = 'kairat-snickers-title'

export function SnickersTitleSelector({
  compact = false,
  editable = true,
}: {
  compact?: boolean
  editable?: boolean
}) {
  const [selected, setSelected] = useState(TITLES[0].label)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && TITLES.some((title) => title.label === saved)) setSelected(saved)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const chooseTitle = (title: string) => {
    setSelected(title)
    window.localStorage.setItem(STORAGE_KEY, title)
    setOpen(false)
  }

  const selectedTitle = TITLES.find((title) => title.label === selected) ?? TITLES[0]

  return (
    <div ref={rootRef} className="relative z-[80] inline-flex">
      <button
        type="button"
        onClick={() => editable && setOpen((current) => !current)}
        className={`inline-flex items-center gap-1.5 rounded-md border border-brand/50 bg-black/40 font-display font-800 uppercase text-brand shadow-[0_0_0_1px_rgba(245,197,24,0.08)] ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
        }`}
      >
        <span aria-hidden="true">{selectedTitle.icon}</span>
        <span>{selectedTitle.label}</span>
        {editable && (
          <ChevronDown
            size={compact ? 11 : 13}
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        )}
      </button>

      {editable && open && (
        <div className="absolute left-1/2 top-full z-[9999] mt-2 max-h-64 w-48 -translate-x-1/2 overflow-y-auto rounded-xl border border-white/20 bg-surface-0 shadow-2xl">
          {TITLES.map((title) => (
            <button
              key={title.label}
              type="button"
              onClick={() => chooseTitle(title.label)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left font-display text-xs font-800 uppercase text-white hover:bg-white/8"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true">{title.icon}</span>
                <span className="truncate">{title.label}</span>
              </span>
              {selected === title.label && <Check size={13} className="shrink-0 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
