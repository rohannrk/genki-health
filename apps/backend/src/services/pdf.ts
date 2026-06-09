import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { MedicalDocument, PatientProfile } from '../db';

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DOC_TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  lab: 'Lab Report',
  invoice: 'Invoice',
  imaging: 'Imaging',
  report: 'Report',
  other: 'Document',
};

/**
 * Wraps a string into lines that fit within `maxWidth` at the given font/size.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Compiles a patient's selected medical records into a single PDF.
 * v1 is a structured text compilation (cover page + one section per document);
 * embedding the original scanned files is a follow-up.
 */
export async function buildRecordsPdf(
  profile: Pick<PatientProfile, 'name' | 'dob' | 'relation'>,
  documents: Array<
    Pick<MedicalDocument, 'type' | 'title' | 'date' | 'hospitalName' | 'doctorName' | 'extractedText'>
  >
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLine = (
    text: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ) => {
    const size = opts.size ?? 11;
    const usedFont = opts.font ?? font;
    const lines = wrapText(text, usedFont, size, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: usedFont,
        color: opts.color ?? rgb(0.1, 0.1, 0.12),
      });
      y -= size + 4;
    }
    if (opts.gap) y -= opts.gap;
  };

  // Cover header
  drawLine('Medical Records Export', { size: 22, font: bold, gap: 6 });
  drawLine(`Patient: ${profile.name}`, { size: 13, font: bold });
  drawLine(`Date of birth: ${profile.dob}   ·   Relation: ${profile.relation}`, {
    size: 10,
    color: rgb(0.4, 0.4, 0.45),
  });
  drawLine(`Generated: ${new Date().toLocaleString()}`, {
    size: 10,
    color: rgb(0.4, 0.4, 0.45),
  });
  drawLine(`${documents.length} document${documents.length === 1 ? '' : 's'} included`, {
    size: 10,
    color: rgb(0.4, 0.4, 0.45),
    gap: 14,
  });

  documents.forEach((doc, i) => {
    ensureSpace(60);
    const label = doc.title?.trim() || DOC_TYPE_LABELS[doc.type] || doc.type;
    drawLine(`${i + 1}. ${label}${doc.date ? ` — ${doc.date}` : ''}`, {
      size: 14,
      font: bold,
      gap: 2,
    });
    const meta = [doc.hospitalName, doc.doctorName].filter(Boolean).join('  ·  ');
    if (meta) {
      drawLine(meta, { size: 10, color: rgb(0.4, 0.4, 0.45) });
    }
    drawLine(doc.extractedText?.trim() || 'No extracted text available.', {
      size: 11,
      color: rgb(0.2, 0.2, 0.24),
      gap: 16,
    });
  });

  return pdf.save();
}
