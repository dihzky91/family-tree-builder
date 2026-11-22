import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, BookOpen, Clock, Quote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { GeneratedStory, StoryChapter } from '@/services/storyGenerator';

interface StoryDisplayProps {
  story: GeneratedStory;
}

function ChapterCard({
  chapter,
  index,
  isExpanded,
  onToggle,
}: {
  chapter: StoryChapter;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.3) }}
    >
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader
          className="cursor-pointer hover:bg-muted/40 transition-colors p-4 sm:p-5"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-[11px]">
                  Bab {index + 1}
                </Badge>
                <span className="text-xs text-muted-foreground">{chapter.period}</span>
              </div>
              <CardTitle className="text-base sm:text-lg font-display leading-snug">
                {chapter.title}
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={isExpanded ? 'Tutup bab' : 'Buka bab'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                <Separator className="mb-4" />

                {/* Chapter Content */}
                <div className="prose prose-sm max-w-none">
                  {chapter.content.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-3.5 text-sm sm:text-[15px] text-foreground/90 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Highlights */}
                {chapter.highlights.length > 0 && (
                  <div className="mt-5 p-3.5 bg-muted/45 rounded-xl border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Quote className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Ringkasan Bab
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {chapter.highlights.map((highlight, idx) => (
                        <li key={idx} className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export function StoryDisplay({ story }: StoryDisplayProps) {
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    story.chapters.forEach((_, idx) => {
      initial[idx] = idx <= 1; // Open first 2 chapters by default
    });
    return initial;
  });

  // Reset expansion state when a new story is generated
  useEffect(() => {
    const next: Record<number, boolean> = {};
    story.chapters.forEach((_, idx) => {
      next[idx] = idx <= 1;
    });
    setExpandedMap(next);
  }, [story]);

  const allExpanded =
    story.chapters.length > 0 && story.chapters.every((_, idx) => Boolean(expandedMap[idx]));

  const handleToggleAll = () => {
    const nextState = !allExpanded;
    const next: Record<number, boolean> = {};
    story.chapters.forEach((_, idx) => {
      next[idx] = nextState;
    });
    setExpandedMap(next);
  };

  const handleToggleChapter = (idx: number) => {
    setExpandedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-5">
      {/* Story Header */}
      <div className="text-center space-y-2 py-3 sm:py-5">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold mb-1.5">{story.title}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">{story.subtitle}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Dibuat pada{' '}
              {story.generatedAt.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Expand/Collapse All */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{story.chapters.length} bab cerita</span>
        <Button variant="outline" size="sm" onClick={handleToggleAll} className="h-8 text-xs">
          {allExpanded ? 'Tutup Semua Bab' : 'Buka Semua Bab'}
        </Button>
      </div>

      {/* Chapters */}
      <div className="space-y-3">
        {story.chapters.map((chapter, index) => (
          <ChapterCard
            key={`${story.title}-${index}`}
            chapter={chapter}
            index={index}
            isExpanded={Boolean(expandedMap[index])}
            onToggle={() => handleToggleChapter(index)}
          />
        ))}
      </div>

      {/* Story Footer */}
      <div className="text-center py-4 text-muted-foreground">
        <Separator className="mb-4" />
        <p className="text-xs sm:text-sm italic">
          "Setiap keluarga memiliki ceritanya sendiri. Inilah jejak cerita kita."
        </p>
      </div>
    </div>
  );
}
