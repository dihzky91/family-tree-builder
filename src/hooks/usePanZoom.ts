import { useState, useCallback, useRef, useEffect } from 'react';

interface PanZoomState {
  x: number;
  y: number;
  scale: number;
}

interface UsePanZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
}

interface ApplyTransformOptions {
  commit?: boolean;
  transition?: string;
}

const DEFAULT_TRANSITION = 'transform 0.1s ease-out';

export function usePanZoom(options: UsePanZoomOptions = {}) {
  const { minScale = 0.3, maxScale = 2, initialScale = 1 } = options;

  const [state, setState] = useState<PanZoomState>({
    x: 0,
    y: 0,
    scale: initialScale,
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<PanZoomState>({ x: 0, y: 0, scale: initialScale });
  const frameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<PanZoomState | null>(null);

  const clampScale = useCallback(
    (scale: number) => Math.max(minScale, Math.min(maxScale, scale)),
    [minScale, maxScale]
  );

  const applyDomTransform = useCallback((next: PanZoomState, transition: string) => {
    const element = contentRef.current;
    if (!element) return;

    element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
    element.style.transformOrigin = 'center center';
    element.style.transition = transition;
    element.style.willChange = 'transform';
  }, []);

  const commitState = useCallback((next: PanZoomState) => {
    setState((prev) => {
      if (prev.x === next.x && prev.y === next.y && prev.scale === next.scale) {
        return prev;
      }
      return next;
    });
  }, []);

  const flushPendingTransform = useCallback(() => {
    frameRef.current = null;
    const pending = pendingTransformRef.current;
    if (!pending) return;

    pendingTransformRef.current = null;
    stateRef.current = pending;
    applyDomTransform(pending, 'none');
  }, [applyDomTransform]);

  const scheduleDragTransform = useCallback(
    (next: PanZoomState) => {
      pendingTransformRef.current = next;
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(flushPendingTransform);
    },
    [flushPendingTransform]
  );

  const applyTransform = useCallback(
    (next: PanZoomState, options?: ApplyTransformOptions) => {
      const normalized = {
        x: next.x,
        y: next.y,
        scale: clampScale(next.scale),
      };

      stateRef.current = normalized;
      applyDomTransform(normalized, options?.transition ?? DEFAULT_TRANSITION);

      if (options?.commit !== false) {
        commitState(normalized);
      }

      return normalized;
    },
    [applyDomTransform, clampScale, commitState]
  );

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (!node) return;

      applyDomTransform(stateRef.current, isDragging ? 'none' : DEFAULT_TRANSITION);
    },
    [applyDomTransform, isDragging]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;

    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - stateRef.current.x,
      y: e.clientY - stateRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      scheduleDragTransform({
        ...stateRef.current,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [isDragging, scheduleDragTransform]
  );

  const finishDrag = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (pendingTransformRef.current) {
      const pending = pendingTransformRef.current;
      pendingTransformRef.current = null;
      applyTransform(pending, { transition: 'none' });
    } else {
      applyDomTransform(stateRef.current, DEFAULT_TRANSITION);
      commitState(stateRef.current);
    }

    setIsDragging(false);
  }, [applyDomTransform, applyTransform, commitState]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    finishDrag();
  }, [finishDrag, isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) return;
    finishDrag();
  }, [finishDrag, isDragging]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - stateRef.current.x,
      y: touch.clientY - stateRef.current.y,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      if (e.cancelable) {
        e.preventDefault();
      }

      const touch = e.touches[0];
      scheduleDragTransform({
        ...stateRef.current,
        x: touch.clientX - dragStart.current.x,
        y: touch.clientY - dragStart.current.y,
      });
    },
    [isDragging, scheduleDragTransform]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    finishDrag();
  }, [finishDrag, isDragging]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      applyTransform({
        ...stateRef.current,
        scale: stateRef.current.scale * delta,
      });
    },
    [applyTransform]
  );

  const zoomIn = useCallback(() => {
    applyTransform({
      ...stateRef.current,
      scale: stateRef.current.scale * 1.2,
    });
  }, [applyTransform]);

  const zoomOut = useCallback(() => {
    applyTransform({
      ...stateRef.current,
      scale: stateRef.current.scale / 1.2,
    });
  }, [applyTransform]);

  const reset = useCallback(() => {
    applyTransform({ x: 0, y: 0, scale: initialScale });
  }, [applyTransform, initialScale]);

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      applyTransform({
        ...stateRef.current,
        x: stateRef.current.x + deltaX,
        y: stateRef.current.y + deltaY,
      });
    },
    [applyTransform]
  );

  const setScale = useCallback(
    (newScale: number) => {
      applyTransform({
        ...stateRef.current,
        scale: newScale,
      });
    },
    [applyTransform]
  );

  const setTransform = useCallback(
    (next: PanZoomState) => {
      applyTransform(next);
    },
    [applyTransform]
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!isDragging) return;
      finishDrag();
    };

    const handleGlobalTouchEnd = () => {
      if (!isDragging) return;
      finishDrag();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [finishDrag, isDragging]);

  useEffect(() => {
    const clampedScale = clampScale(stateRef.current.scale);
    if (clampedScale !== stateRef.current.scale) {
      applyTransform({ ...stateRef.current, scale: clampedScale });
      return;
    }

    applyDomTransform(stateRef.current, isDragging ? 'none' : DEFAULT_TRANSITION);
  }, [applyDomTransform, applyTransform, clampScale, isDragging]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    state,
    isDragging,
    containerRef,
    setContentRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onWheel: handleWheel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    zoomIn,
    zoomOut,
    reset,
    setScale,
    setTransform,
    panBy,
  };
}
