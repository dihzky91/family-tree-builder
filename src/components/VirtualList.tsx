import React, { useRef, useEffect, useState, CSSProperties } from 'react';

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    overscan?: number; // Number of items to render outside visible area
    className?: string;
}

/**
 * Virtual scrolling list component
 * Only renders visible items for better performance with large lists
 */
export function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 3,
    className = ''
}: VirtualListProps<T>) {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate visible range
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className={className}
            style={{
                height: containerHeight,
                overflow: 'auto',
                position: 'relative'
            }}
        >
            {/* Spacer to maintain scroll height */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Visible items container */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${offsetY}px)`
                    }}
                >
                    {visibleItems.map((item, index) => (
                        <div
                            key={startIndex + index}
                            style={{ height: itemHeight }}
                        >
                            {renderItem(item, startIndex + index)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Hook for simple pagination
 */
export function usePagination<T>(items: T[], itemsPerPage: number = 10) {
    const [currentPage, setCurrentPage] = useState(0);

    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);

    const visibleItems = items.slice(startIndex, endIndex);
    const hasMore = currentPage < totalPages - 1;
    const hasPrev = currentPage > 0;

    const nextPage = () => {
        if (hasMore) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const prevPage = () => {
        if (hasPrev) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    };

    const reset = () => {
        setCurrentPage(0);
    };

    return {
        visibleItems,
        hasMore,
        hasPrev,
        nextPage,
        prevPage,
        reset,
        currentPage,
        totalPages,
        goToPage,
        startIndex: startIndex + 1, // 1-indexed for display
        endIndex,
        totalItems: items.length
    };
}
