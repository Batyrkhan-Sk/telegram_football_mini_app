'use client'

import { cn } from '@/lib/utils'

interface XpBarProps {
  current: number
  needed: number
  pct: number
  level: number
}

export function XpBar({ current, needed, pct, level }: XpBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-display text-gray-400 uppercase tracking-wider">
          Level {level}
        </span>
        <span className="text-[10px] font-display text-gray-400">
          {Math.round(current)} / {Math.round(needed)} XP
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface StatBarProps {
  label: string
  value: number
  max?: number
  color?: string
}

export function StatBar({ label, value, max = 99, color = '#F5C518' }: StatBarProps) {
  const pct = (value / max) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-display uppercase text-gray-400 w-8 text-right flex-shrink-0">
        {label.slice(0, 3)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-display font-700 w-6 text-right" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-white/5',
        className
      )}
    />
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'brand' | 'red' | 'gray' | 'green'
}

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  const variants = {
    brand: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    gray: 'bg-white/10 text-gray-300 border-white/10',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-display font-700 uppercase tracking-wider border', variants[variant])}>
      {children}
    </span>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="font-display font-800 text-xl uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="border-2 border-white/20 border-t-brand rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  )
}
