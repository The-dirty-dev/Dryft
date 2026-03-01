import type { TextareaHTMLAttributes } from 'react';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

export default function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={classes('input min-h-[120px] resize-y', className)}
      {...props}
    />
  );
}
