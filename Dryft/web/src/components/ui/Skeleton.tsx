import { classNames } from '@/utils';

export interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return <div className={classNames('animate-pulse rounded-lg bg-border', className)} />;
}
