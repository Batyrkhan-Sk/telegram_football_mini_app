'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

const TITLES = ['Мазасыз', 'Душнила', 'Ұмытшақ', 'В тильте', 'Не в теме']
const STORAGE_KEY = 'kairat-snickers-title'

export function SnickersTitleSelector({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState(TITLES[0])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && TITLES.includes(saved)) setSelected(saved)
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

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 font-display font-800 uppercase text-brand ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
        }`}
      >
        <span>{selected}</span>
        <ChevronDown size={compact ? 11 : 13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/12 bg-surface-1 shadow-2xl">
          {TITLES.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => chooseTitle(title)}
              className="flex w-full items-center justify-between px-3 py-2 text-left font-display text-xs font-800 uppercase text-white hover:bg-white/8"
            >
              {title}
              {selected === title && <Check size={13} className="text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
