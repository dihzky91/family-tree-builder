import { toPng, toSvg } from 'html-to-image';
import { toast } from 'sonner';

export type ExportFormat = 'png' | 'svg';

interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  backgroundColor?: string;
  scale?: number;
}

export async function exportTreeAsImage(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  const { format, filename = 'family-tree', backgroundColor = '#ffffff', scale = 2 } = options;

  try {
    toast.loading('Menyiapkan export...', { id: 'export' });

    // Clone element to avoid modifying the original
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Apply export-friendly styles
    clonedElement.style.transform = 'none';
    clonedElement.style.overflow = 'visible';

    const exportFn = format === 'png' ? toPng : toSvg;
    
    const dataUrl = await exportFn(element, {
      backgroundColor,
      pixelRatio: scale,
      cacheBust: true,
      style: {
        transform: 'none',
      },
      filter: (node) => {
        // Filter out any elements that shouldn't be exported
        if (node instanceof Element) {
          // Skip scroll areas internal elements that cause issues
          if (node.classList?.contains('scrollbar')) return false;
        }
        return true;
      }
    });

    // Download file
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.${format}`;
    link.href = dataUrl;
    link.click();

    toast.success('Silsilah berhasil di-export!', { id: 'export' });
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Gagal meng-export silsilah', { id: 'export' });
  }
}

export async function copyTreeToClipboard(element: HTMLElement): Promise<void> {
  try {
    toast.loading('Menyalin ke clipboard...', { id: 'copy' });

    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    });

    // Convert to blob and copy
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);

    toast.success('Silsilah berhasil disalin ke clipboard!', { id: 'copy' });
  } catch (error) {
    console.error('Copy failed:', error);
    toast.error('Gagal menyalin ke clipboard', { id: 'copy' });
  }
}
