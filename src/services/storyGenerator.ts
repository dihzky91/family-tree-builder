import { useState, useCallback, useRef } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, Relationship } from '@/types';
import {
  StoryScope,
  filterPersonsByScope as filterPersonsByScopeFromSelector,
  computeAlignedGenerations,
} from '@/features/stories/StoryScopeSelector';
import { formatFlexibleDate, getEstimatedYear } from '@/lib/flexibleDateUtils';

export type StoryStyle = 'formal' | 'casual' | 'emotional' | 'children' | 'poetic';

export { filterPersonsByScopeFromSelector as filterPersonsByScope };
export type { StoryScope };

export interface StoryChapter {
  title: string;
  content: string;
  period: string;
  highlights: string[];
}

export interface GeneratedStory {
  title: string;
  subtitle: string;
  chapters: StoryChapter[];
  stats: {
    totalMembers: number;
    totalGenerations: number;
    yearsCovered: number;
    marriages: number;
  };
  includedPersonIds?: string[];
  generatedAt: Date;
  aiGenerated: boolean;
}

interface CoupleInfo {
  person1: Person;
  person2: Person;
  marriageDate?: string;
}

// Format date cleanly in Indonesian (supports exact and flexible dates)
function formatDateId(dateStr?: string | null): string | null {
  return formatFlexibleDate(dateStr);
}

function getYear(dateStr?: string | null): number | null {
  return getEstimatedYear(dateStr);
}

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, serta ${names[names.length - 1]}`;
}

function extractFamilyName(firstGenPersons: Person[]): string {
  if (firstGenPersons.length === 0) return 'Kami';
  // Prefer oldest male patriarch, otherwise oldest person in Gen 1
  const sorted = [...firstGenPersons].sort((a, b) => {
    const ya = getYear(a.birthDate) ?? 9999;
    const yb = getYear(b.birthDate) ?? 9999;
    if (ya !== yb) return ya - yb;
    if (a.gender === 'male' && b.gender !== 'male') return -1;
    if (b.gender === 'male' && a.gender !== 'male') return 1;
    return 0;
  });

  const raw = sorted[0].fullName.trim();
  // Remove common honorifics before picking family name
  const cleaned = raw.replace(/^(H\.|Hj\.|Dr\.|Ir\.|Prof\.|KH\.|R\.|R\.A\.)\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];
  return cleaned || raw;
}

function findScopedCouples(persons: Person[], relationships: Relationship[]): CoupleInfo[] {
  const couples: CoupleInfo[] = [];
  const seen = new Set<string>();
  const personMap = new Map(persons.map((p) => [p.id, p]));

  for (const rel of relationships) {
    if (rel.type !== 'SPOUSE') continue;
    const p1 = personMap.get(rel.fromPersonId);
    const p2 = personMap.get(rel.toPersonId);
    if (!p1 || !p2) continue;

    const key = [p1.id, p2.id].sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);

    // Order husband first if known for natural Indonesian reading
    const ordered: [Person, Person] =
      p1.gender === 'female' && p2.gender === 'male' ? [p2, p1] : [p1, p2];

    couples.push({
      person1: ordered[0],
      person2: ordered[1],
      marriageDate: rel.meta?.startDate,
    });
  }

  // Sort couples oldest first
  return couples.sort((a, b) => {
    const ya = Math.min(getYear(a.person1.birthDate) ?? 9999, getYear(a.person2.birthDate) ?? 9999);
    const yb = Math.min(getYear(b.person1.birthDate) ?? 9999, getYear(b.person2.birthDate) ?? 9999);
    return ya - yb;
  });
}

function calculateYearsCovered(persons: Person[]): number {
  const years = persons.map((p) => getYear(p.birthDate)).filter((y): y is number => y !== null);
  if (years.length < 2) return 0;
  return Math.max(...years) - Math.min(...years);
}

function calculatePeriodString(persons: Person[]): string {
  const years = persons.map((p) => getYear(p.birthDate)).filter((y): y is number => y !== null);
  if (years.length === 0) return 'Periode tidak tercatat';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `Tahun ${min}` : `${min} – ${max}`;
}

function describePersonProfile(person: Person, spouses: Person[]): string {
  const parts: string[] = [];
  const birthFormatted = formatDateId(person.birthDate);
  const deathFormatted = formatDateId(person.deathDate);

  if (birthFormatted && person.birthPlace) {
    parts.push(`lahir di ${person.birthPlace} pada ${birthFormatted}`);
  } else if (birthFormatted) {
    parts.push(`lahir pada ${birthFormatted}`);
  } else if (person.birthPlace) {
    parts.push(`berasal dari ${person.birthPlace}`);
  }

  if (spouses.length > 0) {
    parts.push(`menikah dengan ${joinNames(spouses.map((s) => s.fullName))}`);
  }

  if (person.residence && !person.deathDate) {
    parts.push(`kini menetap di ${person.residence}`);
  }

  if (deathFormatted && person.deathPlace) {
    parts.push(`wafat di ${person.deathPlace} pada ${deathFormatted}`);
  } else if (deathFormatted) {
    parts.push(`wafat pada ${deathFormatted}`);
  }

  let sentence =
    parts.length > 0
      ? `${person.fullName} ${parts.join(', ')}.`
      : `${person.fullName} merupakan bagian dari generasi ini.`;

  if (person.notes && person.notes.trim().length > 0) {
    const cleanNote = person.notes.trim().replace(/\.$/, '');
    sentence += ` Catatan keluarga: "${cleanNote}".`;
  }

  return sentence;
}

// Accurate, data-grounded story generator
export function generateTemplateStory(
  persons: Person[],
  allRelationships: Relationship[],
  style: StoryStyle = 'casual',
  scope?: StoryScope
): GeneratedStory {
  // 1. Strictly filter relationships to only those inside the scoped persons
  const personIds = new Set(persons.map((p) => p.id));
  const relationships = allRelationships.filter(
    (r) => personIds.has(r.fromPersonId) && personIds.has(r.toPersonId)
  );

  // 2. Align generations accurately (spouses/in-laws aligned with their partner's generation!)
  const { generations, personGenMap } = computeAlignedGenerations(persons, relationships);
  const couples = findScopedCouples(persons, relationships);
  const yearsCovered = calculateYearsCovered(persons);
  const storyTemplate = getStoryTemplate(style);

  // Helpers for lookups
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const getParents = (id: string) =>
    relationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === id)
      .map((r) => personMap.get(r.fromPersonId))
      .filter((p): p is Person => Boolean(p));

  const getChildren = (id: string) =>
    relationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.fromPersonId === id)
      .map((r) => personMap.get(r.toPersonId))
      .filter((p): p is Person => Boolean(p));

  const getSpouses = (id: string) => {
    const ids = new Set<string>();
    relationships.forEach((r) => {
      if (r.type === 'SPOUSE') {
        if (r.fromPersonId === id) ids.add(r.toPersonId);
        if (r.toPersonId === id) ids.add(r.fromPersonId);
      }
    });
    return Array.from(ids)
      .map((sid) => personMap.get(sid))
      .filter((p): p is Person => Boolean(p));
  };

  // Special Biography Mode when scope is 'person'
  if (scope?.type === 'person' && scope.rootPersonId && personMap.has(scope.rootPersonId)) {
    const focus = personMap.get(scope.rootPersonId)!;
    const focusSpouses = getSpouses(focus.id);
    const focusChildren = getChildren(focus.id);
    const focusParents = allRelationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === focus.id)
      .map((r) => useFamilyStore.getState().persons.find((p) => p.id === r.fromPersonId))
      .filter((p): p is Person => Boolean(p));

    const chapters: StoryChapter[] = [];

    // Chapter 1: Profil & Asal-Usul
    const originLines: string[] = [storyTemplate.tone];
    originLines.push(describePersonProfile(focus, focusSpouses));
    if (focusParents.length > 0) {
      originLines.push(
        `${focus.fullName} merupakan ${
          focus.gender === 'male' ? 'putra' : focus.gender === 'female' ? 'putri' : 'anak'
        } dari ${joinNames(focusParents.map((p) => p.fullName))}.`
      );
    }

    chapters.push({
      title: `Profil ${focus.fullName}`,
      content: originLines.join('\n\n'),
      period: calculatePeriodString([focus]),
      highlights: [
        focus.birthDate ? `Lahir: ${formatDateId(focus.birthDate)}` : 'Tanggal lahir belum tercatat',
        focus.birthPlace ? `Tempat lahir: ${focus.birthPlace}` : null,
        focusSpouses.length > 0 ? `Pasangan: ${joinNames(focusSpouses.map((s) => s.fullName))}` : null,
      ].filter((h): h is string => Boolean(h)),
    });

    // Subsequent chapters for descendants
    for (let i = 1; i < generations.length; i++) {
      const genMembers = generations[i];
      const label = i === 1 ? 'Anak-anak' : i === 2 ? 'Cucu' : `Keturunan Generasi ke-${i + 1}`;
      chapters.push(
        buildGenerationChapter(genMembers, i, label, relationships, personMap, getParents, getSpouses, storyTemplate)
      );
    }

    // Legacy chapter
    chapters.push(buildLegacyChapter(persons, storyTemplate));

    return {
      title: `Biografi & Keturunan ${focus.fullName}`,
      subtitle: storyTemplate.subtitleTemplate,
      chapters,
      stats: {
        totalMembers: persons.length,
        totalGenerations: generations.length,
        yearsCovered,
        marriages: couples.length,
      },
      includedPersonIds: persons.map((p) => p.id),
      generatedAt: new Date(),
      aiGenerated: false,
    };
  }

  // Standard Family / Branch / Subfamily Mode
  const firstGen = generations[0] || [];
  const firstGenIds = new Set(firstGen.map((p) => p.id));
  const founderCouples = couples.filter(
    (c) => firstGenIds.has(c.person1.id) && firstGenIds.has(c.person2.id)
  );
  const familyName = extractFamilyName(firstGen);
  const chapters: StoryChapter[] = [];

  const earliestYear = persons
    .map((p) => getYear(p.birthDate))
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b)[0];

  // Chapter 1: Introduction (ACCURATE generation count & ONLY Generation 1 founders!)
  const founderSummary =
    founderCouples.length > 0
      ? founderCouples.map((c) => `${c.person1.fullName} dan ${c.person2.fullName}`).join('; ')
      : joinNames(firstGen.slice(0, 4).map((p) => p.fullName));

  const introParagraphs = [
    storyTemplate.tone,
    `Keluarga ${familyName} dalam catatan silsilah ini mencakup ${persons.length} anggota yang terbentang dalam ${generations.length} generasi${
      yearsCovered > 0 ? ` sepanjang rentang ${yearsCovered} tahun` : ''
    }. Jejak awalnya berakar dari generasi pertama, yaitu ${founderSummary || 'para leluhur keluarga'}.`,
    `Melalui dokumentasi ini, kita menelusuri perjalanan setiap generasi keluarga ${familyName} beserta ikatan kekerabatan yang menyatukannya hingga hari ini.`,
  ];

  chapters.push({
    title: storyTemplate.chapterTitles.introduction,
    content: introParagraphs.join('\n\n'),
    period: earliestYear ? `${earliestYear} – Sekarang` : 'Sepanjang Masa',
    highlights: [
      `Total ${persons.length} anggota keluarga`,
      `${generations.length} generasi tercatat`,
      `${couples.length} pasangan menikah`,
    ],
  });

  // Chapter 2: Generation 1 (Founders)
  if (firstGen.length > 0) {
    const gen1Paragraphs: string[] = [];

    if (founderCouples.length > 0) {
      founderCouples.forEach((couple) => {
        const marriageYear = getYear(couple.marriageDate);
        const kids = getChildren(couple.person1.id).filter(
          (k) =>
            getChildren(couple.person2.id).some((k2) => k2.id === k.id) ||
            getParents(k.id).length === 1
        );

        let text = marriageYear
          ? `${couple.person1.fullName} dan ${couple.person2.fullName} membangun rumah tangga pada tahun ${marriageYear}.`
          : `${couple.person1.fullName} dan ${couple.person2.fullName} menjadi salah satu pasangan fondasi generasi pertama keluarga ini.`;

        if (kids.length > 0) {
          text += ` Dari pernikahan mereka lahir ${kids.length} anak, yaitu ${joinNames(
            kids.map((k) => k.fullName)
          )}.`;
        }
        gen1Paragraphs.push(text);
      });
    }

    // Individual profiles for Gen 1 members
    const profileLines = firstGen.map((p) => describePersonProfile(p, getSpouses(p.id)));
    if (profileLines.length > 0) {
      gen1Paragraphs.push(profileLines.join(' '));
    }

    chapters.push({
      title: `${storyTemplate.chapterTitles.beginning} (Generasi 1)`,
      content: gen1Paragraphs.join('\n\n'),
      period: calculatePeriodString(firstGen),
      highlights: firstGen.map((p) => {
        const y = getYear(p.birthDate);
        return y ? `${p.fullName} (lahir ${y})` : p.fullName;
      }),
    });
  }

  // Chapters 3..N: ALL remaining generations (no hardcoded 3-gen cap!)
  for (let i = 1; i < generations.length; i++) {
    const genMembers = generations[i];
    chapters.push(
      buildGenerationChapter(
        genMembers,
        i,
        `${storyTemplate.chapterTitles.growth} ${i + 1}`,
        relationships,
        personMap,
        getParents,
        getSpouses,
        storyTemplate
      )
    );
  }

  // Final Chapter: Legacy
  chapters.push(buildLegacyChapter(persons, storyTemplate));

  return {
    title: storyTemplate.titleTemplate.replace('{familyName}', familyName),
    subtitle: storyTemplate.subtitleTemplate,
    chapters,
    stats: {
      totalMembers: persons.length,
      totalGenerations: generations.length,
      yearsCovered,
      marriages: couples.length,
    },
    includedPersonIds: persons.map((p) => p.id),
    generatedAt: new Date(),
    aiGenerated: false,
  };
}

function buildGenerationChapter(
  genMembers: Person[],
  genIndex: number,
  title: string,
  relationships: Relationship[],
  personMap: Map<string, Person>,
  getParents: (id: string) => Person[],
  getSpouses: (id: string) => Person[],
  template: ReturnType<typeof getStoryTemplate>
): StoryChapter {
  const paragraphs: string[] = [];

  paragraphs.push(
    `Generasi ke-${genIndex + 1} terdiri dari ${genMembers.length} anggota keluarga yang melanjutkan perjalanan dan memperluas cabang keluarga.`
  );

  // Group blood descendants by their parent set for clear family context
  const byParentKey = new Map<string, { parents: Person[]; children: Person[] }>();
  const marriedInOrOther: Person[] = [];

  for (const person of genMembers) {
    const parents = getParents(person.id);
    if (parents.length > 0) {
      const key = parents
        .map((p) => p.id)
        .sort()
        .join('-');
      if (!byParentKey.has(key)) {
        byParentKey.set(key, { parents, children: [] });
      }
      byParentKey.get(key)!.children.push(person);
    } else {
      marriedInOrOther.push(person);
    }
  }

  // Narrate each sibling group
  byParentKey.forEach(({ parents, children }) => {
    const parentNames = joinNames(parents.map((p) => p.fullName));
    const intro = `Dari ${parentNames}, tercatat ${children.length} anak yaitu ${joinNames(
      children.map((c) => c.fullName)
    )}.`;
    const details = children.map((c) => describePersonProfile(c, getSpouses(c.id))).join(' ');
    paragraphs.push(`${intro} ${details}`);
  });

  // Narrate spouses/in-laws or other members in this generation
  if (marriedInOrOther.length > 0) {
    const inLawDetails = marriedInOrOther
      .map((p) => describePersonProfile(p, getSpouses(p.id)))
      .join(' ');
    paragraphs.push(
      `Anggota lain yang turut memperkaya generasi ke-${genIndex + 1}: ${inLawDetails}`
    );
  }

  return {
    title,
    content: paragraphs.join('\n\n'),
    period: calculatePeriodString(genMembers),
    highlights: genMembers.map((p) => {
      const y = getYear(p.birthDate);
      return y ? `${p.fullName} (${y})` : p.fullName;
    }),
  };
}

function buildLegacyChapter(
  persons: Person[],
  template: ReturnType<typeof getStoryTemplate>
): StoryChapter {
  const living = persons.filter((p) => !p.deathDate);
  const deceased = persons.filter((p) => Boolean(p.deathDate));

  const places = Array.from(
    new Set(
      persons
        .map((p) => (p.residence || p.birthPlace || '').trim())
        .filter((loc) => loc.length > 0)
    )
  );

  const paragraphs: string[] = [];

  paragraphs.push(
    deceased.length > 0
      ? `Dalam perjalanan panjang keluarga ini, ${deceased.length} anggota tercinta telah berpulang (${joinNames(
          deceased.slice(0, 5).map((p) => p.fullName)
        )}${deceased.length > 5 ? ', dan lainnya' : ''}). Kenangan serta jasa mereka tetap hidup dalam ingatan keluarga.`
      : `Seluruh ${persons.length} anggota yang tercatat dalam cakupan cerita ini masih diberikan kesehatan untuk terus merangkai kenangan bersama.`
  );

  if (living.length > 0) {
    paragraphs.push(
      `Saat ini terdapat ${living.length} anggota keluarga yang masih aktif melanjutkan cerita dan tradisi keluarga${
        places.length > 0 ? `, tersebar di ${joinNames(places.slice(0, 5))}${places.length > 5 ? ' dan kota lainnya' : ''}` : ''
      }.`
    );
  }

  paragraphs.push(template.closing);

  return {
    title: template.chapterTitles.legacy,
    content: paragraphs.join('\n\n'),
    period: 'Warisan Keluarga',
    highlights: [
      `${living.length} anggota masih hidup`,
      deceased.length > 0 ? `${deceased.length} almarhum/ah dikenang` : 'Semua anggota masih hidup',
      places.length > 0 ? `Tersebar di ${places.length} lokasi` : 'Ikatan persaudaraan lintas generasi',
    ],
  };
}

function getStoryTemplate(style: StoryStyle) {
  const templates = {
    formal: {
      titleTemplate: 'Sejarah Keluarga {familyName}',
      subtitleTemplate: 'Dokumentasi genealogi dan narasi historis keluarga',
      chapterTitles: {
        introduction: 'Pendahuluan',
        beginning: 'Asal-usul dan Generasi Pendiri',
        growth: 'Generasi ke-',
        legacy: 'Warisan dan Penutup',
      },
      tone: 'Dokumen ini merangkum catatan genealogi dan perjalanan historis keluarga besar secara kronologis.',
      closing:
        'Semoga dokumentasi ini menjadi arsip berharga yang menjaga kesinambungan sejarah bagi generasi mendatang.',
    },
    casual: {
      titleTemplate: 'Cerita Keluarga {familyName}',
      subtitleTemplate: 'Perjalanan kebersamaan dari generasi ke generasi',
      chapterTitles: {
        introduction: 'Mengenal Keluarga Kita',
        beginning: 'Awal Mula Keluarga',
        growth: 'Generasi ke-',
        legacy: 'Jejak yang Kita Wariskan',
      },
      tone: 'Mari menelusuri cerita keluarga kita dari awal hingga hari ini!',
      closing:
        'Warisan terbesar kita adalah ikatan kebersamaan yang terus dijaga dari generasi ke generasi.',
    },
    emotional: {
      titleTemplate: 'Benang Merah Keluarga {familyName}',
      subtitleTemplate: 'Kisah kasih sayang yang mengalir lintas generasi',
      chapterTitles: {
        introduction: 'Cinta yang Mengawali Segalanya',
        beginning: 'Fondasi Kasih Pertama',
        growth: 'Generasi ke-',
        legacy: 'Kasih yang Abadi',
      },
      tone: 'Di balik setiap nama dalam silsilah ini, tersimpan doa, perjuangan, dan kasih sayang yang tak ternilai.',
      closing:
        'Semoga hangatnya cinta keluarga ini terus mengalir dan menguatkan setiap generasi yang akan datang.',
    },
    children: {
      titleTemplate: 'Buku Cerita Keluarga {familyName}',
      subtitleTemplate: 'Mengenal kakek, nenek, dan keluarga besar kita',
      chapterTitles: {
        introduction: 'Halo, Ini Keluarga Besar Kita!',
        beginning: 'Kisah Kakek dan Nenek Buyut',
        growth: 'Generasi ke-',
        legacy: 'Cerita untuk Diteruskan',
      },
      tone: 'Halo! Yuk kita kenalan dengan anggota keluarga besar kita dari dulu sampai sekarang.',
      closing:
        'Setiap orang di keluarga kita punya peran istimewa. Yuk kita jaga dan sayangi keluarga kita!',
    },
    poetic: {
      titleTemplate: 'Jejak Waktu Keluarga {familyName}',
      subtitleTemplate: 'Untaian kisah dalam lintasan zaman',
      chapterTitles: {
        introduction: 'Prolog',
        beginning: 'Akar Pertama',
        growth: 'Generasi ke-',
        legacy: 'Epilog: Warisan Abadi',
      },
      tone: 'Dalam lipatan waktu yang terus bergulir, nama-nama ini menjadi akar tempat kita bertumbuh.',
      closing:
        'Waktu boleh berlalu, namun nama, doa, dan ikatan darah akan selalu menemukan jalannya pulang.',
    },
  };

  return templates[style];
}

export function useStoryGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const generateStory = useCallback(async (style: StoryStyle): Promise<GeneratedStory | null> => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    abortController.current = new AbortController();

    try {
      const { persons, relationships } = useFamilyStore.getState();
      if (persons.length === 0) {
        throw new Error('Tidak ada data anggota keluarga untuk membuat cerita');
      }
      setProgress(40);
      const story = generateTemplateStory(persons, relationships, style);
      setProgress(100);
      return story;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateStoryWithScope = useCallback(
    async (style: StoryStyle, scope: StoryScope): Promise<GeneratedStory | null> => {
      setIsGenerating(true);
      setProgress(0);
      setError(null);
      abortController.current = new AbortController();

      try {
        const { persons, relationships } = useFamilyStore.getState();
        if (persons.length === 0) {
          throw new Error('Tidak ada data anggota keluarga untuk membuat cerita');
        }

        setProgress(30);
        const filteredPersons = filterPersonsByScopeFromSelector(
          persons as Person[],
          relationships,
          scope
        );

        if (filteredPersons.length === 0) {
          throw new Error('Tidak ada anggota keluarga yang cocok dengan cakupan yang dipilih');
        }

        setProgress(65);
        const story = generateTemplateStory(filteredPersons, relationships, style, scope);
        setProgress(100);
        return story;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const cancelGeneration = useCallback(() => {
    abortController.current?.abort();
    setIsGenerating(false);
  }, []);

  return {
    generateStory,
    generateStoryWithScope,
    cancelGeneration,
    isGenerating,
    progress,
    error,
  };
}
