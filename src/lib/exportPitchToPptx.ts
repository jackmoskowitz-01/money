import PptxGenJS from 'pptxgenjs';

export interface PitchSlide {
  title: string;
  subtitle?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  note?: string;
}

/**
 * Parse the AI-generated pitch deck markdown into structured slides.
 * Slides are separated by `---SLIDE---` markers.
 */
export function parsePitchSlides(content: string): PitchSlide[] {
  const rawSlides = content.split(/---SLIDE---/i).map(s => s.trim()).filter(Boolean);
  
  return rawSlides.map(raw => {
    const lines = raw.split('\n').filter(l => l.trim());
    const slide: PitchSlide = { title: '' };

    // Extract title (first heading)
    const titleLine = lines.find(l => /^#{1,3}\s/.test(l));
    if (titleLine) {
      slide.title = titleLine.replace(/^#{1,3}\s+/, '').trim();
    }

    // Extract subtitle (line after title that isn't a bullet or table)
    const titleIdx = lines.indexOf(titleLine || '');
    if (titleIdx >= 0 && titleIdx + 1 < lines.length) {
      const next = lines[titleIdx + 1];
      if (next && !next.startsWith('-') && !next.startsWith('|') && !next.startsWith('#') && !next.startsWith('*')) {
        slide.subtitle = next.replace(/^\*+|\*+$/g, '').trim();
      }
    }

    // Extract bullets
    const bullets = lines
      .filter(l => /^[-*]\s/.test(l))
      .map(l => l.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim());
    if (bullets.length > 0) slide.bullets = bullets;

    // Extract table
    const tableLines = lines.filter(l => l.startsWith('|') && !l.match(/^\|[-\s|]+\|$/));
    if (tableLines.length >= 2) {
      const parseRow = (line: string) => line.split('|').map(c => c.trim()).filter(Boolean);
      slide.table = {
        headers: parseRow(tableLines[0]),
        rows: tableLines.slice(1).map(parseRow),
      };
    }

    // Fallback title
    if (!slide.title) {
      slide.title = lines[0]?.replace(/[#*]/g, '').trim() || 'Slide';
    }

    return slide;
  });
}

/**
 * Check if copilot output is a pitch deck
 */
export function isPitchDeck(content: string): boolean {
  return content.includes('---SLIDE---') && 
    (content.toLowerCase().includes('pitch') || content.toLowerCase().includes('presentation'));
}

/**
 * Export parsed pitch slides to a .pptx file
 */
export async function exportPitchToPptx(slides: PitchSlide[], filename: string = 'Pitch_Deck') {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches (16:9)
  pptx.author = 'DealFlow Copilot';
  pptx.title = filename;

  // Define colors
  const PRIMARY = '1a56db';
  const DARK = '1e293b';
  const MUTED = '64748b';
  const LIGHT_BG = 'f8fafc';
  const ACCENT = '3b82f6';

  slides.forEach((slide, idx) => {
    const s = pptx.addSlide();

    if (idx === 0) {
      // Cover slide
      s.background = { color: DARK };
      s.addText(slide.title, {
        x: 0.8, y: 2.0, w: 11.5, h: 1.5,
        fontSize: 36, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        align: 'left',
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8, y: 3.6, w: 11.5, h: 0.8,
          fontSize: 18, fontFace: 'Arial', color: '94a3b8',
          align: 'left',
        });
      }
      // Accent bar
      s.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 4.6, w: 2.0, h: 0.06,
        fill: { color: ACCENT },
      });
    } else {
      // Content slides
      s.background = { color: LIGHT_BG };

      // Title bar
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 1.2,
        fill: { color: DARK },
      });
      s.addText(slide.title, {
        x: 0.8, y: 0.15, w: 11.5, h: 0.9,
        fontSize: 22, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        align: 'left', valign: 'middle',
      });

      let yPos = 1.6;

      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8, y: yPos, w: 11.5, h: 0.6,
          fontSize: 14, fontFace: 'Arial', color: MUTED, italic: true,
        });
        yPos += 0.7;
      }

      // Bullets
      if (slide.bullets && slide.bullets.length > 0) {
        const bulletText = slide.bullets.map(b => ({
          text: b,
          options: { fontSize: 13, fontFace: 'Arial', color: DARK, bullet: { type: 'bullet' as const }, breakLine: true, paraSpaceAfter: 8 },
        }));
        s.addText(bulletText, {
          x: 0.8, y: yPos, w: 11.5, h: Math.min(slide.bullets.length * 0.45, 5.0),
          valign: 'top',
        });
        yPos += Math.min(slide.bullets.length * 0.45, 5.0) + 0.3;
      }

      // Table
      if (slide.table) {
        const headerRow = slide.table.headers.map(h => ({
          text: h, options: { fontSize: 11, fontFace: 'Arial', color: 'FFFFFF', bold: true, fill: { color: PRIMARY }, align: 'center' as const },
        }));
        const dataRows = slide.table.rows.map(row =>
          row.map(cell => ({
            text: cell, options: { fontSize: 10, fontFace: 'Arial', color: DARK, align: 'center' as const },
          }))
        );
        s.addTable([headerRow, ...dataRows], {
          x: 0.8, y: yPos, w: 11.5,
          border: { type: 'solid', pt: 0.5, color: 'CBD5E1' },
          rowH: 0.4,
          autoPage: true,
        });
      }
    }

    // Slide number
    if (idx > 0) {
      s.addText(`${idx + 1}`, {
        x: 12.3, y: 7.0, w: 0.6, h: 0.4,
        fontSize: 9, fontFace: 'Arial', color: MUTED, align: 'center',
      });
    }
  });

  await pptx.writeFile({ fileName: `${filename}.pptx` });
}
