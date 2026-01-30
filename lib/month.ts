import type { DocxParagraph } from '@/lib/docx';

export function detectMonth(paragraphs: DocxParagraph[], filename?: string) {
  const candidates = new Set<string>();
  const regex = /(20\d{2})[-/.](0[1-9]|1[0-2])/g;

  const scan = (text: string) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      candidates.add(`${match[1]}-${match[2]}`);
    }
  };

  paragraphs.forEach((p) => scan(p.text));
  if (filename) scan(filename);

  const list = Array.from(candidates);
  if (list.length === 1) return { month: list[0], candidates: list };
  return { month: null, candidates: list };
}

