import type { FC, ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  isLoading?: boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  children:   ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-lol-accent text-lol-bg font-bold hover:brightness-110 border border-lol-accent ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-transparent text-lol-accent border border-lol-accent hover:bg-lol-accent/10 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-lol-text-body border border-transparent hover:border-lol-border ' +
    'hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-lol-error/20 text-lol-error border border-lol-error/50 hover:bg-lol-error/30 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2   text-base rounded-xl',
  lg: 'px-6 py-3   text-lg rounded-xl',
}

export const Button: FC<Props> = ({
  variant  = 'primary',
  size     = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const isDisabled = disabled || isLoading

  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 font-display transition-all duration-200',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        // ローディングスピナー（インライン）
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        leftIcon && <span aria-hidden="true">{leftIcon}</span>
      )}

      <span>{children}</span>

      {!isLoading && rightIcon && (
        <span aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  )
}
