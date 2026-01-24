import { toast } from 'sonner';

export type PaperSize = 'a4' | 'a3';

interface PrintOptions {
  paperSize: PaperSize;
  orientation?: 'portrait' | 'landscape';
  title?: string;
}

const PAPER_DIMENSIONS = {
  a4: { width: '210mm', height: '297mm' },
  a3: { width: '297mm', height: '420mm' },
};

export function printTree(element: HTMLElement, options: PrintOptions): void {
  const { paperSize, orientation = 'landscape', title = 'Silsilah Keluarga' } = options;

  // Create print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    toast.error('Popup diblokir. Izinkan popup untuk mencetak.');
    return;
  }

  // Clone the element
  const clonedContent = element.cloneNode(true) as HTMLElement;
  
  // Remove interactive elements and buttons
  clonedContent.querySelectorAll('button').forEach(btn => {
    if (btn.classList.contains('placeholder-node') || btn.textContent?.includes('+')) {
      btn.remove();
    }
  });

  // Get paper dimensions
  const paper = PAPER_DIMENSIONS[paperSize];
  const width = orientation === 'landscape' ? paper.height : paper.width;
  const height = orientation === 'landscape' ? paper.width : paper.height;

  // Build print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page {
          size: ${paperSize} ${orientation};
          margin: 15mm;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: white;
          color: #1a1a1a;
          padding: 10mm;
        }
        
        .print-header {
          text-align: center;
          margin-bottom: 8mm;
          padding-bottom: 5mm;
          border-bottom: 2px solid #8B7355;
        }
        
        .print-header h1 {
          font-size: 24pt;
          color: #5D4E37;
          margin-bottom: 2mm;
        }
        
        .print-header .date {
          font-size: 10pt;
          color: #666;
        }
        
        .print-content {
          width: 100%;
          overflow: visible;
        }
        
        .print-content * {
          transform: none !important;
        }
        
        /* Person card styles */
        .person-card, [class*="PersonNode"] {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 12px;
          border: 2px solid #ccc;
          border-radius: 8px;
          background: #fafafa;
          margin: 4px;
        }
        
        .person-card.male, [class*="border-node-male"] {
          border-color: #6B8CAE;
          background: #E8F0F8;
        }
        
        .person-card.female, [class*="border-node-female"] {
          border-color: #C4869B;
          background: #FCE8EF;
        }
        
        /* Avatar placeholder for print */
        .avatar-print {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ddd;
          margin-bottom: 4px;
        }
        
        /* Generation headers */
        .generation-header {
          font-size: 14pt;
          font-weight: bold;
          color: #5D4E37;
          margin: 6mm 0 4mm 0;
          padding: 2mm 4mm;
          background: #F5F0E8;
          border-radius: 4mm;
          display: inline-block;
        }
        
        /* Family unit container */
        .family-unit {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 4mm;
          margin: 2mm;
          border: 1px dashed #ccc;
          border-radius: 3mm;
          background: #fefefe;
        }
        
        /* Heart connector */
        .heart-connector {
          color: #C4869B;
          margin: 0 2mm;
        }
        
        /* Vertical connector */
        .connector-line {
          width: 1px;
          height: 4mm;
          background: #999;
          margin: 2mm 0;
        }
        
        /* Hide elements not needed for print */
        .no-print,
        [class*="placeholder"],
        [class*="Placeholder"],
        button:has(.lucide-plus),
        .ring-2,
        .ring-offset-2 {
          display: none !important;
        }
        
        /* Footer */
        .print-footer {
          position: fixed;
          bottom: 10mm;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 8pt;
          color: #999;
        }
        
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>${title}</h1>
        <div class="date">Dicetak pada: ${new Date().toLocaleDateString('id-ID', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>
      
      <div class="print-content">
        ${clonedContent.innerHTML}
      </div>
      
      <div class="print-footer">
        Silsilah Keluarga - Halaman 1
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
}

// Utility to prepare element for printing (removes interactive elements)
export function prepareForPrint(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove placeholder buttons
  clone.querySelectorAll('[class*="Placeholder"]').forEach(el => el.remove());
  clone.querySelectorAll('button').forEach(btn => {
    const text = btn.textContent || '';
    if (text.includes('+') || text.includes('Tambah')) {
      btn.remove();
    }
  });
  
  // Reset transforms
  clone.style.transform = 'none';
  
  return clone;
}
