import Image from 'next/image';
import Link from 'next/link';
import { classNames } from '@/utils';

export interface LogoProps {
  /** Show just the icon (no text). Default: false */
  iconOnly?: boolean;
  /** Pixel size of the icon. Default: 32 */
  size?: number;
  /** Additional classes for the outer wrapper */
  className?: string;
  /** Wrap in a Link to '/'. Default: true */
  linked?: boolean;
}

export default function Logo({
  iconOnly = false,
  size = 32,
  className,
  linked = true,
}: LogoProps) {
  const inner = (
    <span className={classNames('inline-flex items-center gap-2', className)}>
      <Image
        src="/logo-48.png"
        alt="Dryft"
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />
      {!iconOnly && (
        <span className="text-2xl font-bold text-primary tracking-tight">
          Dryft
        </span>
      )}
    </span>
  );

  if (linked) {
    return <Link href="/">{inner}</Link>;
  }

  return inner;
}
