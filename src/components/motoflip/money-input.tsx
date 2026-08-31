'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const QUICK_ADD = [
  { label: '+50rb', value: 50_000 },
  { label: '+100rb', value: 100_000 },
  { label: '+500rb', value: 500_000 },
  { label: '+1jt', value: 1_000_000 },
] as const

const grouper = new Intl.NumberFormat('id-ID')

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

export interface MoneyInputProps {
  name: string
  defaultValue?: string | number | bigint | null
  required?: boolean
  id?: string
  placeholder?: string
  className?: string
  /** Show the +50rb/+100rb chips. Off for large one-off figures. */
  quickAdd?: boolean
  'aria-describedby'?: string
}

/**
 * Rupiah amount entry — §11.
 *
 * Displays live id-ID grouping ("22.000.000") while posting a normalised digit
 * string, so the server never has to unpick a formatted number. Uses a numeric
 * keypad on mobile, and offers quick-add chips because most workshop expenses
 * are round thousands.
 */
export function MoneyInput({
  name,
  defaultValue,
  required,
  id,
  placeholder = '0',
  className,
  quickAdd = true,
  ...aria
}: MoneyInputProps) {
  const initial =
    defaultValue === null || defaultValue === undefined || defaultValue === ''
      ? ''
      : digitsOnly(String(defaultValue))

  const [raw, setRaw] = React.useState(initial)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const display = raw === '' ? '' : grouper.format(BigInt(raw))

  const bump = (amount: number) => {
    const current = raw === '' ? 0n : BigInt(raw)
    setRaw((current + BigInt(amount)).toString())
    inputRef.current?.focus()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-fg-subtle"
        >
          Rp
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          placeholder={placeholder}
          value={display}
          onChange={(event) => setRaw(digitsOnly(event.target.value))}
          className={cn(
            'tabular flex h-14 w-full rounded-md border border-border bg-input pl-10 pr-3',
            'text-right text-2xl font-bold text-fg',
            'placeholder:font-normal placeholder:text-fg-subtle',
            'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          )}
          {...aria}
        />
        {/* The value the form actually submits: digits, no separators. */}
        <input type="hidden" name={name} value={raw} />
      </div>

      {quickAdd && (
        <div className="flex gap-2">
          {QUICK_ADD.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => bump(chip.value)}
              className="h-11 flex-1 rounded-md border border-border bg-elevated text-[13px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-fg active:bg-accent/10"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
