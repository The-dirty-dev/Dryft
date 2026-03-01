import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

export default function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'secondary' ? 'btn-secondary' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
  return <button className={classes(variantClass, className)} {...props} />;
}
