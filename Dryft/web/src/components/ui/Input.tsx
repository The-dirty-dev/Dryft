import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

export default function Input({ className, ...props }: InputProps) {
  return <input className={classes('input', className)} {...props} />;
}
