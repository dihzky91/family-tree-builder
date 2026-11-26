import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  Crosshair,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatShortYearLabel, getEstimatedYear } from '@/lib/flexibleDateUtils';
import { cn } from '@/lib/utils';
import type { Person, Relationship, Gender } from '@/types';

interface TimeLapseGrowthViewProps {
  persons: Person[];
  relationships: Relationship[];
  onSelectPerson?: (personId: string) => void;
  selectedPersonId?: string | null;
}

interface StarNode {
  id: string;
  person: Person;
  initials: string;
  gender: Gender;
  generation: number;
  birthYear: number;
  deathYear: number | null;
  hasExactBirthYear: boolean;
  x: number;
  y: number;
  radius: number;
}

interface StarEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'PARENT_CHILD' | 'SPOUSE';
  appearYear: number;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TimeLapseGrowthView({
  persons,
  relationships,
  onSelectPerson,
  selectedPersonId,
}: TimeLapseGrowthViewProps) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [cosmicMode, setCosmicMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);
  const [hoveredNode, setHoveredNode] = useState<{
    node: StarNode;
    x: number;
    y: number;
  } | null>(null);

  // Camera pan/zoom + 2-finger pinch stored in refs for smooth 60fps
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0, moved: false });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  const isDarkCanvas = cosmicMode || resolvedTheme === 'dark';

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build radial constellation layout + estimated years for all members
  const { nodes, edges, minYear, maxYear, bgStars } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const personMap = new Map(persons.map((p) => [p.id, p]));
    const parentsByChild = new Map<string, string[]>();
    const childrenByParent = new Map<string, string[]>();
    const spousesByPerson = new Map<string, string[]>();

    relationships.forEach((rel) => {
      if (!personMap.has(rel.fromPersonId) || !personMap.has(rel.toPersonId)) return;
      if (rel.type === 'PARENT_CHILD') {
        const pl = parentsByChild.get(rel.toPersonId) || [];
        pl.push(rel.fromPersonId);
        parentsByChild.set(rel.toPersonId, pl);

        const cl = childrenByParent.get(rel.fromPersonId) || [];
        cl.push(rel.toPersonId);
        childrenByParent.set(rel.fromPersonId, cl);
      } else if (rel.type === 'SPOUSE') {
        const s1 = spousesByPerson.get(rel.fromPersonId) || [];
        s1.push(rel.toPersonId);
        spousesByPerson.set(rel.fromPersonId, s1);

        const s2 = spousesByPerson.get(rel.toPersonId) || [];
        s2.push(rel.fromPersonId);
        spousesByPerson.set(rel.toPersonId, s2);
      }
    });

    // Generation calculation
    const genCache = new Map<string, number>();
    const getGen = (id: string, visited = new Set<string>()): number => {
      if (genCache.has(id)) return genCache.get(id)!;
      if (visited.has(id)) return 1;
      const next = new Set(visited);
      next.add(id);
      const parents = parentsByChild.get(id) || [];
      if (parents.length === 0) {
        genCache.set(id, 1);
        return 1;
      }
      const g = Math.max(...parents.map((pid) => getGen(pid, next))) + 1;
      genCache.set(id, g);
      return g;
    };
    persons.forEach((p) => getGen(p.id));

    // Align spouses without parents to partner's generation
    persons.forEach((p) => {
      if ((parentsByChild.get(p.id) || []).length === 0) {
        const spouseGens = (spousesByPerson.get(p.id) || [])
          .filter((sid) => (parentsByChild.get(sid) || []).length > 0)
          .map((sid) => genCache.get(sid) || 1);
        if (spouseGens.length > 0) {
          genCache.set(p.id, Math.max(...spouseGens));
        }
      }
    });

    // Estimate birth years cleanly
    const yearMap = new Map<string, number>();
    const exactYearSet = new Set<string>();
    const genYearSums = new Map<number, { sum: number; count: number }>();

    persons.forEach((p) => {
      const yr = getEstimatedYear(p.birthDate);
      if (yr && yr >= 1700 && yr <= currentYear) {
        yearMap.set(p.id, yr);
        exactYearSet.add(p.id);
        const g = genCache.get(p.id) || 1;
        const entry = genYearSums.get(g) || { sum: 0, count: 0 };
        entry.sum += yr;
        entry.count += 1;
        genYearSums.set(g, entry);
      }
    });

    // Propagate from parents / children / spouses
    for (let iter = 0; iter < 5; iter++) {
      persons.forEach((p) => {
        if (yearMap.has(p.id)) return;
        const pYears = (parentsByChild.get(p.id) || [])
          .map((id) => yearMap.get(id))
          .filter((y): y is number => y != null);
        if (pYears.length > 0) {
          yearMap.set(p.id, Math.min(currentYear, Math.round(Math.max(...pYears) + 27)));
          return;
        }
        const sYears = (spousesByPerson.get(p.id) || [])
          .map((id) => yearMap.get(id))
          .filter((y): y is number => y != null);
        if (sYears.length > 0) {
          yearMap.set(p.id, Math.round(sYears.reduce((a, b) => a + b, 0) / sYears.length));
          return;
        }
        const cYears = (childrenByParent.get(p.id) || [])
          .map((id) => yearMap.get(id))
          .filter((y): y is number => y != null);
        if (cYears.length > 0) {
          yearMap.set(p.id, Math.round(Math.min(...cYears) - 27));
        }
      });
    }

    // Fallback by generation
    const maxGen = Math.max(1, ...Array.from(genCache.values()));
    let anchorYear = currentYear - (maxGen - 1) * 26;
    if (genYearSums.size > 0) {
      const [refGen, refStats] = Array.from(genYearSums.entries())[0];
      anchorYear = Math.round(refStats.sum / refStats.count - (refGen - 1) * 26);
    }

    persons.forEach((p) => {
      if (!yearMap.has(p.id)) {
        const g = genCache.get(p.id) || 1;
        const avg = genYearSums.get(g);
        const est = avg ? Math.round(avg.sum / avg.count) : anchorYear + (g - 1) * 26;
        yearMap.set(p.id, Math.min(currentYear, est));
      }
    });

    // Radial concentric layout grouped by lineage so branches stay together!
    const byGen = new Map<number, Person[]>();
    persons.forEach((p) => {
      const g = genCache.get(p.id) || 1;
      const list = byGen.get(g) || [];
      list.push(p);
      byGen.set(g, list);
    });

    const posMap = new Map<string, { x: number; y: number; angle: number }>();
    const gensSorted = Array.from(byGen.keys()).sort((a, b) => a - b);
    const ringSpacing = 92;

    gensSorted.forEach((gen, gIdx) => {
      const list = byGen.get(gen) || [];
      if (gIdx === 0) {
        const r = list.length <= 2 ? 28 : 48;
        list.forEach((p, idx) => {
          const angle = (idx / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
          posMap.set(p.id, {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            angle,
          });
        });
      } else {
        // Sort members by parent's angle so branches fan out organically without crossing!
        const withIdealAngle = list.map((p) => {
          const parents = parentsByChild.get(p.id) || [];
          const parentAngles = parents
            .map((pid) => posMap.get(pid)?.angle)
            .filter((a): a is number => a != null);
          let idealAngle = 0;
          if (parentAngles.length > 0) {
            const sx = parentAngles.reduce((acc, a) => acc + Math.cos(a), 0);
            const sy = parentAngles.reduce((acc, a) => acc + Math.sin(a), 0);
            idealAngle = Math.atan2(sy, sx);
          } else {
            const spouses = spousesByPerson.get(p.id) || [];
            const spouseAngles = spouses
              .map((sid) => posMap.get(sid)?.angle)
              .filter((a): a is number => a != null);
            if (spouseAngles.length > 0) {
              idealAngle = spouseAngles[0] + 0.05;
            }
          }
          return { p, idealAngle };
        });

        withIdealAngle.sort((a, b) => a.idealAngle - b.idealAngle);

        const radius = 58 + gIdx * ringSpacing;
        withIdealAngle.forEach(({ p }, idx) => {
          const angle = (idx / Math.max(1, withIdealAngle.length)) * Math.PI * 2 - Math.PI / 2;
          // Slight organic jitter so it feels like a living constellation
          const jitter = ((idx % 3) - 1) * 10;
          posMap.set(p.id, {
            x: Math.cos(angle) * (radius + jitter),
            y: Math.sin(angle) * (radius + jitter),
            angle,
          });
        });
      }
    });

    const starNodes: StarNode[] = persons.map((p) => {
      const pos = posMap.get(p.id) || { x: 0, y: 0 };
      const birthYear = yearMap.get(p.id) ?? currentYear;
      const deathYear = getEstimatedYear(p.deathDate);
      const gen = genCache.get(p.id) || 1;
      const deg = (parentsByChild.get(p.id)?.length || 0) + (childrenByParent.get(p.id)?.length || 0);
      return {
        id: p.id,
        person: p,
        initials: getInitials(p.fullName),
        gender: p.gender,
        generation: gen,
        birthYear,
        deathYear,
        hasExactBirthYear: exactYearSet.has(p.id),
        x: pos.x,
        y: pos.y,
        radius: Math.min(11, 5.5 + Math.sqrt(deg) * 1.4),
      };
    });

    const nodeById = new Map(starNodes.map((n) => [n.id, n]));
    const starEdges: StarEdge[] = [];
    relationships.forEach((rel) => {
      const s = nodeById.get(rel.fromPersonId);
      const t = nodeById.get(rel.toPersonId);
      if (!s || !t) return;
      starEdges.push({
        id: rel.id,
        sourceId: rel.fromPersonId,
        targetId: rel.toPersonId,
        type: rel.type,
        appearYear: Math.max(s.birthYear, t.birthYear),
      });
    });

    const years = starNodes.map((n) => n.birthYear);
    const minY = years.length > 0 ? Math.min(...years) : currentYear - 50;
    const maxY = Math.max(currentYear, years.length > 0 ? Math.max(...years) : currentYear);

    // Deterministic background stars for cosmic mode
    const stars = Array.from({ length: 120 }, (_, i) => ({
      x: ((i * 73.13) % 100) / 100,
      y: ((i * 41.79) % 100) / 100,
      r: 0.6 + ((i * 19) % 14) / 10,
      phase: i * 0.7,
    }));

    return {
      nodes: starNodes,
      edges: starEdges,
      minYear: minY,
      maxYear: maxY,
      bgStars: stars,
    };
  }, [persons, relationships]);

  const [currentYearFloat, setCurrentYearFloat] = useState(minYear);
  const currentYearRef = useRef(minYear);

  useEffect(() => {
    currentYearRef.current = minYear;
    setCurrentYearFloat(minYear);
  }, [minYear]);

  // Fit initial camera scale based on graph radius
  const fitCamera = useCallback(() => {
    if (nodes.length === 0) return;
    const maxCoord = Math.max(
      140,
      ...nodes.map((n) => Math.hypot(n.x, n.y) + 40)
    );
    const avail = Math.min(dimensions.width, dimensions.height - 130);
    const fitScale = Math.min(1.3, Math.max(0.32, (avail * 0.45) / maxCoord));
    cameraRef.current = { x: 0, y: 0, scale: fitScale };
  }, [nodes, dimensions]);

  useEffect(() => {
    fitCamera();
  }, [fitCamera]);

  // Live stats at currentYearFloat
  const displayYear = Math.round(currentYearFloat);
  const liveStats = useMemo(() => {
    let born = 0;
    let alive = 0;
    let maxGenActive = 0;
    for (const n of nodes) {
      if (n.birthYear <= displayYear) {
        born++;
        if (!n.deathYear || n.deathYear >= displayYear) alive++;
        if (n.generation > maxGenActive) maxGenActive = n.generation;
      }
    }
    return { born, alive, maxGenActive };
  }, [nodes, displayYear]);

  // Animation loop (playback + canvas render)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    let uiSyncAccum = 0;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlaying) {
        const span = Math.max(10, maxYear - minYear);
        const yearsPerSec = (span / 18) * (speed / 2);
        const nextY = currentYearRef.current + yearsPerSec * dt;
        if (nextY >= maxYear) {
          currentYearRef.current = maxYear;
          setCurrentYearFloat(maxYear);
          setIsPlaying(false);
        } else {
          currentYearRef.current = nextY;
          uiSyncAccum += dt;
          if (uiSyncAccum >= 0.08) {
            uiSyncAccum = 0;
            setCurrentYearFloat(nextY);
          }
        }
      }

      const yearNow = currentYearRef.current;
      const { width, height } = dimensions;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      if (isDarkCanvas) {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.48,
          20,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.8
        );
        grad.addColorStop(0, '#131829');
        grad.addColorStop(0.6, '#0b0f1c');
        grad.addColorStop(1, '#060811');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Twinkling background stars
        for (const s of bgStars) {
          const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.0018 + s.phase));
          ctx.beginPath();
          ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(226, 232, 240, ${twinkle * 0.45})`;
          ctx.fill();
        }
      } else {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.48,
          20,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.8
        );
        grad.addColorStop(0, '#fffdf9');
        grad.addColorStop(1, '#f3ece0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // World transform
      const cam = cameraRef.current;
      ctx.translate(width / 2 + cam.x, height / 2 - 12 + cam.y);
      ctx.scale(cam.scale, cam.scale);

      // Concentric generation orbit guides
      const maxGen = Math.max(1, ...nodes.map((n) => n.generation));
      for (let g = 1; g <= maxGen; g++) {
        const r = g === 1 ? 36 : 58 + (g - 1) * 92;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.lineWidth = 1 / cam.scale;
        ctx.strokeStyle = isDarkCanvas
          ? 'rgba(148, 163, 184, 0.09)'
          : 'rgba(120, 90, 50, 0.1)';
        ctx.stroke();
      }

      // Edges with animated growth + traveling light pulse
      for (const e of edges) {
        if (e.appearYear > yearNow) continue;
        const s = nodeById.get(e.sourceId);
        const t = nodeById.get(e.targetId);
        if (!s || !t) continue;

        const age = yearNow - e.appearYear;
        const growthProgress = Math.min(1, age / 1.8);
        const ex = s.x + (t.x - s.x) * growthProgress;
        const ey = s.y + (t.y - s.y) * growthProgress;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(ex, ey);
        ctx.lineWidth = (e.type === 'SPOUSE' ? 1.3 : 1.15) / Math.sqrt(cam.scale);

        if (e.type === 'SPOUSE') {
          ctx.setLineDash([4 / cam.scale, 3 / cam.scale]);
          ctx.strokeStyle = isDarkCanvas
            ? 'rgba(244, 114, 182, 0.45)'
            : 'rgba(219, 39, 119, 0.4)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = isDarkCanvas
            ? 'rgba(148, 197, 255, 0.28)'
            : 'rgba(120, 92, 54, 0.28)';
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling pulse when newly grown or subtly along parent-child links
        if (growthProgress < 1) {
          ctx.beginPath();
          ctx.arc(ex, ey, 3.2 / Math.sqrt(cam.scale), 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        } else if (e.type === 'PARENT_CHILD' && isDarkCanvas) {
          const pulseT = ((now * 0.00028 + (s.x + t.y) * 0.003) % 1 + 1) % 1;
          if (pulseT < 0.18) {
            const pt = pulseT / 0.18;
            const px = s.x + (t.x - s.x) * pt;
            const py = s.y + (t.y - s.y) * pt;
            ctx.beginPath();
            ctx.arc(px, py, 1.8 / Math.sqrt(cam.scale), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
            ctx.fill();
          }
        }
      }

      // Nodes (blooming stars)
      for (const n of nodes) {
        if (n.birthYear > yearNow) continue;
        const age = yearNow - n.birthYear;
        const bloom = Math.min(1, age / 1.2);
        const isDeceased = Boolean(n.deathYear && n.deathYear <= yearNow);
        const isSelected = n.id === selectedPersonId;
        const isHovered = n.id === hoveredIdRef.current;

        const r = n.radius * (0.4 + 0.6 * bloom) + (isHovered || isSelected ? 2.5 : 0);

        // Birth ripple wave (first 3.5 years)
        if (age < 3.5) {
          const p = age / 3.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + p * 24, 0, Math.PI * 2);
          ctx.lineWidth = 1.5 / cam.scale;
          ctx.strokeStyle =
            n.gender === 'female'
              ? `rgba(244, 114, 182, ${(1 - p) * 0.75})`
              : `rgba(96, 165, 250, ${(1 - p) * 0.75})`;
          ctx.stroke();
        }

        // Ambient star glow
        const starColor = isSelected
          ? '#f59e0b'
          : n.gender === 'male'
            ? '#60a5fa'
            : n.gender === 'female'
              ? '#f472b6'
              : '#a78bfa';

        if (isDarkCanvas) {
          const glowR = r * (isDeceased ? 2.0 : 2.8);
          const glow = ctx.createRadialGradient(n.x, n.y, r * 0.2, n.x, n.y, glowR);
          glow.addColorStop(0, isDeceased ? 'rgba(203, 213, 225, 0.35)' : `${starColor}66`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Core star circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDeceased
          ? isDarkCanvas
            ? '#94a3b8'
            : '#a8a29e'
          : starColor;
        ctx.fill();

        ctx.lineWidth = (isSelected ? 2.4 : 1.2) / Math.sqrt(cam.scale);
        ctx.strokeStyle = isSelected
          ? '#fbbf24'
          : isDarkCanvas
            ? 'rgba(255,255,255,0.85)'
            : '#ffffff';
        ctx.stroke();

        // Name label when zoomed in or hovered/selected
        if (isHovered || isSelected || cam.scale > 1.05) {
          ctx.font = `600 ${Math.max(8, 10 / Math.sqrt(cam.scale))}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = isDarkCanvas ? 'rgba(241, 245, 249, 0.92)' : '#1e293b';
          const shortLabel = n.person.fullName.split(' ').slice(0, 2).join(' ');
          ctx.fillText(shortLabel, n.x, n.y + r + 3);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, nodes, edges, bgStars, isDarkCanvas, isPlaying, speed, minYear, maxYear, selectedPersonId]);

  // Screen to world hit test
  const findNodeAt = useCallback(
    (clientX: number, clientY: number): StarNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const cam = cameraRef.current;
      const wx = (sx - (dimensions.width / 2 + cam.x)) / cam.scale;
      const wy = (sy - (dimensions.height / 2 - 12 + cam.y)) / cam.scale;
      const yearNow = currentYearRef.current;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.birthYear > yearNow) continue;
        const dx = wx - n.x;
        const dy = wy - n.y;
        const hitR = n.radius + 6 / cam.scale;
        if (dx * dx + dy * dy <= hitR * hitR) return n;
      }
      return null;
    },
    [nodes, dimensions]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRef.current = { dist: Math.max(10, dist), scale: cameraRef.current.scale };
      isPanningRef.current = false;
      return;
    }

    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / pinchStartRef.current.dist;
      cameraRef.current.scale = Math.min(3.2, Math.max(0.25, pinchStartRef.current.scale * ratio));
      return;
    }

    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (dx * dx + dy * dy > 16) {
        panStartRef.current.moved = true;
      }
      cameraRef.current.x = panStartRef.current.camX + dx;
      cameraRef.current.y = panStartRef.current.camY + dy;
      return;
    }

    const hit = findNodeAt(e.clientX, e.clientY);
    hoveredIdRef.current = hit ? hit.id : null;
    setHoveredNode(hit ? { node: hit, x: sx, y: sy } : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (isPanningRef.current && activePointersRef.current.size === 0) {
      if (!panStartRef.current.moved) {
        const hit = findNodeAt(e.clientX, e.clientY);
        if (hit) onSelectPerson?.(hit.id);
      }
      isPanningRef.current = false;
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    cameraRef.current.scale = Math.min(3.2, Math.max(0.25, cameraRef.current.scale * factor));
  };

  const handleReplay = () => {
    currentYearRef.current = minYear;
    setCurrentYearFloat(minYear);
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (currentYearRef.current >= maxYear - 0.5) {
      handleReplay();
    } else {
      setIsPlaying((p) => !p);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] sm:min-h-[520px] overflow-hidden select-none rounded-lg border border-border/50"
    >
      {/* Top-Left HUD: Year & Live Counter */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 pointer-events-none flex flex-col gap-1.5">
        <div
          className={cn(
            'px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl backdrop-blur-md border shadow-sm',
            isDarkCanvas
              ? 'bg-slate-950/75 border-slate-700/60 text-slate-100'
              : 'bg-white/85 border-border/70 text-foreground'
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-bold tracking-tight tabular-nums text-amber-500">
              {displayYear}
            </span>
            <span className="text-[11px] sm:text-xs opacity-75">
              {liveStats.born}/{persons.length}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] opacity-75">
            <span>{liveStats.alive} hidup</span>
            <span>•</span>
            <span>{liveStats.maxGenActive} gen</span>
          </div>
        </div>
      </div>

      {/* Top-Right Controls */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 flex items-center gap-1.5">
        <Button
          size={isMobile ? 'icon' : 'sm'}
          variant="outline"
          className={cn(
            'h-8 w-8 sm:w-auto sm:px-2.5 text-xs gap-1.5 backdrop-blur-md',
            isDarkCanvas
              ? 'bg-slate-900/80 border-slate-700 text-slate-100 hover:bg-slate-800'
              : 'bg-background/90'
          )}
          onClick={() => setCosmicMode((v) => !v)}
          title={cosmicMode ? 'Mode Terang' : 'Mode Kosmik'}
        >
          {cosmicMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          {!isMobile && <span>{cosmicMode ? 'Terang' : 'Kosmik'}</span>}
        </Button>
        {!isMobile && (
          <>
            <Button
              size="icon"
              variant="outline"
              className={cn(
                'h-8 w-8 backdrop-blur-md',
                isDarkCanvas
                  ? 'bg-slate-900/80 border-slate-700 text-slate-100 hover:bg-slate-800'
                  : 'bg-background/90'
              )}
              onClick={() => {
                cameraRef.current.scale = Math.min(3.2, cameraRef.current.scale * 1.25);
              }}
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className={cn(
                'h-8 w-8 backdrop-blur-md',
                isDarkCanvas
                  ? 'bg-slate-900/80 border-slate-700 text-slate-100 hover:bg-slate-800'
                  : 'bg-background/90'
              )}
              onClick={() => {
                cameraRef.current.scale = Math.max(0.25, cameraRef.current.scale * 0.8);
              }}
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
        <Button
          size="icon"
          variant="outline"
          className={cn(
            'h-8 w-8 backdrop-blur-md',
            isDarkCanvas
              ? 'bg-slate-900/80 border-slate-700 text-slate-100 hover:bg-slate-800'
              : 'bg-background/90'
          )}
          onClick={fitCamera}
          title="Posisikan Tengah"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          hoveredIdRef.current = null;
          setHoveredNode(null);
        }}
        onWheel={handleWheel}
      />

      {/* Hover Tooltip */}
      {hoveredNode && !isPanningRef.current && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-2 rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-lg backdrop-blur-md text-xs max-w-[230px]"
          style={{
            left: Math.min(dimensions.width - 240, Math.max(12, hoveredNode.x + 16)),
            top: Math.min(dimensions.height - 110, Math.max(60, hoveredNode.y - 12)),
          }}
        >
          <div className="font-semibold text-sm leading-tight truncate">
            {hoveredNode.node.person.fullName}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Gen {hoveredNode.node.generation}
            </Badge>
            <span>
              {formatShortYearLabel(hoveredNode.node.person.birthDate) ||
                `~${hoveredNode.node.birthYear}`}
            </span>
          </div>
          {!hoveredNode.node.hasExactBirthYear && (
            <div className="mt-0.5 text-[10px] text-amber-500 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Estimasi tahun dari generasi
            </div>
          )}
        </div>
      )}

      {/* Bottom Playback Scrubber Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
        <div
          className={cn(
            'w-full max-w-xl px-3 py-2 rounded-2xl backdrop-blur-md border shadow-lg flex items-center gap-2.5 pointer-events-auto',
            isDarkCanvas
              ? 'bg-slate-950/85 border-slate-700/70 text-slate-100'
              : 'bg-background/92 border-border/70 text-foreground'
          )}
        >
          <Button
            size="icon"
            variant="default"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Jeda' : 'Putar'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={handleReplay}
            title="Ulang dari awal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <span className="text-[11px] font-medium tabular-nums opacity-70 shrink-0">
            {minYear}
          </span>
          <Slider
            value={[currentYearFloat]}
            min={minYear}
            max={maxYear}
            step={0.5}
            onValueChange={([val]) => {
              setIsPlaying(false);
              currentYearRef.current = val;
              setCurrentYearFloat(val);
            }}
            className="flex-1"
          />
          <span className="text-[11px] font-medium tabular-nums opacity-70 shrink-0">
            {maxYear}
          </span>

          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-[11px] font-semibold tabular-nums shrink-0"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            title="Kecepatan animasi"
          >
            {speed}x
          </Button>
        </div>
      </div>
    </div>
  );
}
