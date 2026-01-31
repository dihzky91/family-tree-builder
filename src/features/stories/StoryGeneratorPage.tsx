import { useState } from 'react';
import { BookOpen, Sparkles, RefreshCw, Download, Share2, ChevronRight, Clock, Users, Calendar, Heart, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useFamilyStore } from '@/store/familyStore';
import { useStoryGenerator, StoryStyle, GeneratedStory } from '@/services/storyGenerator';
import { StoryDisplay } from '@/features/stories/StoryDisplay';
import { StoryScopeSelector, StoryScope, filterPersonsByScope } from '@/features/stories/StoryScopeSelector';
import { exportStoryToPDF, exportStoryToPDFSimple } from '@/services/pdfExport';

const storyStyles: { value: StoryStyle; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'casual',
    label: 'Casual',
    description: 'Cerita santai seperti bercerita dengan teman',
    icon: <BookOpen className="w-4 h-4" />
  },
  {
    value: 'formal',
    label: 'Formal',
    description: 'Dokumentasi resmi seperti buku sejarah',
    icon: <Clock className="w-4 h-4" />
  },
  {
    value: 'emotional',
    label: 'Emosional',
    description: 'Penuh perasaan dan sentimen hangat',
    icon: <Heart className="w-4 h-4" />
  },
  {
    value: 'children',
    label: 'Cerita Anak',
    description: 'Bahasa sederhana untuk anak-anak',
    icon: <Users className="w-4 h-4" />
  },
  {
    value: 'poetic',
    label: 'Puitis',
    description: 'Bergaya puisi dan melodi',
    icon: <Sparkles className="w-4 h-4" />
  }
];

export function StoryGeneratorPage() {
  const [selectedStyle, setSelectedStyle] = useState<StoryStyle>('casual');
  const [selectedScope, setSelectedScope] = useState<StoryScope>({
    type: 'full',
    maxGenerations: 5,
    includeSpouses: true,
    includeDeceased: true,
  });
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [activeTab, setActiveTab] = useState('generate');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { addStory } = useFamilyStore();
  
  const {
    generateStoryWithScope,
    isGenerating,
    progress,
    error
  } = useStoryGenerator();

  const handleGenerate = async () => {
    const story = await generateStoryWithScope(selectedStyle, selectedScope, false);
    
    if (story) {
      setGeneratedStory(story);
      setActiveTab('preview');
      toast({
        title: 'Cerita Berhasil Dibuat!',
        description: `Keluarga ${story.title.replace('Cerita Keluarga ', '')} memiliki ${story.stats.totalMembers} anggota dalam ${story.stats.totalGenerations} generasi.`,
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
      // Use enhanced PDF export with professional styling
      await exportStoryToPDF(generatedStory);
      toast({
        title: 'PDF Berhasil Dibuat!',
        description: `File "cerita-${generatedStory.title.replace(/\s+/g, '-').toLowerCase()}.pdf" telah diunduh dengan styling profesional.`,
      });
    } catch (error) {
      // Fallback to simple export if enhanced fails
      try {
        exportStoryToPDFSimple(generatedStory);
        toast({
          title: 'PDF Berhasil Dibuat (Simplified)',
          description: `File "cerita-${generatedStory.title.replace(/\s+/g, '-').toLowerCase()}.pdf" telah diunduh.`,
        });
      } catch (fallbackError) {
        toast({
          title: 'Gagal Membuat PDF',
          description: 'Terjadi kesalahan saat membuat PDF. Silakan coba lagi.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleShare = () => {
    if (generatedStory) {
      const text = `Baca cerita keluarga kami: ${generatedStory.title}\n\n${generatedStory.chapters[0].content.substring(0, 100)}...`;
      
      if (navigator.share) {
        navigator.share({
          title: generatedStory.title,
          text: text,
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(text);
        toast({
          title: 'Tersalin!',
          description: 'Cerita telah disalin ke clipboard.',
        });
      }
    }
  };

  const handleSaveStory = async () => {
    if (!generatedStory) return;
    
    setIsSaving(true);
    try {
      // Convert chapters content to full story content
      const fullContent = generatedStory.chapters.map(chapter => {
        let chapterText = `## ${chapter.title}\n\n`;
        chapterText += chapter.content;
        if (chapter.highlights.length > 0) {
          chapterText += '\n\n**Momen Penting:**\n';
          chapter.highlights.forEach(highlight => {
            chapterText += `• ${highlight}\n`;
          });
        }
        return chapterText;
      }).join('\n\n---\n\n');

      await addStory({
        title: generatedStory.title,
        content: fullContent,
        tags: ['AI Generated', 'Generated Story', generatedStory.aiGenerated ? 'AI' : 'Template'],
        personIds: [], // Could be populated based on the scope
      });

      toast({
        title: 'Cerita Tersimpan!',
        description: 'Cerita berhasil disimpan ke daftar kisah keluarga.',
      });
    } catch (error) {
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
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Generator Cerita Keluarga</h1>
        <p className="text-muted-foreground">
          Ubah data silsilah keluarga Anda menjadi cerita menarik yang bisa dibaca dan dibagikan
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="preview" disabled={!generatedStory}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          {/* Scope Selection */}
          <StoryScopeSelector 
            selectedScope={selectedScope} 
            onScopeChange={setSelectedScope} 
          />

          {/* Style Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Pilih Gaya Cerita
              </CardTitle>
              <CardDescription>
                Bagaimana Anda ingin cerita keluarga diceritakan?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storyStyles.map((style) => (
                  <div
                    key={style.value}
                    onClick={() => setSelectedStyle(style.value)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                      selectedStyle === style.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-md ${
                        selectedStyle === style.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {style.icon}
                      </div>
                      <span className="font-semibold">{style.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {style.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generation Progress */}
          {isGenerating && (
            <Card>
              <CardContent className="pt-6">
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Membuat cerita...</span>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Menganalisis struktur keluarga dan menghasilkan narasi
                  </p>
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
              className="w-full md:w-auto min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Membuat Cerita...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Generate Cerita
                </>
              )}
            </Button>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Otomatis</p>
                    <p className="text-xs text-muted-foreground">
                      Generate dari data yang ada
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Kronologis</p>
                    <p className="text-xs text-muted-foreground">
                      Berdasarkan tanggal lahir & peristiwa
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Export</p>
                    <p className="text-xs text-muted-foreground">
                      Simpan atau bagikan cerita
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {generatedStory && (
            <>
              {/* Story Actions */}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Bagikan
                </Button>
                <Button variant="outline" onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="secondary" onClick={handleSaveStory} disabled={isSaving}>
                  <Save className={`w-4 h-4 mr-2 ${isSaving ? 'animate-pulse' : ''}`} />
                  {isSaving ? 'Menyimpan...' : 'Simpan Cerita'}
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  Generate Ulang
                </Button>
              </div>

              {/* Story Stats */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {generatedStory.stats.totalMembers} Anggota
                </Badge>
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  {generatedStory.stats.totalGenerations} Generasi
                </Badge>
                <Badge variant="secondary">
                  <Calendar className="w-3 h-3 mr-1" />
                  {generatedStory.stats.yearsCovered} Tahun
                </Badge>
                <Badge variant="secondary">
                  <Heart className="w-3 h-3 mr-1" />
                  {generatedStory.stats.marriages} Pernikahan
                </Badge>
                {generatedStory.aiGenerated && (
                  <Badge variant="default">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Generated
                  </Badge>
                )}
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
