import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen,
  Plus,
  Calendar,
  Tag,
  Trash2,
  Edit,
  Sparkles,
  Search,
  X,
  Users,
  GitBranch,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Story } from '@/types';
import { StoryGeneratorPage } from '@/features/stories/StoryGeneratorPage';
import { formatFlexibleDate } from '@/lib/flexibleDateUtils';

export default function StoriesPage() {
  const { stories, persons, addStory, updateStory, deleteStory } = useFamilyStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'manual' | 'generate'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [personPickerQuery, setPersonPickerQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentStory, setCurrentStory] = useState<Partial<Story>>({});
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);

  const personNameMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p.fullName])),
    [persons]
  );

  const filteredStories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((story) => {
      if (story.title.toLowerCase().includes(q)) return true;
      if (story.content.toLowerCase().includes(q)) return true;
      if (story.tags.some((t) => t.toLowerCase().includes(q))) return true;
      if (
        story.personIds.some((id) =>
          (personNameMap.get(id) || '').toLowerCase().includes(q)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [stories, searchQuery, personNameMap]);

  const pickerCandidates = useMemo(() => {
    const selected = new Set(currentStory.personIds || []);
    const q = personPickerQuery.trim().toLowerCase();
    return persons
      .filter((p) => !selected.has(p.id))
      .filter((p) => (!q ? true : p.fullName.toLowerCase().includes(q)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'))
      .slice(0, 8);
  }, [persons, currentStory.personIds, personPickerQuery]);

  const handleSave = async () => {
    if (!currentStory.title?.trim()) return;

    if (currentStory.id) {
      await updateStory(currentStory.id, {
        ...currentStory,
        title: currentStory.title.trim(),
      });
    } else {
      await addStory({
        title: currentStory.title.trim(),
        content: currentStory.content || '',
        date: currentStory.date,
        tags: currentStory.tags || [],
        personIds: currentStory.personIds || [],
        authorId: null,
      });
    }

    setIsEditing(false);
    setCurrentStory({});
    setPersonPickerQuery('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteStory(deleteTarget.id);
    if (viewStory?.id === deleteTarget.id) {
      setViewStory(null);
    }
    setDeleteTarget(null);
  };

  const addLinkedPerson = (personId: string) => {
    setCurrentStory((s) => ({
      ...s,
      personIds: Array.from(new Set([...(s.personIds || []), personId])),
    }));
    setPersonPickerQuery('');
  };

  const removeLinkedPerson = (personId: string) => {
    setCurrentStory((s) => ({
      ...s,
      personIds: (s.personIds || []).filter((id) => id !== personId),
    }));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-primary shrink-0" />
            Kisah Keluarga
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
            Dokumentasikan sejarah, biografi, dan kenangan keluarga
          </p>
        </div>
        <Button
          onClick={() => {
            setCurrentStory({ personIds: [], tags: [] });
            setIsEditing(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tulis Kisah
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'generate')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-5">
          <TabsTrigger value="manual">
            <BookOpen className="w-4 h-4 mr-2" />
            Kisah Manual ({stories.length})
          </TabsTrigger>
          <TabsTrigger value="generate">
            <Sparkles className="w-4 h-4 mr-2" />
            Generator Otomatis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          {stories.length > 0 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari judul, isi, tag, atau nama tokoh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {stories.length === 0 ? (
            <div className="py-16 px-4 text-center border-2 border-dashed rounded-2xl bg-muted/30">
              <BookOpen className="w-14 h-14 mx-auto mb-3 opacity-25" />
              <h2 className="text-lg sm:text-xl font-medium">Belum ada kisah tersimpan</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                Tulis kisah keluarga secara manual atau susun otomatis dari data silsilah di tab Generator Otomatis.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrentStory({ personIds: [], tags: [] });
                    setIsEditing(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Mulai Menulis
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('generate')}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Coba Generator Otomatis
                </Button>
              </div>
            </div>
          ) : filteredStories.length === 0 ? (
            <div className="py-14 text-center border rounded-2xl bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Tidak ada kisah yang cocok dengan kata kunci "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredStories.map((story) => (
                <Card
                  key={story.id}
                  className="group cursor-pointer hover:shadow-lg transition-all overflow-hidden flex flex-col rounded-2xl"
                  onClick={() => setViewStory(story)}
                >
                  <div className="h-28 bg-primary/5 p-5 flex flex-col justify-between relative overflow-hidden">
                    <BookOpen className="absolute -right-4 -bottom-4 w-20 h-20 text-primary/10 rotate-12" />
                    <div className="relative z-10">
                      <h3 className="font-display font-bold text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                        {story.title}
                      </h3>
                    </div>
                    {story.date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground relative z-10">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {formatFlexibleDate(story.date) || story.date}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <p className="text-sm text-foreground/75 line-clamp-3 flex-1">
                      {story.content.replace(/[#*]/g, '')}
                    </p>

                    {story.personIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Users className="w-3 h-3 text-muted-foreground mr-0.5 shrink-0" />
                        {story.personIds.slice(0, 2).map((pid) => (
                          <Badge key={pid} variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                            {personNameMap.get(pid) || 'Anggota'}
                          </Badge>
                        ))}
                        {story.personIds.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{story.personIds.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {story.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-auto">
                        {story.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate">
          <StoryGeneratorPage onSavedToManual={() => setActiveTab('manual')} />
        </TabsContent>
      </Tabs>

      {/* Editor Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl max-h-[88dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">
              {currentStory.id ? 'Edit Kisah' : 'Tulis Kisah Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
            <Input
              placeholder="Judul Kisah..."
              className="text-base sm:text-lg font-bold"
              value={currentStory.title || ''}
              onChange={(e) => setCurrentStory((s) => ({ ...s, title: e.target.value }))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="date"
                value={currentStory.date || ''}
                onChange={(e) => setCurrentStory((s) => ({ ...s, date: e.target.value }))}
              />
              <Input
                placeholder="Tags (pisahkan koma)"
                value={currentStory.tags?.join(', ') || ''}
                onChange={(e) =>
                  setCurrentStory((s) => ({
                    ...s,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>

            {/* Linked Persons Picker */}
            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Tokoh Terkait ({currentStory.personIds?.length || 0})
              </Label>
              {currentStory.personIds && currentStory.personIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentStory.personIds.map((pid) => (
                    <Badge key={pid} variant="secondary" className="gap-1 pr-1">
                      <span>{personNameMap.get(pid) || 'Anggota'}</span>
                      <button
                        type="button"
                        onClick={() => removeLinkedPerson(pid)}
                        aria-label="Hapus tokoh"
                        className="rounded-full p-0.5 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Input
                placeholder="Cari & tambahkan nama tokoh..."
                value={personPickerQuery}
                onChange={(e) => setPersonPickerQuery(e.target.value)}
                className="h-9 text-xs"
              />
              {personPickerQuery.trim().length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pickerCandidates.length > 0 ? (
                    pickerCandidates.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addLinkedPerson(p.id)}
                        className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {p.fullName}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Tidak ditemukan</span>
                  )}
                </div>
              )}
            </div>

            <Textarea
              placeholder="Tulis kisah Anda di sini..."
              className="min-h-[240px] text-sm sm:text-base leading-relaxed"
              value={currentStory.content || ''}
              onChange={(e) => setCurrentStory((s) => ({ ...s, content: e.target.value }))}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={!currentStory.title?.trim()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewStory} onOpenChange={(o) => !o && setViewStory(null)}>
        <DialogContent className="max-w-3xl max-h-[88dvh] overflow-y-auto">
          {viewStory && (
            <div className="space-y-5">
              <div className="border-b pb-4 pr-6">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold leading-tight">
                    {viewStory.title}
                  </h2>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentStory(viewStory);
                        setIsEditing(true);
                        setViewStory(null);
                      }}
                      aria-label="Edit kisah"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(viewStory)}
                      aria-label="Hapus kisah"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-3 text-xs sm:text-sm text-muted-foreground">
                  {viewStory.date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatFlexibleDate(viewStory.date) || viewStory.date}
                    </div>
                  )}
                  {viewStory.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3.5 h-3.5" />
                      {viewStory.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {viewStory.personIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                      <Users className="w-3.5 h-3.5" /> Tokoh:
                    </span>
                    {viewStory.personIds.map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          setViewStory(null);
                          navigate(`/chart?focus=${pid}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                      >
                        <GitBranch className="w-3 h-3" />
                        {personNameMap.get(pid) || 'Anggota'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                {viewStory.content.split('\n').map((para, i) => {
                  const trimmed = para.trim();
                  if (!trimmed) return null;
                  if (trimmed === '---') return <hr key={i} className="my-4" />;
                  if (trimmed.startsWith('## ')) {
                    return (
                      <h3 key={i} className="font-display text-lg font-semibold mt-5 mb-2">
                        {trimmed.replace(/^##\s+/, '')}
                      </h3>
                    );
                  }
                  return (
                    <p key={i} className="mb-3 leading-relaxed">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kisah?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus kisah <strong>{deleteTarget?.title}</strong> secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
