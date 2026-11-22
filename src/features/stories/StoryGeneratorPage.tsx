import { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  Download,
  Share2,
  Clock,
  Users,
  Calendar,
  Heart,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useFamilyStore } from '@/store/familyStore';
import { useStoryGenerator, StoryStyle, GeneratedStory } from '@/services/storyGenerator';
import { StoryDisplay } from '@/features/stories/StoryDisplay';
import { StoryScopeSelector, StoryScope } from '@/features/stories/StoryScopeSelector';
import { exportStoryToPDF, exportStoryToPDFSimple } from '@/services/pdfExport';

const storyStyles: {
  value: StoryStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'casual',
    label: 'Santai',
    description: 'Hangat dan mengalir seperti bercerita dengan keluarga',
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    value: 'formal',
    label: 'Formal',
    description: 'Dokumentasi resmi seperti buku sejarah keluarga',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    value: 'emotional',
    label: 'Emosional',
    description: 'Penuh perasaan, kenangan, dan rasa syukur',
    icon: <Heart className="w-4 h-4" />,
  },
  {
    value: 'children',
    label: 'Cerita Anak',
    description: 'Bahasa ringan untuk mengenalkan silsilah ke anak',
    icon: <Users className="w-4 h-4" />,
  },
  {
    value: 'poetic',
    label: 'Puitis',
    description: 'Bergaya sastra dan reflektif lintas waktu',
    icon: <Sparkles className="w-4 h-4" />,
  },
];

interface StoryGeneratorPageProps {
  onSavedToManual?: () => void;
}

export function StoryGeneratorPage({ onSavedToManual }: StoryGeneratorPageProps) {
  const [selectedStyle, setSelectedStyle] = useState<StoryStyle>('casual');
  const [selectedScope, setSelectedScope] = useState<StoryScope>({
    type: 'full',
    maxGenerations: 6,
    includeSpouses: true,
    includeDeceased: true,
  });
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [activeTab, setActiveTab] = useState('generate');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { addStory } = useFamilyStore();

  const { generateStoryWithScope, isGenerating, progress, error } = useStoryGenerator();

  const handleGenerate = async () => {
    const story = await generateStoryWithScope(selectedStyle, selectedScope);

    if (story) {
      setGeneratedStory(story);
      setActiveTab('preview');
      toast({
        title: 'Cerita Berhasil Dibuat!',
        description: `${story.title} — ${story.stats.totalMembers} anggota dalam ${story.stats.totalGenerations} generasi.`,
      });
    } else if (error) {
      toast({
        title: 'Gagal Membuat Cerita',
        description: error,
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = async () => {
    if (!generatedStory) return;

    try {
      await exportStoryToPDF(generatedStory);
      toast({
        title: 'PDF Berhasil Diunduh!',
        description: `File "${generatedStory.title}" telah disimpan.`,
      });
    } catch {
      try {
        exportStoryToPDFSimple(generatedStory);
        toast({
          title: 'PDF Berhasil Diunduh',
          description: `File "${generatedStory.title}" telah disimpan.`,
        });
      } catch {
        toast({
          title: 'Gagal Membuat PDF',
          description: 'Terjadi kesalahan saat membuat PDF. Silakan coba lagi.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleShare = () => {
    if (!generatedStory) return;
    const text = `${generatedStory.title}\n\n${generatedStory.chapters[0]?.content.substring(0, 180) || ''}...`;

    if (navigator.share) {
      navigator.share({
        title: generatedStory.title,
        text,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(text);
      toast({
        title: 'Tersalin!',
        description: 'Ringkasan cerita telah disalin ke clipboard.',
      });
    }
  };

  const handleSaveStory = async () => {
    if (!generatedStory) return;

    setIsSaving(true);
    try {
      const fullContent = generatedStory.chapters
        .map((chapter) => {
          let chapterText = `## ${chapter.title}\n\n${chapter.content}`;
          if (chapter.highlights.length > 0) {
            chapterText += '\n\nRingkasan:\n';
            chapter.highlights.forEach((h) => {
              chapterText += `• ${h}\n`;
            });
          }
          return chapterText;
        })
        .join('\n\n---\n\n');

      await addStory({
        title: generatedStory.title,
        content: fullContent,
        date: new Date().toISOString().split('T')[0],
        tags: ['Otomatis', selectedStyle],
        personIds: generatedStory.includedPersonIds || [],
      });

      toast({
        title: 'Cerita Tersimpan!',
        description: 'Cerita berhasil disimpan ke daftar Kisah Manual lengkap dengan tokoh terkait.',
      });
      onSavedToManual?.();
    } catch {
      toast({
        title: 'Gagal Menyimpan',
        description: 'Terjadi kesalahan saat menyimpan cerita.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[320px]">
          <TabsTrigger value="generate">Pengaturan</TabsTrigger>
          <TabsTrigger value="preview" disabled={!generatedStory}>
            Pratinjau Cerita
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-5 mt-4">
          {/* Scope Selection */}
          <StoryScopeSelector
            selectedScope={selectedScope}
            onScopeChange={setSelectedScope}
          />

          {/* Style Selection */}
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                Pilih Gaya Narasi
              </CardTitle>
              <CardDescription>
                Sesuaikan nuansa bahasa cerita keluarga Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {storyStyles.map((style) => (
                  <div
                    key={style.value}
                    onClick={() => setSelectedStyle(style.value)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all hover:border-primary ${
                      selectedStyle === style.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          selectedStyle === style.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {style.icon}
                      </div>
                      <span className="font-semibold text-sm">{style.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{style.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generation Progress */}
          {isGenerating && (
            <Card>
              <CardContent className="pt-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Menyusun narasi keluarga...</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto min-w-[220px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Menyusun Cerita...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Buat Cerita Keluarga
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-5 mt-4">
          {generatedStory && (
            <>
              {/* Story Actions */}
              <div className="flex flex-wrap gap-2 justify-between items-center">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    <Users className="w-3 h-3 mr-1" />
                    {generatedStory.stats.totalMembers} Anggota
                  </Badge>
                  <Badge variant="secondary">
                    <Clock className="w-3 h-3 mr-1" />
                    {generatedStory.stats.totalGenerations} Generasi
                  </Badge>
                  {generatedStory.stats.yearsCovered > 0 && (
                    <Badge variant="secondary">
                      <Calendar className="w-3 h-3 mr-1" />
                      {generatedStory.stats.yearsCovered} Tahun
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    <Heart className="w-3 h-3 mr-1" />
                    {generatedStory.stats.marriages} Pasangan
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Bagikan
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    PDF
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleSaveStory} disabled={isSaving}>
                    <Save className={`w-3.5 h-3.5 mr-1.5 ${isSaving ? 'animate-pulse' : ''}`} />
                    {isSaving ? 'Menyimpan...' : 'Simpan ke Kisah'}
                  </Button>
                  <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    Perbarui
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Story Display */}
              <StoryDisplay story={generatedStory} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
