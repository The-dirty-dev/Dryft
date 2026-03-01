import type { ReactNode } from 'react';
import Link from 'next/link';

export interface CardProps {
  children: ReactNode;
  className?: string;
  href?: string;
}

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

export default function Card({ children, className, href }: CardProps) {
  const cardClassName = classes('card', className);

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {children}
      </Link>
    );
  }

  return <div className={cardClassName}>{children}</div>;
}
