import * as XLSX from "xlsx";

// Parses the first sheet of an uploaded .xlsx/.xls/.csv file into an array of row objects
// keyed by column header (first row).
export async function parseSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: undefined });
}

export function excelCell(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

export function excelNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  const raw = excelCell(row, ...keys);
  if (raw == null) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

export function excelDate(row: Record<string, unknown>, ...keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = new Date(value.trim());
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return undefined;
}

const HOME_MARKERS = ["主", "主场", "h", "home"];

export function isHomeMarker(value: string | undefined): boolean {
  if (!value) return false;
  return HOME_MARKERS.includes(value.trim().toLowerCase());
}
