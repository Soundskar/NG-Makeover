import type { Cell, Sheet } from 'write-excel-file/browser';

type Row = Record<string, unknown>;

function toCell(v: unknown): Cell {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return JSON.stringify(v);
}

/** Saves one .xlsx file with a sheet per table. The library loads only when needed. */
export async function downloadWorkbook(fileName: string, sheets: { name: string; rows: Row[] }[]): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const data: Sheet<File | Blob | ArrayBuffer>[] = sheets.map((s) => {
    const cols = Array.from(new Set(s.rows.flatMap((r) => Object.keys(r))));
    return {
      sheet: s.name.slice(0, 31),
      stickyRowsCount: 1,
      data: [
        cols.map((c) => ({ value: c, fontWeight: 'bold' as const })),
        ...s.rows.map((r) => cols.map((c) => toCell(r[c]))),
      ],
    };
  });
  await writeExcelFile(data).toFile(fileName);
}
