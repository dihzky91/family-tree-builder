import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

/**
 * Skeleton for stats cards in Dashboard
 */
export function StatsCardSkeleton() {
    return (
        <Card className="p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
            </div>
        </Card>
    );
}

/**
 * Grid of StatsCard skeletons
 */
export function StatsCardSkeletonGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, i) => (
                <StatsCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Skeleton for large stat card with more details
 */
export function LargeStatsCardSkeleton() {
    return (
        <Card className="p-6">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                </div>

                {/* Main stat */}
                <Skeleton className="h-12 w-24" />

                {/* Progress bar */}
                <div className="space-y-2">
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                </div>

                {/* List items */}
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-4 w-8" />
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
