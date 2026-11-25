import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Cropper, { Area } from 'react-easy-crop';
import { uploadAvatar, deleteAvatar } from '@/lib/avatarStorage';
import { useFamilyStore } from '@/store/familyStore';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca gambar'));
    reader.readAsDataURL(file);
  });
}

interface PhotoUploaderProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (photoUrl: string | null) => void;
  onPhotoDelete?: () => void;
}

export function PhotoUploader({ currentPhotoUrl, onPhotoChange, onPhotoDelete }: PhotoUploaderProps) {
  const { isDemoMode, isPrivateMode } = useFamilyStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const createCroppedImage = async (): Promise<File | null> => {
    if (!previewUrl || !croppedAreaPixels || !selectedFile) return null;

    return new Promise((resolve) => {
      const image = new Image();
      image.src = previewUrl;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(null);
          return;
        }

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const croppedFile = new File([blob], selectedFile.name, {
            type: selectedFile.type,
          });
          resolve(croppedFile);
        }, selectedFile.type);
      };
    });
  };

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      
      // Create cropped image
      const croppedFile = await createCroppedImage();
      if (!croppedFile) {
        toast.error('Gagal memproses gambar');
        return;
      }

      // Delete old avatar if exists in cloud mode
      if (currentPhotoUrl && !isDemoMode && !isPrivateMode && !currentPhotoUrl.startsWith('data:')) {
        try {
          await deleteAvatar(currentPhotoUrl);
        } catch (error) {
          console.error('Failed to delete old avatar:', error);
          // Continue with upload even if delete fails
        }
      }

      // Encode locally in Private/Demo mode, or upload to Supabase Storage in Cloud mode
      const photoUrl =
        isDemoMode || isPrivateMode
          ? await fileToDataUrl(croppedFile)
          : await uploadAvatar(croppedFile);

      onPhotoChange(photoUrl);
      toast.success('Foto berhasil diunggah');

      // Reset states
      setShowCropDialog(false);
      setPreviewUrl(null);
      setSelectedFile(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengunggah foto');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPhotoUrl) return;

    try {
      if (!isDemoMode && !isPrivateMode && !currentPhotoUrl.startsWith('data:')) {
        await deleteAvatar(currentPhotoUrl);
      }
      onPhotoChange(null);
      onPhotoDelete?.();
      toast.success('Foto berhasil dihapus');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus foto');
    }
  };

  return (
    <>
      <div className="space-y-3">
        {/* Current Photo Preview */}
        {currentPhotoUrl && (
          <div className="relative inline-block">
            <img
              src={currentPhotoUrl}
              alt="Current avatar"
              className="w-24 h-24 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                e.currentTarget.src = '';
                e.currentTarget.style.display = 'none';
              }}
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleDelete}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragging ? 'Lepas file di sini' : 'Klik atau drag & drop'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG atau WEBP (max. 2MB)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sesuaikan Foto</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cropper */}
            <div className="relative h-64 bg-muted rounded-lg overflow-hidden">
              {previewUrl && (
                <Cropper
                  image={previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Zoom Slider */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCropDialog(false);
                setPreviewUrl(null);
                setSelectedFile(null);
              }}
              disabled={isUploading}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Gunakan Foto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
