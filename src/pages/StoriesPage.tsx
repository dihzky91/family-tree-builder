import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Plus, Calendar, Tag, User, Save, Trash2, Edit, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Story } from '@/types';
import { StoryGeneratorPage } from '@/features/stories/StoryGeneratorPage';

export default function StoriesPage() {
    const { stories, persons, addStory, updateStory, deleteStory } = useFamilyStore();
    const [isEditing, setIsEditing] = useState(false);
    const [currentStory, setCurrentStory] = useState<Partial<Story>>({});

    // View mode
    const [viewStory, setViewStory] = useState<Story | null>(null);

    const handleSave = async () => {
        if (!currentStory.title) return;

        if (currentStory.id) {
            await updateStory(currentStory.id, currentStory);
        } else {
            await addStory({
                title: currentStory.title,
                content: currentStory.content || '',
                date: currentStory.date,
                tags: currentStory.tags || [],
                personIds: currentStory.personIds || [],
                authorId: null, // current user?
            });
        }

        setIsEditing(false);
        setCurrentStory({});
    };

    const handleDelete = async (id: string) => {
        if (confirm('Apakah Anda yakin ingin menghapus cerita ini?')) {
            await deleteStory(id);
            setViewStory(null);
        }
    };

    const getPersonName = (id: string) => persons.find(p => p.id === id)?.fullName || 'Unknown';

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-fade-in max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-primary" />
                        Kisah Keluarga
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Dokumentasikan sejarah, biografi, dan kenangan keluarga
                    </p>
                </div>
                <Button onClick={() => { setCurrentStory({}); setIsEditing(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tulis Kisah
                </Button>
            </div>

            <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
                    <TabsTrigger value="manual">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Kisah Manual
                    </TabsTrigger>
                    <TabsTrigger value="generate">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate AI
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                    {stories.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed rounded-xl bg-muted/30">
                            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <h2 className="text-xl font-medium">Belum ada kisah</h2>
                            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                                Mulailah menulis kisah pertama keluarga Anda. Ceritakan tentang asal-usul, perjuangan, atau momen berkesan.
                            </p>
                            <Button className="mt-6" variant="secondary" onClick={() => { setCurrentStory({}); setIsEditing(true); }}>
                                Mulai Menulis
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stories.map(story => (
                                <Card
                                    key={story.id}
                                    className="group cursor-pointer hover:shadow-lg transition-all overflow-hidden flex flex-col"
                                    onClick={() => setViewStory(story)}
                                >
                                    <div className="h-32 bg-primary/5 p-6 flex flex-col justify-between relative overflow-hidden">
                                        <BookOpen className="absolute -right-4 -bottom-4 w-24 h-24 text-primary/10 rotate-12" />
                                        <div className="relative z-10">
                                            <h3 className="font-display font-bold text-xl line-clamp-2 leading-tight">
                                                {story.title}
                                            </h3>
                                        </div>
                                        {story.date && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground relative z-10">
                                                <Calendar className="w-3 h-3" />
                                                <span>{new Date(story.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col">
                                        <p className="text-sm text-foreground/70 line-clamp-3 mb-4 flex-1">
                                            {story.content}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-auto">
                                            {story.tags.slice(0, 3).map(tag => (
                                                <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="generate">
                    <StoryGeneratorPage />
                </TabsContent>
            </Tabs>

            {/* Editor Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{currentStory.id ? 'Edit Kisah' : 'Tulis Kisah Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
                        <Input
                            placeholder="Judul Kisah..."
                            className="text-lg font-bold"
                            value={currentStory.title || ''}
                            onChange={e => setCurrentStory(s => ({ ...s, title: e.target.value }))}
                        />
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={currentStory.date || ''}
                                onChange={e => setCurrentStory(s => ({ ...s, date: e.target.value }))}
                                className="w-auto"
                            />
                            <Input
                                placeholder="Tags (pisahkan koma)"
                                value={currentStory.tags?.join(', ') || ''}
                                onChange={e => setCurrentStory(s => ({ ...s, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                            />
                        </div>
                        <Textarea
                            placeholder="Tulis kisah Anda di sini..."
                            className="min-h-[300px] text-base leading-relaxed"
                            value={currentStory.content || ''}
                            onChange={e => setCurrentStory(s => ({ ...s, content: e.target.value }))}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>Batal</Button>
                        <Button onClick={handleSave}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewStory} onOpenChange={(o) => !o && setViewStory(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {viewStory && (
                        <div className="space-y-6">
                            <div className="border-b pb-4">
                                <div className="flex items-start justify-between">
                                    <h2 className="text-3xl font-display font-bold">{viewStory.title}</h2>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            setCurrentStory(viewStory);
                                            setIsEditing(true);
                                            setViewStory(null);
                                        }}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(viewStory.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                    {viewStory.date && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(viewStory.date).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                                        </div>
                                    )}
                                    {viewStory.tags.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-4 h-4" />
                                            <div className="flex gap-1">
                                                {viewStory.tags.map(tag => (
                                                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                                {viewStory.content.split('\n').map((para, i) => (
                                    <p key={i} className="mb-4">{para}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
