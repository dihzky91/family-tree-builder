import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

/**
 * Skeleton for PersonCard in PeoplePage
 * Matches the layout of actual PersonCard
 */
export function PersonCardSkeleton() {
    return (
        <Card className="p-4">
            <div className="flex items-start gap-4">
                {/* Avatar skeleton */}
                <Skeleton className="w-14 h-14 rounded-full shrink-0" />

                {/* Content skeleton */}
                <div className="flex-1 min-w-0 space-y-3">
                    {/* Name */}
                    <Skeleton className="h-5 w-32" />

                    {/* Date */}
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-28" />
                    </div>

                    {/* Tags */}
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                    </div>

                    {/* Confidence bar */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-1.5 flex-1 rounded-full" />
                            <Skeleton className="h-3 w-8" />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </div>

            {/* Notes preview skeleton */}
            <div className="mt-3 pt-3 border-t space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
            </div>
        </Card>
    );
}

/**
 * Grid of PersonCard skeletons
 */
export function PersonCardSkeletonGrid({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <PersonCardSkeleton key={i} />
            ))}
        </div>
    );
}
