import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import type { Person, Relationship } from '@/types';
import { ANCESTOR_COLORS, blendMultipleColors, type AncestorLineage } from '@/lib/dnaLineageCalculator';
import { useIsMobile, useIsTouchDevice } from '@/hooks/useMediaQuery';

interface InheritanceTreeViewProps {
    persons: Person[];
    relationships: Relationship[];
    selectedPersonId: string | null;
    onSelectPerson: (id: string) => void;
}

interface TreeNode {
    person: Person;
    lineage: AncestorLineage;
    father?: TreeNode;
    mother?: TreeNode;
}

export function InheritanceTreeView({ persons, relationships, selectedPersonId, onSelectPerson }: InheritanceTreeViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const [rootPersonId, setRootPersonId] = useState<string | null>(selectedPersonId || persons[0]?.id || null);

    // Mobile detection
    const isMobile = useIsMobile();
    const isTouch = useIsTouchDevice();

    // Sync rootPersonId when external selectedPersonId changes
    useEffect(() => {
        if (selectedPersonId && persons.some(p => p.id === selectedPersonId)) {
            setRootPersonId(selectedPersonId);
        }
    }, [selectedPersonId, persons]);

    // Fallback to first person only if rootPersonId is empty/invalid
    useEffect(() => {
        if ((!rootPersonId || !persons.some(p => p.id === rootPersonId)) && persons.length > 0) {
            setRootPersonId(persons[0].id);
        }
    }, [rootPersonId, persons]);

    const sortedPersons = useMemo(
        () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName)),
        [persons]
    );

    // Build tree structure with lineage
    const treeData = useMemo(() => {
        if (!rootPersonId) return null;

        const cache = new Map<string, TreeNode>();

        function buildNode(personId: string, depth: number, pathType: 'root' | 'paternal' | 'maternal' | 'pg' | 'pgm' | 'mg' | 'mgm'): TreeNode | null {
            if (depth > 4) return null;
            if (cache.has(personId)) return cache.get(personId)!;

            const person = persons.find(p => p.id === personId);
            if (!person) return null;

            const parentRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === personId);
            const parents = parentRels.map(r => persons.find(p => p.id === r.fromPersonId)).filter(Boolean) as Person[];

            let father = parents.find(p => p.gender === 'male');
            let mother = parents.find(p => p.gender === 'female');
            if (!father && parents.length >= 1) father = parents[0];
            if (!mother && parents.length >= 2) mother = parents[1];

            // Calculate lineage based on depth
            let lineage: AncestorLineage;

            if (depth === 0) {
                // Root person - needs their lineage calculated from grandparents
                const fatherNode = father ? buildNode(father.id, depth + 1, 'paternal') : null;
                const motherNode = mother ? buildNode(mother.id, depth + 1, 'maternal') : null;

                const fatherLineage = fatherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
                const motherLineage = motherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };

                lineage = {
                    paternalGrandfather: fatherLineage.paternalGrandfather * 0.5 + motherLineage.paternalGrandfather * 0.5,
                    paternalGrandmother: fatherLineage.paternalGrandmother * 0.5 + motherLineage.paternalGrandmother * 0.5,
                    maternalGrandfather: fatherLineage.maternalGrandfather * 0.5 + motherLineage.maternalGrandfather * 0.5,
                    maternalGrandmother: fatherLineage.maternalGrandmother * 0.5 + motherLineage.maternalGrandmother * 0.5,
                };
            } else if (depth === 1) {
                // Parents - build their lineage from grandparents
                const newPathType = pathType === 'paternal' ? (person.gender === 'male' ? 'pg' : 'pgm') : (person.gender === 'male' ? 'mg' : 'mgm');
                const fatherNode = father ? buildNode(father.id, depth + 1, newPathType + '-f' as any) : null;
                const motherNode = mother ? buildNode(mother.id, depth + 1, newPathType + '-m' as any) : null;

                const fatherLineage = fatherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
                const motherLineage = motherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };

                lineage = {
                    paternalGrandfather: fatherLineage.paternalGrandfather * 0.5 + motherLineage.paternalGrandfather * 0.5,
                    paternalGrandmother: fatherLineage.paternalGrandmother * 0.5 + motherLineage.paternalGrandmother * 0.5,
                    maternalGrandfather: fatherLineage.maternalGrandfather * 0.5 + motherLineage.maternalGrandfather * 0.5,
                    maternalGrandmother: fatherLineage.maternalGrandmother * 0.5 + motherLineage.maternalGrandmother * 0.5,
                };
            } else if (depth === 2) {
                // Grandparents - assign 100% to their respective quadrant
                if (pathType === 'pg' || pathType.startsWith('pg-')) {
                    lineage = { paternalGrandfather: 1, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
                } else if (pathType === 'pgm' || pathType.startsWith('pgm-')) {
                    lineage = { paternalGrandfather: 0, paternalGrandmother: 1, maternalGrandfather: 0, maternalGrandmother: 0 };
                } else if (pathType === 'mg' || pathType.startsWith('mg-')) {
                    lineage = { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 1, maternalGrandmother: 0 };
                } else {
                    lineage = { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 1 };
                }
            } else {
                // Great-grandparents - inherit from parent's lineage
                const fatherNode = father ? buildNode(father.id, depth + 1, pathType) : null;
                const motherNode = mother ? buildNode(mother.id, depth + 1, pathType) : null;

                const fatherLineage = fatherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
                const motherLineage = motherNode?.lineage || { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };

                lineage = {
                    paternalGrandfather: fatherLineage.paternalGrandfather * 0.5 + motherLineage.paternalGrandfather * 0.5,
                    paternalGrandmother: fatherLineage.paternalGrandmother * 0.5 + motherLineage.paternalGrandmother * 0.5,
                    maternalGrandfather: fatherLineage.maternalGrandfather * 0.5 + motherLineage.maternalGrandfather * 0.5,
                    maternalGrandmother: fatherLineage.maternalGrandmother * 0.5 + motherLineage.maternalGrandmother * 0.5,
                };
            }

            const node: TreeNode = {
                person,
                lineage,
                father: father && depth < 4 ? buildNode(father.id, depth + 1, depth === 0 ? 'paternal' : pathType) : undefined,
                mother: mother && depth < 4 ? buildNode(mother.id, depth + 1, depth === 0 ? 'maternal' : pathType) : undefined,
            };

            cache.set(personId, node);
            return node;
        }

        return buildNode(rootPersonId, 0, 'root');
    }, [rootPersonId, persons, relationships]);

    useEffect(() => {
        if (!treeData || !svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Create main group for zoom/pan
        const g = svg
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g');

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom as any);

        // Set initial zoom to fit content
        const initialTransform = d3.zoomIdentity
            .translate(80, height / 2)
            .scale(0.8);

        svg.call(zoom.transform as any, initialTransform);

        // Convert to D3 hierarchy
        const root = d3.hierarchy(treeData, d => [d.father, d.mother].filter(Boolean) as TreeNode[]);

        // Tree layout - horizontal (ancestors to the right)
        const treeLayout = d3.tree<TreeNode>()
            .size([height - 80, width - 200])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

        treeLayout(root);

        // Draw links
        g.append('g')
            .selectAll('path')
            .data(root.links())
            .join('path')
            .attr('d', d3.linkHorizontal<any, any>()
                .x(d => d.y)
                .y(d => d.x))
            .attr('fill', 'none')
            .attr('stroke', '#d1d5db')
            .attr('stroke-width', 2)
            .attr('opacity', 0.5);

        // Draw nodes
        const nodes = g.append('g')
            .selectAll('g')
            .data(root.descendants())
            .join('g')
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodes.append('circle')
            .attr('r', isMobile ? 28 : 22) // Larger on mobile for easier tapping
            .attr('fill', d => blendMultipleColors(d.data.lineage))
            .attr('stroke', '#fff')
            .attr('stroke-width', 3)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                onSelectPerson(d.data.person.id);
            })
            .on('mouseover', function () {
                const baseRadius = isMobile ? 28 : 22;
                d3.select(this).attr('r', baseRadius + 4).attr('stroke-width', 4);
            })
            .on('mouseout', function () {
                const baseRadius = isMobile ? 28 : 22;
                d3.select(this).attr('r', baseRadius).attr('stroke-width', 3);
            });

        nodes.append('title')
            .text(d => {
                const l = d.data.lineage;
                const total = l.paternalGrandfather + l.paternalGrandmother + l.maternalGrandfather + l.maternalGrandmother;
                if (total === 0) return d.data.person.fullName;

                return `${d.data.person.fullName}\n` +
                    `Kakek Ayah: ${(l.paternalGrandfather / total * 100).toFixed(1)}%\n` +
                    `Nenek Ayah: ${(l.paternalGrandmother / total * 100).toFixed(1)}%\n` +
                    `Kakek Ibu: ${(l.maternalGrandfather / total * 100).toFixed(1)}%\n` +
                    `Nenek Ibu: ${(l.maternalGrandmother / total * 100).toFixed(1)}%`;
            });

        nodes.append('text')
            .attr('dy', '0.35em')
            .attr('x', d => d.children ? -30 : 30)
            .attr('text-anchor', d => d.children ? 'end' : 'start')
            .text(d => d.data.person.fullName.length > 18 ? d.data.person.fullName.slice(0, 16) + '..' : d.data.person.fullName)
            .style('font-size', '12px')
            .style('font-weight', '500')
            .style('fill', isDark ? 'hsl(40, 30%, 92%)' : 'hsl(25, 25%, 16%)')
            .style('pointer-events', 'none');

    }, [treeData, isDark, onSelectPerson, isMobile]);

    return (
        <div className="w-full h-full flex flex-col relative overflow-hidden" ref={containerRef}>
            <div
                data-export-ignore="true"
                className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-border/70 bg-background/88 px-3 py-1.5 shadow-sm backdrop-blur-md"
            >
                <span className="text-xs font-medium text-muted-foreground">Fokus:</span>
                <Select
                    value={rootPersonId || undefined}
                    onValueChange={(id) => {
                        setRootPersonId(id);
                        onSelectPerson(id);
                    }}
                >
                    <SelectTrigger className="w-[190px] sm:w-[220px] h-8 text-xs rounded-lg">
                        <SelectValue placeholder="Pilih Orang" />
                    </SelectTrigger>
                    <SelectContent>
                        {sortedPersons.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.fullName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Legend - hide on mobile to save space */}
            {!isMobile && (
                <Card className="absolute top-3 right-3 z-10 border-border/70 bg-background/88 backdrop-blur-md p-3 shadow-sm">
                    <h3 className="text-xs font-semibold mb-2">Garis Keturunan:</h3>
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: ANCESTOR_COLORS.PATERNAL_GRANDFATHER }} />
                            <span>Kakek Ayah</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: ANCESTOR_COLORS.PATERNAL_GRANDMOTHER }} />
                            <span>Nenek Ayah</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: ANCESTOR_COLORS.MATERNAL_GRANDFATHER }} />
                            <span>Kakek Ibu</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: ANCESTOR_COLORS.MATERNAL_GRANDMOTHER }} />
                            <span>Nenek Ibu</span>
                        </div>
                    </div>
                </Card>
            )}

            <svg ref={svgRef} className="w-full h-full block" />

            {/* Hint */}
            <div
                data-export-ignore="true"
                className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm"
            >
                Klik node untuk detail · Drag untuk geser · Scroll untuk zoom
            </div>

            {!rootPersonId && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground bg-background/80 p-4 rounded-xl">
                        Pilih seseorang untuk melihat DNA Chart
                    </p>
                </div>
            )}
        </div>
    );
}
