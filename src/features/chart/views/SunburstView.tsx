import { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Person, Relationship } from "@/types";

interface SunburstViewProps {
    persons: Person[];
    relationships: Relationship[];
    selectedPersonId: string | null;
    onSelectPerson: (id: string) => void;
}

interface HierarchyNode {
    name: string;
    id: string;
    gender: string;
    children?: HierarchyNode[];
    value?: number;
}

export function SunburstView({
    persons,
    relationships,
    selectedPersonId,
    onSelectPerson,
}: SunburstViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();

    // Root pusat sunburst (boleh beda dari selectedPersonId supaya user bisa eksplor)
    const [rootPersonId, setRootPersonId] = useState<string | null>(selectedPersonId);

    // Sync root hanya ketika root masih kosong (biar tidak mengganggu eksplor user)
    useEffect(() => {
        if (selectedPersonId && !rootPersonId) setRootPersonId(selectedPersonId);
    }, [selectedPersonId, rootPersonId]);

    // Persons untuk dropdown
    const sortedPersons = useMemo(
        () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName)),
        [persons]
    );

    // Build hierarchy tree dari relasi parent->child
    const hierarchyData = useMemo(() => {
        if (!rootPersonId) return null;

        // Buat map biar lookup cepat (penting kalau data ratusan)
        const personById = new Map(persons.map((p) => [p.id, p]));
        const childrenByParent = new Map<string, string[]>();

        for (const rel of relationships) {
            if (rel.type !== "PARENT_CHILD") continue;
            const parentId = rel.fromPersonId;
            const childId = rel.toPersonId;
            if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
            childrenByParent.get(parentId)!.push(childId);
        }

        // Pengaman loop: visited set
        const buildTree = (personId: string, depth: number, visited: Set<string>): HierarchyNode | null => {
            if (depth > 10) return null; // limit kedalaman
            if (visited.has(personId)) return null; // prevent cycle
            const person = personById.get(personId);
            if (!person) return null;

            const nextVisited = new Set(visited);
            nextVisited.add(personId);

            const childIds = childrenByParent.get(personId) ?? [];
            const children = childIds
                .map((cid) => buildTree(cid, depth + 1, nextVisited))
                .filter((n): n is HierarchyNode => n !== null);

            return {
                name: person.fullName,
                id: person.id,
                gender: person.gender,
                children: children.length > 0 ? children : undefined,
                value: children.length === 0 ? 1 : undefined, // leaf value
            };
        };

        return buildTree(rootPersonId, 0, new Set());
    }, [rootPersonId, persons, relationships]);

    useEffect(() => {
        if (!hierarchyData || !svgRef.current || !containerRef.current) return;

        // Ukuran responsif berdasarkan container
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const radius = Math.min(width, height) / 2;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const g = svg
            .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
            .append("g");

        // Hierarchy + sum
        const root = d3
            .hierarchy<HierarchyNode>(hierarchyData)
            .sum((d) => d.value || 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        // Partition layout
        d3.partition<HierarchyNode>().size([2 * Math.PI, radius])(root);

        const rootNode = root as unknown as d3.HierarchyRectangularNode<HierarchyNode>;

        // Arc generator
        const arc = d3
            .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
            .startAngle((d) => d.x0)
            .endAngle((d) => d.x1)
            .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius / 2)
            .innerRadius((d) => d.y0)
            .outerRadius((d) => Math.max(d.y0 + 1, d.y1 - 1)); // jaga agar tidak negatif

        // --- DRAW PATHS ---
        const path = g
            .append("g")
            .selectAll("path")
            .data(rootNode.descendants().filter((d) => d.depth)) // skip pusat
            .join("path")
            .attr("d", arc)
            .attr("fill", (d) => {
                if (d.data.gender === "male") return "#3B82F6";
                if (d.data.gender === "female") return "#EC4899";
                return "#9CA3AF";
            })
            .attr("fill-opacity", (d) => (d.children ? 0.85 : 0.65))
            .style("cursor", "pointer");

        // Tooltip
        path.append("title").text((d) => {
            const chain = d.ancestors().map((x) => x.data.name).reverse().join(" / ");
            return `${chain}`;
        });

        // Hover effect
        path
            .on("mouseover", function () {
                d3.select(this).attr("fill-opacity", 1);
            })
            .on("mouseout", function (event, d) {
                d3.select(this).attr("fill-opacity", d.children ? 0.85 : 0.65);
            })
            .on("click", (event, d) => {
                onSelectPerson(d.data.id);
            });

        // --- CENTER TEXT ---
        g.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "14px")
            .style("font-weight", "700")
            .style("fill", theme === "dark" ? "white" : "black")
            .style("pointer-events", "none")
            .text(() => {
                const name = hierarchyData.name;
                return name.length > 22 ? name.slice(0, 20) + "..." : name;
            });

        // --- LABELS (RADIAL STRAIGHT TEXT) ---
        // Teks lurus yang diputar - lebih mudah dibaca daripada melengkung
        const labelGroup = g.append("g")
            .attr("pointer-events", "none")
            .style("user-select", "none");

        // Filter segmen yang cukup besar
        const LABEL_MIN_AREA = 15;
        const labelData = rootNode
            .descendants()
            .filter((d) => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > LABEL_MIN_AREA);

        labelGroup.selectAll("text")
            .data(labelData)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "white")
            .style("font-size", "9px")
            .style("font-weight", "600")
            .attr("transform", (d) => {
                const angle = (d.x0 + d.x1) / 2;
                const angleDeg = angle * (180 / Math.PI) - 90;
                const radius = (d.y0 + d.y1) / 2;

                // Flip jika di sisi kiri agar tetap terbaca
                const flip = angleDeg > 90 && angleDeg < 270;

                return `rotate(${angleDeg}) translate(${radius},0) rotate(${flip ? 180 : 0})`;
            })
            .text((d) => {
                // Hitung lebar maksimal berdasarkan arc length dengan margin ketat
                const arcLength = (d.x1 - d.x0) * (d.y0 + d.y1) / 2;
                const charWidth = 6.5; // Lebih konservatif untuk keamanan
                const safetyMargin = 0.7; // Gunakan hanya 70% dari space tersedia
                const maxChars = Math.floor((arcLength * safetyMargin) / charWidth);

                if (maxChars < 2) return ""; // Terlalu kecil

                const name = d.data.name;
                if (name.length <= maxChars) return name;

                // Potong dengan "..." - pastikan minimal ada 1 karakter sebelum ...
                const cutLength = Math.max(1, maxChars - 3);
                return name.slice(0, cutLength) + "...";
            });
    }, [hierarchyData, theme, onSelectPerson]);

    return (
        <div className="w-full h-full flex flex-col relative" ref={containerRef}>
            {/* Control */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/80 p-2 rounded-lg backdrop-blur">
                <span className="text-sm font-medium">Pusat Diagram:</span>
                <Select value={rootPersonId || undefined} onValueChange={setRootPersonId}>
                    <SelectTrigger className="w-[220px] h-9">
                        <SelectValue placeholder="Pilih Orang" />
                    </SelectTrigger>
                    <SelectContent>
                        {sortedPersons.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.fullName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Chart */}
            <svg ref={svgRef} className="w-full h-full" style={{ maxHeight: "100%" }} />

            {/* Empty */}
            {!rootPersonId && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground bg-background/80 p-4 rounded-xl">
                        Pilih seseorang untuk melihat diagram keturunan
                    </p>
                </div>
            )}
        </div>
    );
}
