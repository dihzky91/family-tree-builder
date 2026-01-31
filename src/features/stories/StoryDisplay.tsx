import { useState } from 'react';
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

function ChapterCard({ chapter, index }: { chapter: StoryChapter; index: number }) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden">
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  Bab {index + 1}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {chapter.period}
                </span>
              </div>
              <CardTitle className="text-lg font-display">
                {chapter.title}
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
          </div>
        </CardHeader>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                
                {/* Chapter Content */}
                <div className="prose prose-sm max-w-none">
                  {chapter.content.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-foreground/90 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Highlights */}
                {chapter.highlights.length > 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Quote className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Momen Penting</span>
                    </div>
                    <ul className="space-y-1">
                      {chapter.highlights.map((highlight, idx) => (
                        <li 
                          key={idx} 
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <span className="text-primary mt-1">•</span>
                          {highlight}
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
  const [expandedAll, setExpandedAll] = useState(false);

  return (
    <div className="space-y-5">
      {/* Story Header */}
      <div className="text-center space-y-3 py-4 md:py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            {story.title}
          </h1>
          <p className="text-lg text-muted-foreground">
            {story.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Dibuat pada {story.generatedAt.toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</span>
          </div>
        </motion.div>
      </div>

      {/* Expand/Collapse All */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setExpandedAll(!expandedAll)}
        >
          {expandedAll ? 'Tutup Semua' : 'Buka Semua'}
        </Button>
      </div>

      {/* Chapters */}
      <div className="space-y-4">
        {story.chapters.map((chapter, index) => (
          <ChapterCard 
            key={index} 
            chapter={chapter} 
            index={index}
          />
        ))}
      </div>

      {/* Story Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-6 text-muted-foreground"
      >
        <Separator className="mb-6" />
        <p className="text-sm italic">
          "Setiap keluarga memiliki ceritanya sendiri. Inilah cerita kita."
        </p>
      </motion.div>
    </div>
  );
}
