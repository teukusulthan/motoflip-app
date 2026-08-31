import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // 16px font size prevents iOS Safari from zooming on focus — §32.
        'flex h-12 w-full rounded-md border border-border bg-input px-3 text-base text-fg',
        'placeholder:text-fg-subtle',
        'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
