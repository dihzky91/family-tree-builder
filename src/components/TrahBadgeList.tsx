import type { TrahCluster } from '@/lib/lineageScope';
import { cn } from '@/lib/utils';

interface TrahBadgeListProps {
  clusters?: TrahCluster[];
  /** 'pill' for cards/tables, 'compact' for PersonPicker dropdown items */
  variant?: 'pill' | 'compact';
  maxVisible?: number;
  className?: string;
}

export function TrahBadgeList({
  clusters,
  variant = 'pill',
  maxVisible = 2,
  className,
}: TrahBadgeListProps) {
  if (!clusters || clusters.length === 0) return null;

  const visible = clusters.slice(0, maxVisible);
  const overflow = clusters.slice(maxVisible);

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1', className)}>
        {visible.map((cluster) => (
          <span
            key={cluster.id}
            title={
              cluster.relativeLabel
                ? `${cluster.name} (${cluster.relativeLabel})`
                : cluster.name
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 max-w-[140px]',
              cluster.badgeClass
            )}
          >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cluster.dotClass)} />
            <span className="truncate">{cluster.name}</span>
          </span>
        ))}
        {overflow.length > 0 && (
          <span
            title={overflow.map((c) => c.name).join(', ')}
            className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 px-1.5 py-0 text-[10px] font-medium leading-4 text-muted-foreground"
          >
            {overflow.map((c) => (
              <span key={c.id} className={cn('h-1.5 w-1.5 rounded-full', c.dotClass)} />
            ))}
            <span>+{overflow.length}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((cluster) => (
        <span
          key={cluster.id}
          title={
            cluster.relativeLabel
              ? `${cluster.name} (${cluster.relativeLabel})`
              : cluster.name
          }
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none max-w-[165px]',
            cluster.badgeClass
          )}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cluster.dotClass)} />
          <span className="truncate">{cluster.name}</span>
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          title={overflow
            .map((c) =>
              c.relativeLabel ? `${c.name} (${c.relativeLabel})` : c.name
            )
            .join(' • ')}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
        >
          <span className="inline-flex items-center gap-0.5">
            {overflow.map((c) => (
              <span key={c.id} className={cn('h-1.5 w-1.5 rounded-full', c.dotClass)} />
            ))}
          </span>
          <span>+{overflow.length}</span>
        </span>
      )}
    </div>
  );
}
