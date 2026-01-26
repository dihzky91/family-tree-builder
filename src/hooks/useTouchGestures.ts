import { useEffect, RefObject } from 'react';
import * as d3 from 'd3';

interface TouchGestureOptions {
    onPinchZoom?: (scale: number) => void;
    onPan?: (dx: number, dy: number) => void;
    onDoubleTap?: (x: number, y: number) => void;
    minScale?: number;
    maxScale?: number;
}

export function useTouchGestures(
    svgRef: RefObject<SVGSVGElement>,
    options: TouchGestureOptions = {}
) {
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const {
            onPinchZoom,
            onPan,
            onDoubleTap,
            minScale = 0.3,
            maxScale = 3,
        } = options;

        // Touch state
        let initialDistance = 0;
        let initialScale = 1;
        let lastTap = 0;
        let touchStartTime = 0;

        // Get distance between two touch points
        function getTouchDistance(touches: TouchList): number {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        // Get center point between two touches
        function getTouchCenter(touches: TouchList): { x: number; y: number } {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2,
            };
        }

        function handleTouchStart(event: TouchEvent) {
            touchStartTime = Date.now();

            if (event.touches.length === 2) {
                // Pinch gesture
                event.preventDefault();
                initialDistance = getTouchDistance(event.touches);
                initialScale = 1; // Get current scale from zoom transform
            } else if (event.touches.length === 1) {
                // Check for double tap
                const now = Date.now();
                const timeSinceLastTap = now - lastTap;

                if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
                    // Double tap detected
                    event.preventDefault();
                    const touch = event.touches[0];
                    onDoubleTap?.(touch.clientX, touch.clientY);
                }
                lastTap = now;
            }
        }

        function handleTouchMove(event: TouchEvent) {
            if (event.touches.length === 2 && onPinchZoom) {
                // Pinch zoom
                event.preventDefault();
                const currentDistance = getTouchDistance(event.touches);
                const scale = currentDistance / initialDistance;
                const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
                onPinchZoom(clampedScale);
            } else if (event.touches.length === 2 && onPan) {
                // Two-finger pan
                event.preventDefault();
                const center = getTouchCenter(event.touches);
                // Calculate pan based on movement (simplified)
                onPan(center.x, center.y);
            }
        }

        function handleTouchEnd(event: TouchEvent) {
            if (event.touches.length === 0) {
                initialDistance = 0;
            }
        }

        const element = svgRef.current;
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [svgRef, options]);
}

// Simpler version that integrates with D3 zoom
export function useD3TouchZoom(
    svgRef: RefObject<SVGSVGElement>,
    minScale: number = 0.3,
    maxScale: number = 3
) {
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);

        // D3 zoom already handles touch gestures well, 
        // just ensure it's properly configured
        const zoom = d3.zoom()
            .scaleExtent([minScale, maxScale])
            .on('zoom', (event) => {
                svg.select('g').attr('transform', event.transform);
            });

        // Apply zoom with touch support
        svg.call(zoom as any);

        // Prevent default touch behaviors that interfere
        function preventGestures(e: Event) {
            e.preventDefault();
        }

        const element = svgRef.current;
        element.addEventListener('gesturestart', preventGestures);
        element.addEventListener('gesturechange', preventGestures);

        return () => {
            element.removeEventListener('gesturestart', preventGestures);
            element.removeEventListener('gesturechange', preventGestures);
        };
    }, [svgRef, minScale, maxScale]);
}
