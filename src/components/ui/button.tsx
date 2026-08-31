import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // §31 — the accent is reserved for the single primary action.
        primary: 'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80',
        secondary:
          'bg-elevated text-fg border border-border hover:bg-elevated/70',
        ghost: 'text-fg-muted hover:bg-elevated hover:text-fg',
        danger: 'bg-danger text-white hover:bg-danger/90',
        outline:
          'border border-border bg-transparent text-fg hover:bg-elevated',
      },
      size: {
        // §32 — 44px minimum touch target on every interactive control.
        default: 'h-11 px-4 py-2',
        sm: 'h-11 px-3 text-[13px]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
        full: 'h-12 w-full px-4 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
