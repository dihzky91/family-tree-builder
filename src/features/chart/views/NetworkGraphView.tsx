import { useMemo, useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import type { Person, Relationship } from '@/types';

interface NetworkGraphViewProps {
    persons: Person[];
    relationships: Relationship[];
    onSelectPerson?: (personId: string) => void;
    selectedPersonId?: string | null;
}

export function NetworkGraphView({ persons, relationships, onSelectPerson, selectedPersonId }: NetworkGraphViewProps) {
    const { theme } = useTheme();
    const graphRef = useRef<any>();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;

        const observeTarget = containerRef.current;
        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });

        resizeObserver.observe(observeTarget);
        return () => resizeObserver.unobserve(observeTarget);
    }, []);

    const graphData = useMemo(() => {
        const nodes = persons.map(p => ({
            id: p.id,
            name: p.fullName,
            gender: p.gender,
            val: 1, // size
            color: p.id === selectedPersonId ? '#F59E0B' : (p.gender === 'male' ? '#3B82F6' : p.gender === 'female' ? '#EC4899' : '#9CA3AF')
        }));

        const links: any[] = [];

        relationships.forEach(rel => {
            if (rel.type === 'PARENT_CHILD') {
                links.push({
                    source: rel.fromPersonId, // Parent
                    target: rel.toPersonId,   // Child
                    color: theme === 'dark' ? '#4B5563' : '#CBD5E1',
                    width: 2,
                    particles: 2
                });
            } else if (rel.type === 'SPOUSE') {
                links.push({
                    source: rel.fromPersonId,
                    target: rel.toPersonId,
                    color: '#EF4444',
                    width: 1,
                    curvature: 0.2,
                    lineDash: [4, 4]
                });
            }
        });

        return { nodes, links };
    }, [persons, relationships, selectedPersonId, theme]);

    const handleZoomIn = () => {
        graphRef.current?.zoom(graphRef.current.zoom() * 1.2, 400);
    };

    const handleZoomOut = () => {
        graphRef.current?.zoom(graphRef.current.zoom() / 1.2, 400);
    };

    const handleReset = () => {
        graphRef.current?.zoomToFit(400);
    };

    if (!persons) return null; // Safety for SSR

    return (
        <div className="relative w-full h-full bg-background" ref={containerRef}>
            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={6}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={d => 0.005}
                onNodeClick={(node: any) => onSelectPerson?.(node.id)}
                backgroundColor={theme === 'dark' ? '#020817' : '#ffffff'}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const label = node.name;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    if (theme === 'dark') ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';

                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = node.color;
                    ctx.fillText(label, node.x, node.y);

                    // Draw circle
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    // Highlight selected
                    if (node.id === selectedPersonId) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                        ctx.strokeStyle = '#F59E0B';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }}
            />

            {/* Controls */}
            <Card className="absolute bottom-4 right-4 p-1 flex bg-background/80 backdrop-blur">
                <Button variant="ghost" size="icon" onClick={handleZoomOut}><ZoomOut className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleReset}><RotateCcw className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleZoomIn}><ZoomIn className="w-4 h-4" /></Button>
            </Card>
        </div>
    );
}
