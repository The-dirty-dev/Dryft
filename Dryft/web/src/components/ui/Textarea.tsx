import { forwardRef, type TextareaHTMLAttributes } from 'react';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={classes('input min-h-[120px] resize-y', className)}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
