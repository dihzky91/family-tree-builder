import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { GeneratedStory, StoryChapter } from './storyGenerator';

// Color scheme for professional PDF - defined as RGB tuples
const PRIMARY_R = 139, PRIMARY_G = 90, PRIMARY_B = 43; // Warm brown
const SECONDARY_R = 101, SECONDARY_G = 67, SECONDARY_B = 33; // Darker brown
const ACCENT_R = 210, ACCENT_G = 180, ACCENT_B = 140; // Light tan
const TEXT_R = 51, TEXT_G = 51, TEXT_B = 51; // Dark gray
const TEXT_LIGHT_R = 102, TEXT_LIGHT_G = 102, TEXT_LIGHT_B = 102; // Medium gray
const TEXT_MUTED_R = 153, TEXT_MUTED_G = 153, TEXT_MUTED_B = 153; // Light gray
const BACKGROUND_R = 250, BACKGROUND_G = 248, BACKGROUND_B = 245; // Warm white
const DIVIDER_R = 200, DIVIDER_G = 190, DIVIDER_B = 180; // Warm gray

/**
 * Enhanced PDF export with professional styling, cover page, and better layout
 */
export async function exportStoryToPDF(story: GeneratedStory, elementId: string = 'story-content'): Promise<void> {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 25;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    let pageNumber = 1;

    // Helper function to add footer
    const addFooter = (pageNum: number) => {
      pdf.setPage(pageNum);
      pdf.setFontSize(8);
      pdf.setTextColor(TEXT_MUTED_R, TEXT_MUTED_G, TEXT_MUTED_B);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `${story.title} | Halaman ${pageNum}`,
        pageWidth / 2,
        pageHeight - 15,
        { align: 'center' }
      );
    };

    // ===== COVER PAGE =====
    // Background color
    pdf.setFillColor(BACKGROUND_R, BACKGROUND_G, BACKGROUND_B);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Decorative top border
    pdf.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    pdf.rect(0, 0, pageWidth, 8, 'F');
    
    // Title section - centered vertically in upper half
    currentY = 60;
    
    // Decorative line above title
    pdf.setDrawColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 20, currentY - 15, pageWidth - margin - 20, currentY - 15);
    
    // Main title
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(SECONDARY_R, SECONDARY_G, SECONDARY_B);
    const titleLines = pdf.splitTextToSize(story.title, contentWidth);
    pdf.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
    currentY += (titleLines.length * 10) + 8;
    
    // Subtitle
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(TEXT_LIGHT_R, TEXT_LIGHT_G, TEXT_LIGHT_B);
    const subtitleLines = pdf.splitTextToSize(story.subtitle, contentWidth);
    pdf.text(subtitleLines, pageWidth / 2, currentY, { align: 'center' });
    currentY += (subtitleLines.length * 6) + 20;
    
    // Decorative line below subtitle
    pdf.setDrawColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    pdf.line(margin + 30, currentY - 10, pageWidth - margin - 30, currentY - 10);
    
    // Stats section
    currentY += 20;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(TEXT_R, TEXT_G, TEXT_B);
    
    // Stats in a nice row
    const statsY = currentY;
    const stats = [
      { label: 'Anggota', value: story.stats.totalMembers },
      { label: 'Generasi', value: story.stats.totalGenerations },
      { label: 'Tahun', value: story.stats.yearsCovered },
      { label: 'Pernikahan', value: story.stats.marriages },
    ];
    
    const statWidth = contentWidth / stats.length;
    stats.forEach((stat, index) => {
      const x = margin + (statWidth * index) + (statWidth / 2);
      
      // Stat box background
      pdf.setFillColor(ACCENT_R, ACCENT_G, ACCENT_B);
      pdf.setDrawColor(DIVIDER_R, DIVIDER_G, DIVIDER_B);
      pdf.roundedRect(margin + (statWidth * index) + 2, statsY - 8, statWidth - 4, 20, 2, 2, 'FD');
      
      // Stat value
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(SECONDARY_R, SECONDARY_G, SECONDARY_B);
      pdf.text(String(stat.value), x, statsY + 2, { align: 'center' });
      
      // Stat label
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(TEXT_LIGHT_R, TEXT_LIGHT_G, TEXT_LIGHT_B);
      pdf.text(stat.label, x, statsY + 8, { align: 'center' });
    });
    
    currentY += 40;
    
    // Generation date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(TEXT_MUTED_R, TEXT_MUTED_G, TEXT_MUTED_B);
    const dateText = `Dokumen ini dibuat pada ${story.generatedAt.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;
    pdf.text(dateText, pageWidth / 2, currentY, { align: 'center' });
    
    // Decorative bottom border
    pdf.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    
    // Add footer to cover page
    addFooter(pageNumber);
    
    // ===== CONTENT PAGES =====
    pdf.addPage();
    pageNumber++;
    currentY = margin;
    
    // Content header with chapter indicator
    for (let i = 0; i < story.chapters.length; i++) {
      const chapter = story.chapters[i];
      
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        addFooter(pageNumber);
        pdf.addPage();
        pageNumber++;
        currentY = margin;
      }
      
      // Chapter number badge
      pdf.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
      pdf.setDrawColor(SECONDARY_R, SECONDARY_G, SECONDARY_B);
      pdf.roundedRect(margin, currentY - 3, 12, 12, 2, 2, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(i + 1), margin + 6, currentY + 5, { align: 'center' });
      
      // Chapter title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(SECONDARY_R, SECONDARY_G, SECONDARY_B);
      const chapterTitle = chapter.title;
      const chapterTitleLines = pdf.splitTextToSize(chapterTitle, contentWidth - 18);
      pdf.text(chapterTitleLines, margin + 18, currentY + 4);
      currentY += (chapterTitleLines.length * 7) + 8;
      
      // Chapter period with decorative styling
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(TEXT_LIGHT_R, TEXT_LIGHT_G, TEXT_LIGHT_B);
      
      // Period with icon-like prefix
      const periodText = `  ${chapter.period}`;
      pdf.text(periodText, margin, currentY);
      currentY += 10;
      
      // Decorative line under chapter header
      pdf.setDrawColor(DIVIDER_R, DIVIDER_G, DIVIDER_B);
      pdf.setLineWidth(0.3);
      pdf.line(margin, currentY - 3, margin + 60, currentY - 3);
      currentY += 5;
      
      // Chapter content with better typography
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(TEXT_R, TEXT_G, TEXT_B);
      pdf.setLineHeightFactor(1.6);
      
      const contentParagraphs = chapter.content.split('\n\n');
      for (const paragraph of contentParagraphs) {
        if (currentY > pageHeight - 40) {
          addFooter(pageNumber);
          pdf.addPage();
          pageNumber++;
          currentY = margin;
        }
        
        const lines = pdf.splitTextToSize(paragraph.trim(), contentWidth);
        pdf.text(lines, margin, currentY);
        currentY += (lines.length * 5.5) + 6;
      }
      
      // Highlights section with enhanced styling
      if (chapter.highlights.length > 0) {
        if (currentY > pageHeight - 50) {
          addFooter(pageNumber);
          pdf.addPage();
          pageNumber++;
          currentY = margin;
        }
        
        currentY += 8;
        
        // Highlights box background
        const boxPadding = 8;
        const boxWidth = contentWidth;
        let boxHeight = 20; // Base height for header
        
        // Calculate box height based on content
        chapter.highlights.forEach(highlight => {
          const bulletLines = pdf.splitTextToSize(`• ${highlight}`, contentWidth - (boxPadding * 2) - 5);
          boxHeight += (bulletLines.length * 5.5) + 3;
        });
        boxHeight += boxPadding;
        
        // Draw highlight box
        pdf.setFillColor(ACCENT_R, ACCENT_G, ACCENT_B);
        pdf.setDrawColor(DIVIDER_R, DIVIDER_G, DIVIDER_B);
        pdf.roundedRect(margin, currentY - boxPadding, boxWidth, boxHeight, 3, 3, 'FD');
        
        // Highlights header
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(SECONDARY_R, SECONDARY_G, SECONDARY_B);
        pdf.text('Momen Penting', margin + boxPadding, currentY);
        currentY += 8;
        
        // Highlight items
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(TEXT_R, TEXT_G, TEXT_B);
        
        for (const highlight of chapter.highlights) {
          const bulletText = `• ${highlight}`;
          const bulletLines = pdf.splitTextToSize(bulletText, contentWidth - (boxPadding * 2) - 5);
          pdf.text(bulletLines, margin + boxPadding + 5, currentY);
          currentY += (bulletLines.length * 5.5) + 3;
        }
        
        currentY += 10;
      }
      
      // Chapter separator (except for last chapter)
      if (i < story.chapters.length - 1) {
        if (currentY > pageHeight - 30) {
          addFooter(pageNumber);
          pdf.addPage();
          pageNumber++;
          currentY = margin;
        }
        
        currentY += 5;
        
        // Decorative separator
        pdf.setDrawColor(DIVIDER_R, DIVIDER_G, DIVIDER_B);
        pdf.setLineWidth(0.5);
        const sepWidth = 40;
        pdf.line((pageWidth - sepWidth) / 2, currentY, (pageWidth + sepWidth) / 2, currentY);
        
        // Decorative dots
        pdf.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
        pdf.circle((pageWidth - sepWidth) / 2 - 3, currentY, 1.5, 'F');
        pdf.circle((pageWidth + sepWidth) / 2 + 3, currentY, 1.5, 'F');
        
        currentY += 15;
      }
    }
    
    // Add footer to last page
    addFooter(pageNumber);
    
    // ===== BACK PAGE / CLOSING =====
    pdf.addPage();
    pageNumber++;
    
    // Background
    pdf.setFillColor(BACKGROUND_R, BACKGROUND_G, BACKGROUND_B);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Decorative borders
    pdf.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    pdf.rect(0, 0, pageWidth, 8, 'F');
    pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    
    // Center content vertically
    const quoteY = pageHeight / 2;
    
    // Decorative quote marks
    pdf.setFontSize(48);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(ACCENT_R, ACCENT_G, ACCENT_B);
    pdf.text('"', pageWidth / 2, quoteY - 15, { align: 'center' });
    
    // Closing quote
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(TEXT_LIGHT_R, TEXT_LIGHT_G, TEXT_LIGHT_B);
    pdf.text('Setiap keluarga memiliki ceritanya sendiri.', pageWidth / 2, quoteY, { align: 'center' });
    pdf.text('Inilah cerita kita.', pageWidth / 2, quoteY + 8, { align: 'center' });
    
    // Decorative line
    pdf.setDrawColor(DIVIDER_R, DIVIDER_G, DIVIDER_B);
    pdf.setLineWidth(0.5);
    pdf.line(pageWidth / 2 - 30, quoteY + 20, pageWidth / 2 + 30, quoteY + 20);
    
    addFooter(pageNumber);
    
    // Save PDF
    const filename = `cerita-keluarga-${story.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
}

/**
 * Simple text-based PDF export - faster but less styling
 */
export function exportStoryToPDFSimple(story: GeneratedStory): void {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = 30;
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(story.title, contentWidth);
  pdf.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += titleLines.length * 8 + 10;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'italic');
  pdf.text(story.subtitle, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Stats
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const stats = [
    `Total Anggota: ${story.stats.totalMembers}`,
    `Generasi: ${story.stats.totalGenerations}`,
    `Tahun: ${story.stats.yearsCovered}`,
    `Pernikahan: ${story.stats.marriages}`,
    `Dibuat: ${story.generatedAt.toLocaleDateString('id-ID')}`
  ].join(' | ');
  pdf.text(stats, pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Chapters
  story.chapters.forEach((chapter, index) => {
    // Check page break
    if (y > 250) {
      pdf.addPage();
      y = 30;
    }

    // Chapter header
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Bab ${index + 1}: ${chapter.title}`, margin, y);
    y += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text(chapter.period, margin, y);
    y += 10;

    // Content
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    const paragraphs = chapter.content.split('\n\n');
    paragraphs.forEach(paragraph => {
      if (y > 270) {
        pdf.addPage();
        y = 30;
      }
      
      const lines = pdf.splitTextToSize(paragraph.trim(), contentWidth);
      pdf.text(lines, margin, y);
      y += lines.length * 5 + 5;
    });

    // Highlights
    if (chapter.highlights.length > 0) {
      if (y > 260) {
        pdf.addPage();
        y = 30;
      }
      
      y += 5;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Momen Penting:', margin, y);
      y += 6;

      pdf.setFont('helvetica', 'normal');
      chapter.highlights.forEach(highlight => {
        if (y > 270) {
          pdf.addPage();
          y = 30;
        }
        const bulletLines = pdf.splitTextToSize(`• ${highlight}`, contentWidth - 5);
        pdf.text(bulletLines, margin + 5, y);
        y += bulletLines.length * 5;
      });
      y += 5;
    }

    y += 10;
  });

  // Footer
  const filename = `cerita-${story.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  pdf.save(filename);
}
