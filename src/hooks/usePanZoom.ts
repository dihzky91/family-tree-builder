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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left mouse button and when not clicking on interactive elements
    if (e.button !== 0) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - state.x,
      y: e.clientY - state.y,
    };
  }, [state.x, state.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setState(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers for mobile support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start drag if touching interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;
    
    // Only handle single touch
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - state.x,
      y: touch.clientY - state.y,
    };
  }, [state.x, state.y]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    if (e.touches.length !== 1) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.touches[0];
    
    setState(prev => ({
      ...prev,
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    }));
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only zoom if Ctrl/Cmd is pressed
    if (!e.ctrlKey && !e.metaKey) return;
    
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    
    setState(prev => ({
      ...prev,
      scale: Math.max(minScale, Math.min(maxScale, prev.scale * delta)),
    }));
  }, [minScale, maxScale]);

  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.min(maxScale, prev.scale * 1.2),
    }));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.max(minScale, prev.scale / 1.2),
    }));
  }, [minScale]);

  const reset = useCallback(() => {
    setState({ x: 0, y: 0, scale: initialScale });
  }, [initialScale]);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setState(prev => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  }, []);

  const setScale = useCallback((newScale: number) => {
    setState(prev => ({
      ...prev,
      scale: Math.max(minScale, Math.min(maxScale, newScale)),
    }));
  }, [minScale, maxScale]);

  const setTransform = useCallback((next: PanZoomState) => {
    setState({
      x: next.x,
      y: next.y,
      scale: Math.max(minScale, Math.min(maxScale, next.scale)),
    });
  }, [minScale, maxScale]);

  // Add global mouse/touch up listeners to handle drag end outside container
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, []);

  useEffect(() => {
    setState(prev => {
      const clampedScale = Math.max(minScale, Math.min(maxScale, prev.scale));
      if (clampedScale === prev.scale) return prev;
      return { ...prev, scale: clampedScale };
    });
  }, [minScale, maxScale]);

  return {
    state,
    isDragging,
    containerRef,
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
