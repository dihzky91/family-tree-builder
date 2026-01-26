import type { Person, Relationship } from '@/types';

/**
 * Generate GEDCOM 5.5.1 content from persons and relationships
 */
export function generateGedcom(persons: Person[], relationships: Relationship[]): string {
    const lines: string[] = [];
    const now = new Date();

    // Helper to add lines
    const add = (level: number, tag: string, value: string = '') => {
        lines.push(`${level} ${tag} ${value}`.trim());
    };

    // 1. HEADER
    add(0, 'HEAD');
    add(1, 'SOUR', 'SilsilahApp');
    add(2, 'VERS', '1.0');
    add(1, 'GEDC');
    add(2, 'VERS', '5.5.1');
    add(2, 'FORM', 'LINEAGE-LINKED');
    add(1, 'CHAR', 'UTF-8');
    add(1, 'DATE', now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
    add(2, 'TIME', now.toLocaleTimeString('en-GB', { hour12: false }));
    add(1, 'SUBM', '@SUBM1@');

    add(0, '@SUBM1@', 'SUBM');
    add(1, 'NAME', 'Pengguna Silsilah');

    // 2. INDIVIDUALS
    persons.forEach(p => {
        // ID mapping: UUID -> @I[CleanedUUID]@
        const gedId = `@I${p.id.replace(/-/g, '').substring(0, 20)}@`; // GEDCOM limits ID length usually, but standard allows 22 refs

        add(0, gedId, 'INDI');

        // Name
        const names = p.fullName.trim().split(' ');
        const surname = names.length > 1 ? names.pop() : '';
        const givenName = names.join(' ');
        add(1, 'NAME', `${givenName} /${surname}/`);
        if (surname) add(2, 'SURN', surname);
        if (givenName) add(2, 'GIVN', givenName);

        // Gender
        add(1, 'SEX', p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'U');

        // Birth
        if (p.birthDate || p.birthPlace) {
            add(1, 'BIRT');
            if (p.birthDate) {
                // Format date: YYYY-MM-DD -> DD MMM YYYY
                try {
                    const date = new Date(p.birthDate);
                    if (!isNaN(date.getTime())) {
                        const day = date.getDate();
                        const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
                        const year = date.getFullYear();
                        add(2, 'DATE', `${day} ${month} ${year}`);
                    }
                } catch (e) {
                    // optimize: ignore invalid dates
                }
            }
            if (p.birthPlace) add(2, 'PLAC', p.birthPlace);
        }

        // Death
        if (p.deathDate || p.deathPlace) {
            add(1, 'DEAT');
            if (p.deathDate) {
                try {
                    const date = new Date(p.deathDate);
                    if (!isNaN(date.getTime())) {
                        const day = date.getDate();
                        const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
                        const year = date.getFullYear();
                        add(2, 'DATE', `${day} ${month} ${year}`);
                    }
                } catch (e) { }
            }
            if (p.deathPlace) add(2, 'PLAC', p.deathPlace);
        }

        // Notes
        if (p.notes) {
            add(1, 'NOTE', p.notes.replace(/\n/g, ' '));
        }

        // Links to Families (FAMS = Spouse, FAMC = Child)
        // We calculate this later or here if we have efficient lookups.
        // For now, let's look up relationships.

        // Child of which family? (FAMC)
        // Find parents
        const parentRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === p.id);
        if (parentRels.length > 0) {
            // We group parents into a family. 
            // Logic: Try to find if parents are spouses. If yes, that's one family.
            // If not, they are separate single-parent families (uncommon in GEDCOM strictness but valid).

            // Simplification: Group all parents as one "Family" is tricky if they are not married.
            // Better approach: Pre-calculate Families in step 3 and assign IDs, then back-reference here.
            // But for a single pass export, we might need to pre-process families first.
        }
    });

    // 3. FAMILIES
    // To generate FAM records correctly and link INDI to them, we need to identify unique "couples" or "parent-sets".

    const families: { id: string, husband?: string, wife?: string, children: string[] }[] = [];
    const processedSpouses = new Set<string>();

    // Strategy:
    // A. Find all SPOUSE relationships
    relationships.filter(r => r.type === 'SPOUSE').forEach(rel => {
        // Check if pair already processed
        const pairId = [rel.fromPersonId, rel.toPersonId].sort().join('-');
        if (processedSpouses.has(pairId)) return;
        processedSpouses.add(pairId);

        const p1 = persons.find(p => p.id === rel.fromPersonId);
        const p2 = persons.find(p => p.id === rel.toPersonId);
        if (!p1 || !p2) return;

        const husband = p1.gender === 'male' ? p1.id : p2.gender === 'male' ? p2.id : undefined;
        const wife = p1.gender === 'female' ? p1.id : p2.gender === 'female' ? p2.id : undefined;

        // Fallback if same sex or unknown
        const h = husband || p1.id;
        const w = wife || (p1.id === h ? p2.id : p1.id);

        families.push({
            id: `F${families.length + 1}`,
            husband: h,
            wife: w,
            children: []
        });
    });

    // B. Assign Children to Families
    persons.forEach(child => {
        const parentRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === child.id);
        if (parentRels.length === 0) return;

        const parentIds = parentRels.map(r => r.fromPersonId);

        // Try to find a family that matches these parents
        let fam = families.find(f =>
            (f.husband && parentIds.includes(f.husband) && f.wife && parentIds.includes(f.wife))
        );

        // If no spouse family found, but we have 2 parents, maybe they are not linked as spouse?
        // Or if single parent? 
        if (!fam) {
            // Check if we have a single parent family created already?
            // For simple GEDCOM, let's create a new family for this set of parents if not exists
            // This is a bit complex for a simple utility, but let's try to attach to *any* family where one parent is present? 
            // No, that puts children in wrong marriages.

            // If parents are [A, B] and no spouse link A-B. Create a "Family" event if not existing.
            if (parentIds.length > 0) {
                // Creating a "Synthetic" family for parents who aren't explicitly spouses
                // Check if we already made a specific family for these exact parents
                // For simplicity in this version: Just pick the first parent and link to any family they are in? No.

                // Let's just create a new family record for *every* unique set of parents that are not spouses
                // Skipped for MVP to avoid "duplicate families". 
                // Only verified spouse families get children in MVP? 
                // Better: Look for a family where AT LEAST ONE parent is a spouse? 

                // MVP Approach: 
                // If parents match a Spouse Family, add child there.
                // If not, ignore FAMC link to avoid bad data, OR create single-parent family.

                if (parentIds.length === 1) {
                    // Single parent case
                    const pId = parentIds[0];
                    let spFam = families.find(f => (f.husband === pId && !f.wife) || (f.wife === pId && !f.husband));
                    if (!spFam) {
                        spFam = { id: `F${families.length + 1}`, husband: persons.find(p => p.id === pId)?.gender === 'male' ? pId : undefined, wife: persons.find(p => p.id === pId)?.gender === 'female' ? pId : undefined, children: [] };
                        // If gender unknown, assign to husband default
                        if (!spFam.husband && !spFam.wife) spFam.husband = pId;
                        families.push(spFam);
                    }
                    spFam.children.push(child.id);
                } else {
                    // 2 parents but not spouses.
                    // Create synthetic family
                    const p1 = parentIds[0];
                    const p2 = parentIds[1];
                    // Check duplication?
                    // Just add to one of them? No.
                }
            }
        } else {
            fam.children.push(child.id);
        }
    });

    // Re-loop to add links in INDI records
    // We strictly need to modify the stored lines or output them now. 
    // Since we already outputted INDI, this is tricky. 
    // GEDCOM order doesn't strictly matter for some parsers, but INDI should have FAMS/FAMC.
    // Ideally, we process Families *before* generating INDI lines string? No, we print INDI then FAM.
    // But INDI needs FAMS/FAMC tags inside it.

    // REFACTOR: Build objects first, then print.

    return generateGedcomString(persons, relationships, families);
}

function generateGedcomString(persons: Person[], relationships: Relationship[], families: any[]): string {
    const lines: string[] = [];
    const add = (level: number, tag: string, value: string = '') => lines.push(`${level} ${tag} ${value}`.trim());

    // HEADER
    add(0, 'HEAD');
    add(1, 'SOUR', 'SilsilahApp');
    add(1, 'GEDC');
    add(2, 'VERS', '5.5.1');
    add(2, 'FORM', 'LINEAGE-LINKED');
    add(1, 'CHAR', 'UTF-8');
    add(1, 'SUBM', '@SUBM1@');
    add(0, '@SUBM1@', 'SUBM');
    add(1, 'NAME', 'Pengguna');

    // INDIVIDUALS
    persons.forEach(p => {
        const gedId = getId(p.id);
        add(0, gedId, 'INDI');

        const names = p.fullName.trim().split(' ');
        const surname = names.length > 1 ? names.pop() : '';
        const givenName = names.join(' ');
        add(1, 'NAME', `${givenName} /${surname}/`);
        add(1, 'SEX', p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'U');

        if (p.birthDate) {
            add(1, 'BIRT');
            add(2, 'DATE', formatDate(p.birthDate));
            if (p.birthPlace) add(2, 'PLAC', p.birthPlace);
        }
        if (p.deathDate) {
            add(1, 'DEAT');
            add(2, 'DATE', formatDate(p.deathDate));
            if (p.deathPlace) add(2, 'PLAC', p.deathPlace);
        }

        // FAMS (Spouse in Family)
        families.filter(f => f.husband === p.id || f.wife === p.id).forEach(f => {
            add(1, 'FAMS', `@${f.id}@`);
        });

        // FAMC (Child in Family)
        families.filter(f => f.children.includes(p.id)).forEach(f => {
            add(1, 'FAMC', `@${f.id}@`);
        });
    });

    // FAMILIES
    families.forEach(f => {
        add(0, `@${f.id}@`, 'FAM');
        if (f.husband) add(1, 'HUSB', getId(f.husband));
        if (f.wife) add(1, 'WIFE', getId(f.wife));
        f.children.forEach((c: string) => {
            add(1, 'CHIL', getId(c));
        });
    });

    add(0, 'TRLR');
    return lines.join('\n');
}

function getId(uuid: string): string {
    return `@I${uuid.replace(/-/g, '').substring(0, 20)}@`;
}

function formatDate(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const day = date.getDate();
        const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    } catch {
        return '';
    }
}
