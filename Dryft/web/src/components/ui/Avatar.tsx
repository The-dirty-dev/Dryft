import Image from 'next/image';
import { classNames } from '@/utils';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: number;
  fallback?: string;
  className?: string;
}

export default function Avatar({
  src,
  alt = 'Avatar',
  size = 40,
  fallback,
  className,
}: AvatarProps) {
  const initials = fallback?.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={classNames(
        'relative inline-flex items-center justify-center rounded-full bg-border text-white overflow-hidden',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="rounded-full object-cover"
        />
      ) : (
        <span className="text-sm font-semibold">{initials}</span>
      )}
    </div>
  );
}
