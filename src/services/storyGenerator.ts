import { useState, useCallback, useRef } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, Relationship } from '@/types';
import { StoryScope, filterPersonsByScope as filterPersonsByScopeFromSelector } from '@/features/stories/StoryScopeSelector';

export type StoryStyle = 'formal' | 'casual' | 'emotional' | 'children' | 'poetic';

// Re-export types and functions for use by other components
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
  generatedAt: Date;
  aiGenerated: boolean;
}

// Template-based story generator (works offline, no AI needed)
export function generateTemplateStory(
  persons: Person[],
  relationships: Relationship[],
  style: StoryStyle = 'casual'
): GeneratedStory {
  // Find root ancestors (people without parents)
  const rootPersons = persons.filter(p => {
    const hasParents = relationships.some(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === p.id
    );
    return !hasParents;
  });

  // Find couples
  const couples = findCouples(persons, relationships);
  
  // Calculate generations
  const generations = calculateGenerations(persons, relationships);
  
  // Calculate stats
  const marriages = relationships.filter(r => r.type === 'SPOUSE').length;
  const yearsCovered = calculateYearsCovered(persons);

  // Generate story based on style
  const storyTemplate = getStoryTemplate(style);
  
  const chapters: StoryChapter[] = [];
  
  // Chapter 1: Introduction
  chapters.push({
    title: storyTemplate.chapterTitles.introduction,
    content: generateIntroduction(rootPersons, couples, storyTemplate),
    period: `${Math.min(...persons.map(p => p.birthDate ? new Date(p.birthDate).getFullYear() : new Date().getFullYear()))} - Sekarang`,
    highlights: [
      `Total ${persons.length} anggota keluarga`,
      `${couples.length} pasangan menikah`,
      `${generations.length} generasi`
    ]
  });

  // Chapter 2: The Beginning (first generation)
  if (rootPersons.length > 0) {
    chapters.push({
      title: storyTemplate.chapterTitles.beginning,
      content: generateBeginningChapter(rootPersons, couples, storyTemplate),
      period: calculatePeriodString(rootPersons),
      highlights: rootPersons.map(p => `Lahirnya ${p.fullName}`)
    });
  }

  // Chapter 3: Growing Family (next generations)
  if (generations.length > 1) {
    for (let i = 1; i < Math.min(generations.length, 3); i++) {
      const gen = generations[i];
      chapters.push({
        title: `${storyTemplate.chapterTitles.growth} ${i + 1}`,
        content: generateGenerationChapter(gen, i, storyTemplate),
        period: calculateGenerationPeriod(gen),
        highlights: gen.map(p => p.fullName)
      });
    }
  }

  // Chapter 4: Legacy
  chapters.push({
    title: storyTemplate.chapterTitles.legacy,
    content: generateLegacyChapter(persons, relationships, storyTemplate),
    period: 'Warisan Keluarga',
    highlights: [
      'Tradisi keluarga',
      'Pengorbanan generasi sebelumnya',
      'Harapan untuk generasi mendatang'
    ]
  });

  return {
    title: storyTemplate.titleTemplate.replace('{familyName}', getFamilyName(rootPersons)),
    subtitle: storyTemplate.subtitleTemplate,
    chapters,
    stats: {
      totalMembers: persons.length,
      totalGenerations: generations.length,
      marriages,
      yearsCovered
    },
    generatedAt: new Date(),
    aiGenerated: false
  };
}

// Story templates for different styles
function getStoryTemplate(style: StoryStyle) {
  const templates = {
    formal: {
      titleTemplate: 'Sejarah Keluarga {familyName}',
      subtitleTemplate: 'Dokumentasi genealogi dan narasi historis',
      chapterTitles: {
        introduction: 'Pendahuluan',
        beginning: 'Asal-usul dan Permulaan',
        growth: 'Generasi',
        legacy: 'Warisan dan Tradisi'
      },
      tone: 'Dengan hormat, kami sampaikan dokumentasi keluarga ini...'
    },
    casual: {
      titleTemplate: 'Cerita Keluarga {familyName}',
      subtitleTemplate: 'Perjalanan cinta, tawa, dan kebersamaan',
      chapterTitles: {
        introduction: 'Kenalan dengan Keluarga Kita',
        beginning: 'Awal yang Sederhana',
        growth: 'Keluarga Bertambah Besar',
        legacy: 'Yang Kita Wariskan'
      },
      tone: 'Hai! Mari berkenalan dengan keluarga kita yang luar biasa...'
    },
    emotional: {
      titleTemplate: 'Benang Merah Keluarga {familyName}',
      subtitleTemplate: 'Kisah kasih sayang yang mengalir dari generasi ke generasi',
      chapterTitles: {
        introduction: 'Cinta yang Mengawali Segalanya',
        beginning: 'Mimpi dan Harapan Pertama',
        growth: 'Cahaya-cahaya Baru dalam Hidup',
        legacy: 'Kasih yang Abadi'
      },
      tone: 'Dalam setiap detak jantung keluarga ini, terukir cerita cinta...'
    },
    children: {
      titleTemplate: 'Buku Cerita Keluarga {familyName}',
      subtitleTemplate: 'Kisah keluarga kita yang seru!',
      chapterTitles: {
        introduction: 'Halo, Ini Keluarga Kita!',
        beginning: 'Dulu, Ada Nenek dan Kakek...',
        growth: 'Anak-anak Lahir!',
        legacy: 'Cerita untuk Diceritakan Lagi'
      },
      tone: 'Halo teman-teman! Aku mau cerita tentang keluarga aku yang super seru...'
    },
    poetic: {
      titleTemplate: 'Syair Keluarga {familyName}',
      subtitleTemplate: 'Melodi kehidupan dalam bait-bait cinta',
      chapterTitles: {
        introduction: 'Prolog',
        beginning: 'Bab Pertama: Titik Temu',
        growth: 'Bab-Bab Berikutnya: Pelebaran Sayap',
        legacy: 'Epilog: Abadi'
      },
      tone: 'Pada suatu ketika, dalam lipatan waktu...'
    }
  };

  return templates[style];
}

// Helper functions
function findCouples(persons: Person[], relationships: Relationship[]) {
  const couples: Array<{ person1: Person; person2: Person; marriageDate?: string }> = [];
  
  const spouseRels = relationships.filter(r => r.type === 'SPOUSE');
  
  for (const rel of spouseRels) {
    const p1 = persons.find(p => p.id === rel.fromPersonId);
    const p2 = persons.find(p => p.id === rel.toPersonId);
    
    if (p1 && p2) {
      // Avoid duplicates
      const exists = couples.some(
        c => (c.person1.id === p1.id && c.person2.id === p2.id) ||
             (c.person1.id === p2.id && c.person2.id === p1.id)
      );
      
      if (!exists) {
        couples.push({ person1: p1, person2: p2, marriageDate: rel.meta?.startDate });
      }
    }
  }
  
  return couples;
}

function calculateGenerations(persons: Person[], relationships: Relationship[]) {
  const generations: Person[][] = [];
  const assigned = new Set<string>();
  
  // Find generation 0 (root ancestors)
  let currentGen = persons.filter(p => {
    const hasParents = relationships.some(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === p.id
    );
    return !hasParents;
  });
  
  while (currentGen.length > 0) {
    generations.push(currentGen);
    currentGen.forEach(p => assigned.add(p.id));
    
    // Find next generation (children of current)
    const nextGen: Person[] = [];
    for (const parent of currentGen) {
      const children = relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent.id)
        .map(r => persons.find(p => p.id === r.toPersonId))
        .filter((p): p is Person => p !== undefined && !assigned.has(p.id));
      
      nextGen.push(...children);
    }
    
    currentGen = nextGen;
  }
  
  return generations;
}

function calculateYearsCovered(persons: Person[]) {
  const years = persons
    .map(p => p.birthDate ? new Date(p.birthDate).getFullYear() : null)
    .filter((y): y is number => y !== null);
  
  if (years.length === 0) return 0;
  
  const min = Math.min(...years);
  const max = Math.max(...years);
  
  return max - min;
}

function getFamilyName(rootPersons: Person[]) {
  if (rootPersons.length === 0) return 'Kami';
  
  // Extract last name or use first name
  const name = rootPersons[0].fullName;
  const parts = name.split(' ');
  
  if (parts.length > 1) {
    return parts[parts.length - 1]; // Last name
  }
  
  return name;
}

function calculatePeriodString(persons: Person[]) {
  const years = persons
    .map(p => p.birthDate ? new Date(p.birthDate).getFullYear() : null)
    .filter((y): y is number => y !== null);
  
  if (years.length === 0) return 'Periode tidak diketahui';
  
  const min = Math.min(...years);
  const max = Math.max(...years);
  
  return min === max ? `Tahun ${min}` : `${min} - ${max}`;
}

function calculateGenerationPeriod(gen: Person[]) {
  const years = gen
    .map(p => p.birthDate ? new Date(p.birthDate).getFullYear() : null)
    .filter((y): y is number => y !== null);
  
  if (years.length === 0) return 'Periode tidak diketahui';
  
  return `${Math.min(...years)} - ${Math.max(...years)}`;
}

// Chapter generators
function generateIntroduction(
  rootPersons: Person[],
  couples: Array<{ person1: Person; person2: Person }>,
  template: ReturnType<typeof getStoryTemplate>
) {
  const familyName = getFamilyName(rootPersons);
  
  return `${template.tone}

Keluarga ${familyName} adalah sebuah keluarga yang terdiri dari ${rootPersons.length > 0 ? rootPersons.length : 'beberapa'} generasi. Dimulai dari ${couples.length > 0 ? couples.map(c => `${c.person1.fullName} dan ${c.person2.fullName}`).join(', ') : 'leluhur kita'}, keluarga ini telah tumbuh dan berkembang seiring waktu.

Dalam cerita ini, kita akan menjelajahi perjalanan keluarga ${familyName} - dari awal yang sederhana hingga menjadi keluarga besar yang penuh dengan cinta dan kehangatan.`;
}

function generateBeginningChapter(
  rootPersons: Person[],
  couples: Array<{ person1: Person; person2: Person; marriageDate?: string }>,
  template: ReturnType<typeof getStoryTemplate>
) {
  if (couples.length === 0) {
    return 'Cerita keluarga ini dimulai dari individu-individu yang membentuk fondasi kuat bagi generasi-generasi berikutnya.';
  }
  
  const mainCouple = couples[0];
  const marriageYear = mainCouple.marriageDate 
    ? new Date(mainCouple.marriageDate).getFullYear() 
    : 'suatu tahun';
  
  return `Segalanya dimulai ketika ${mainCouple.person1.fullName} dan ${mainCouple.person2.fullName} memutuskan untuk membangun rumah tangga bersama pada tahun ${marriageYear}. 

Dari pernikahan mereka, lahirlah cinta yang menjadi fondasi bagi seluruh keluarga ini. Mereka memulai perjalanan hidup bersama dengan penuh harapan dan impian - impian untuk membangun keluarga yang penuh kasih sayang dan kebahagiaan.`;
}

function generateGenerationChapter(
  gen: Person[],
  genIndex: number,
  template: ReturnType<typeof getStoryTemplate>
) {
  const names = gen.map(p => p.fullName).join(', ');
  
  return `Generasi ke-${genIndex + 1} keluarga ini membawa warna baru dalam kisah keluarga kita. ${names} ${gen.length > 1 ? 'adalah anggota-anggota' : 'adalah anggota'} yang melanjutkan perjalanan keluarga ini.

${gen.map(p => {
    const birthInfo = p.birthDate 
      ? `lahir pada ${new Date(p.birthDate).toLocaleDateString('id-ID')}` 
      : 'bergabung dalam keluarga ini';
    return `${p.fullName} ${birthInfo}.`;
  }).join(' ')}

Setiap anggota membawa cerita unik mereka sendiri, menambah kekayaan dan keberagaman dalam keluarga besar kita.`;
}

function generateLegacyChapter(
  persons: Person[],
  relationships: Relationship[],
  template: ReturnType<typeof getStoryTemplate>
) {
  const currentGen = persons.filter(p => !p.deathDate);
  const deceased = persons.filter(p => p.deathDate);
  
  return `Seiring berjalannya waktu, keluarga kita telah mengalami banyak perubahan. ${deceased.length > 0 
    ? `Kita telah kehilangan ${deceased.length} anggota tercinta, namun warisan dan kenangan mereka tetap hidup dalam hati kita.` 
    : 'Kita bersyukur masih bisa bersama-sama membentuk kenangan indah.'}

${currentGen.length > 0 
    ? `Saat ini, ${currentGen.length} anggota keluarga masih aktif menulis cerita keluarga ini.` 
    : ''}

Warisan terbesar yang kita miliki bukanlah harta materi, melainkan ikatan cinta dan persaudaraan yang terus mengalir dari generasi ke generasi. Semoga cerita keluarga ini terus berkembang dan menjadi inspirasi bagi generasi yang akan datang.`;
}

// AI Integration (optional enhancement)
export function useStoryGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const generateStory = useCallback(async (
    style: StoryStyle,
    useAI: boolean = false
  ): Promise<GeneratedStory | null> => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    
    abortController.current = new AbortController();

    try {
      // Get data from store
      const { persons, relationships } = useFamilyStore.getState();
      
      if (persons.length === 0) {
        throw new Error('Tidak ada data anggota keluarga untuk membuat cerita');
      }

      setProgress(20);

      let story: GeneratedStory;

      if (useAI) {
        // AI generation (placeholder for future AI integration)
        // For now, use template with AI marker
        story = generateTemplateStory(persons, relationships, style);
        story.aiGenerated = true;
        story.title = `[AI] ${story.title}`;
      } else {
        // Template-based generation
        story = generateTemplateStory(persons, relationships, style);
      }

      setProgress(100);
      return story;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateStoryWithScope = useCallback(async (
    style: StoryStyle,
    scope: StoryScope,
    useAI: boolean = false
  ): Promise<GeneratedStory | null> => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    
    abortController.current = new AbortController();

    try {
      // Get data from store
      const { persons, relationships } = useFamilyStore.getState();
      
      if (persons.length === 0) {
        throw new Error('Tidak ada data anggota keluarga untuk membuat cerita');
      }

      setProgress(20);

      // Filter persons based on scope
      const filteredPersons = filterPersonsByScopeFromSelector(
        persons as Person[],
        relationships,
        scope
      );

      if (filteredPersons.length === 0) {
        throw new Error('Tidak ada anggota keluarga yang cocok dengan scope yang dipilih');
      }

      setProgress(40);

      let story: GeneratedStory;

      if (useAI) {
        // AI generation (placeholder for future AI integration)
        story = generateTemplateStory(filteredPersons, relationships, style);
        story.aiGenerated = true;
        story.title = `[AI] ${story.title}`;
      } else {
        // Template-based generation
        story = generateTemplateStory(filteredPersons, relationships, style);
      }

      setProgress(100);
      return story;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

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
    error
  };
}
