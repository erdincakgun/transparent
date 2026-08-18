const RISKY_LEADING_CHAR = /^[=+\-@\t\r]/;

const escape = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const safe = RISKY_LEADING_CHAR.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function downloadCsv(
  filename: string,
  columns: string[],
  rows: unknown[],
) {
  const keys = columns.map((column) => column.split("::")[0]);
  const values = (row: unknown) =>
    keys.map((key) => (row as Record<string, unknown>)[key]);
  const csv = [keys, ...rows.map(values)]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
