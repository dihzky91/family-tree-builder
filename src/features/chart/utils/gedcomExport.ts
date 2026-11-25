import type { Person, Relationship } from '@/types';
import { parseFlexibleDate, type PartialDateParts } from '@/lib/flexibleDateUtils';

interface GedcomFamily {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
}

const GEDCOM_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

function formatGedcomParts(parts?: PartialDateParts): string {
  if (!parts) return '';
  const { year, month, day } = parts;
  const mStr = month && month >= 1 && month <= 12 ? GEDCOM_MONTHS[month - 1] : '';
  if (day && mStr && year) return `${day} ${mStr} ${year}`;
  if (mStr && year) return `${mStr} ${year}`;
  if (year) return `${year}`;
  if (day && mStr) return `${day} ${mStr}`;
  if (mStr) return mStr;
  return '';
}

function formatGedcomDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return '';

  const d1 = formatGedcomParts(parsed.date1);
  const d2 = formatGedcomParts(parsed.date2);

  switch (parsed.qualifier) {
    case 'exact':
      return d1;
    case 'before':
      return d1 ? `BEF ${d1}` : '';
    case 'after':
      return d1 ? `AFT ${d1}` : '';
    case 'circa':
      return d1 ? `ABT ${d1}` : '';
    case 'unsure':
      return d1 ? `EST ${d1}` : '';
    case 'between':
      return d1 && d2 ? `BET ${d1} AND ${d2}` : d1 ? `ABT ${d1}` : '';
    case 'from_to':
      return d1 && d2 ? `FROM ${d1} TO ${d2}` : d1 ? `FROM ${d1}` : d2 ? `TO ${d2}` : '';
    case 'from':
      return d1 ? `FROM ${d1}` : '';
    case 'to':
      return d1 ? `TO ${d1}` : '';
    case 'free_text':
      return parsed.freeText ? `(${parsed.freeText.replace(/[()]/g, '')})` : '';
    case 'unknown':
    default:
      return '';
  }
}

function getGedcomIndiId(uuid: string): string {
  return `@I${uuid.replace(/-/g, '').substring(0, 20)}@`;
}

function assignHusbandWife(
  p1: Person | undefined,
  p2?: Person | undefined
): { husband?: string; wife?: string } {
  if (!p1 && !p2) return {};
  if (p1 && !p2) {
    if (p1.gender === 'female') return { wife: p1.id };
    return { husband: p1.id };
  }
  if (!p1 && p2) {
    if (p2.gender === 'female') return { wife: p2.id };
    return { husband: p2.id };
  }

  const a = p1!;
  const b = p2!;
  const husband = a.gender === 'male' ? a.id : b.gender === 'male' ? b.id : a.id;
  const wife =
    a.gender === 'female' && a.id !== husband
      ? a.id
      : b.gender === 'female' && b.id !== husband
        ? b.id
        : a.id === husband
          ? b.id
          : a.id;
  return { husband, wife };
}

/**
 * Generate GEDCOM 5.5.1 content from persons and relationships
 */
export function generateGedcom(persons: Person[], relationships: Relationship[]): string {
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const families: GedcomFamily[] = [];
  const familyByPairKey = new Map<string, GedcomFamily>();

  // 1. Build families from explicit SPOUSE relationships
  relationships
    .filter((r) => r.type === 'SPOUSE')
    .forEach((rel) => {
      const p1 = personMap.get(rel.fromPersonId);
      const p2 = personMap.get(rel.toPersonId);
      if (!p1 || !p2) return;

      const pairKey = [p1.id, p2.id].sort().join(':');
      if (familyByPairKey.has(pairKey)) return;

      const { husband, wife } = assignHusbandWife(p1, p2);
      const fam: GedcomFamily = {
        id: `F${families.length + 1}`,
        husband,
        wife,
        children: [],
      };
      families.push(fam);
      familyByPairKey.set(pairKey, fam);
    });

  // 2. Attach children to matching couple families or synthetic single/unmarried parent families
  persons.forEach((child) => {
    const parentIds = relationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === child.id)
      .map((r) => r.fromPersonId)
      .filter((pid) => personMap.has(pid));

    if (parentIds.length === 0) return;

    if (parentIds.length >= 2) {
      const pairKey = [parentIds[0], parentIds[1]].sort().join(':');
      let fam = familyByPairKey.get(pairKey);
      if (!fam) {
        const p1 = personMap.get(parentIds[0]);
        const p2 = personMap.get(parentIds[1]);
        const { husband, wife } = assignHusbandWife(p1, p2);
        fam = {
          id: `F${families.length + 1}`,
          husband,
          wife,
          children: [],
        };
        families.push(fam);
        familyByPairKey.set(pairKey, fam);
      }
      if (!fam.children.includes(child.id)) {
        fam.children.push(child.id);
      }
    } else {
      const singleId = parentIds[0];
      const singleKey = `single:${singleId}`;
      let spFam = familyByPairKey.get(singleKey);
      if (!spFam) {
        const p1 = personMap.get(singleId);
        const { husband, wife } = assignHusbandWife(p1);
        spFam = {
          id: `F${families.length + 1}`,
          husband,
          wife,
          children: [],
        };
        families.push(spFam);
        familyByPairKey.set(singleKey, spFam);
      }
      if (!spFam.children.includes(child.id)) {
        spFam.children.push(child.id);
      }
    }
  });

  // 3. Serialize GEDCOM 5.5.1 output
  const lines: string[] = [];
  const add = (level: number, tag: string, value = '') => {
    lines.push(value ? `${level} ${tag} ${value}` : `${level} ${tag}`);
  };

  const now = new Date();
  add(0, 'HEAD');
  add(1, 'SOUR', 'SilsilahApp');
  add(2, 'VERS', '1.0');
  add(1, 'GEDC');
  add(2, 'VERS', '5.5.1');
  add(2, 'FORM', 'LINEAGE-LINKED');
  add(1, 'CHAR', 'UTF-8');
  add(
    1,
    'DATE',
    now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  );
  add(1, 'SUBM', '@SUBM1@');
  add(0, '@SUBM1@', 'SUBM');
  add(1, 'NAME', 'Pengguna Silsilah');

  persons.forEach((p) => {
    const gedId = getGedcomIndiId(p.id);
    add(0, gedId, 'INDI');

    const names = p.fullName.trim().split(/\s+/);
    const surname = names.length > 1 ? names.pop() || '' : '';
    const givenName = names.join(' ');
    add(1, 'NAME', `${givenName} /${surname}/`.trim());
    if (givenName) add(2, 'GIVN', givenName);
    if (surname) add(2, 'SURN', surname);
    add(1, 'SEX', p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'U');

    const gedBirth = formatGedcomDate(p.birthDate);
    if (gedBirth || p.birthPlace) {
      add(1, 'BIRT');
      if (gedBirth) add(2, 'DATE', gedBirth);
      if (p.birthPlace) add(2, 'PLAC', p.birthPlace);
    }

    const gedDeath = formatGedcomDate(p.deathDate);
    if (gedDeath || p.deathPlace || p.deathDate) {
      add(1, 'DEAT', !gedDeath && !p.deathPlace ? 'Y' : '');
      if (gedDeath) add(2, 'DATE', gedDeath);
      if (p.deathPlace) add(2, 'PLAC', p.deathPlace);
    }

    if (p.residence) {
      add(1, 'RESI');
      add(2, 'PLAC', p.residence);
    }

    if (p.notes) {
      const noteLines = p.notes.split(/\r?\n/);
      add(1, 'NOTE', noteLines[0] || '');
      for (let i = 1; i < noteLines.length; i++) {
        add(2, 'CONT', noteLines[i]);
      }
    }

    families
      .filter((f) => f.husband === p.id || f.wife === p.id)
      .forEach((f) => add(1, 'FAMS', `@${f.id}@`));

    families
      .filter((f) => f.children.includes(p.id))
      .forEach((f) => add(1, 'FAMC', `@${f.id}@`));
  });

  families.forEach((f) => {
    add(0, `@${f.id}@`, 'FAM');
    if (f.husband) add(1, 'HUSB', getGedcomIndiId(f.husband));
    if (f.wife) add(1, 'WIFE', getGedcomIndiId(f.wife));
    f.children.forEach((c) => add(1, 'CHIL', getGedcomIndiId(c)));
  });

  add(0, 'TRLR');
  return lines.join('\n');
}
