type ReportMetaSegment = {
  label?: string;
  value: string;
  mono?: boolean;
};

type ReportHeading = string | { from: string; to: string; relation: string };

type ReportRow = {
  key: string;
  heading: ReportHeading;
  kind?: "accrual" | "payment";
  description?: string | null;
  amount?: { text: string; standing?: string };
  meta?: ReportMetaSegment[];
};

export type HtmlReport = {
  title: string;
  ledger: { name: string; description?: string | null; id: string };
  exportedBy?: string;
  generatedAt: Date;
  count: string;
  rows: ReportRow[];
  empty: { title: string; body: string; tone?: "muted" | "success" };
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escape = (value: unknown) => {
  if (value === null || value === undefined) return "";

  return String(value).replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character],
  );
};

const stampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
  timeStyle: "medium",
  hourCycle: "h23",
});

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const kinds = {
  accrual: {
    label: "Accrual",
    paths:
      '<path d="M13 16H8"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  },
  payment: {
    label: "Payment",
    paths:
      '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
  },
} as const;

const renderHeading = (heading: ReportHeading) => {
  if (typeof heading === "string")
    return `<span class="name">${escape(heading)}</span>`;

  return [
    `<span class="name">${escape(heading.from)}</span>`,
    `<span class="arrow" aria-hidden="true">&#8594;</span>`,
    `<span class="sr-only">${escape(heading.relation)}</span>`,
    `<span class="name">${escape(heading.to)}</span>`,
  ].join("");
};

const renderSegment = (segment: ReportMetaSegment) =>
  (segment.label ? `${escape(segment.label)} ` : "") +
  `<span${segment.mono ? ' class="mono"' : ""}>${escape(segment.value)}</span>`;

const renderRow = (row: ReportRow) => {
  const kind = row.kind ? kinds[row.kind] : undefined;
  const secondary = [
    kind
      ? `<span class="badge badge-${row.kind}">${icon(kind.paths)}${kind.label}</span>`
      : "",
    row.description
      ? `<span class="description">${escape(row.description)}</span>`
      : "",
  ].join("");
  const figures = [
    row.amount
      ? `<p class="amount">${escape(row.amount.text)}${row.amount.standing ? `<span class="sr-only"> — ${escape(row.amount.standing)}</span>` : ""}</p>`
      : "",
    row.meta?.length
      ? `<p class="meta-line">${row.meta.map(renderSegment).join(" · ")}</p>`
      : "",
  ].join("");

  const blocks = [
    `<div class="identity"><p class="pair">${renderHeading(row.heading)}</p>${secondary ? `<p class="secondary">${secondary}</p>` : ""}</div>`,
    figures ? `<div class="figures">${figures}</div>` : "",
  ].filter(Boolean);

  return `<li class="row">
          ${blocks.join("\n          ")}
        </li>`;
};

const renderBody = (report: HtmlReport) => {
  if (!report.rows.length) {
    return `<div class="empty${report.empty.tone === "success" ? " empty-success" : ""}">
          <p class="empty-title">${escape(report.empty.title)}</p>
          <p class="empty-body">${escape(report.empty.body)}</p>
        </div>`;
  }

  return `<ul class="rows">
        ${report.rows.map(renderRow).join("\n        ")}
      </ul>`;
};

const definition = (term: string, value: string, mono = false) =>
  `<div><dt>${escape(term)}</dt><dd${mono ? ' class="mono"' : ""}>${escape(value)}</dd></div>`;

const styles = `
    :root {
      color-scheme: light dark;
      --background: oklch(0.98 0.01 295);
      --foreground: oklch(0.17 0.02 295);
      --card: oklch(1 0 0);
      --muted-foreground: oklch(0.515 0.03 295);
      --primary: oklch(0.5 0.24 295);
      --success: oklch(0.5 0.098 170);
      --warning: oklch(0.52 0.112 70);
      --border: oklch(0.91 0.017 295);
      --radius: 0.625rem;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --background: oklch(0.16 0.022 295);
        --foreground: oklch(0.97 0.01 295);
        --card: oklch(0.22 0.028 295);
        --muted-foreground: oklch(0.73 0.03 295);
        --primary: oklch(0.72 0.16 295);
        --success: oklch(0.82 0.16 170);
        --warning: oklch(0.84 0.145 78);
        --border: oklch(0.32 0.03 295);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 2rem 1rem 4rem;
      background-color: var(--background);
      background-image:
        radial-gradient(60rem 40rem at 12% -12%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 70%),
        radial-gradient(50rem 34rem at 100% 4%, color-mix(in oklch, var(--success) 6%, transparent), transparent 70%);
      background-repeat: no-repeat;
      color: var(--foreground);
      font-family: 'Geist Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .page { max-width: 56rem; margin: 0 auto; }

    .eyebrow {
      margin: 0;
      color: var(--primary);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 { margin: 0.25rem 0 0; font-size: 1.5rem; line-height: 1.2; }
    .ledger { margin: 0.625rem 0 0; font-size: 1rem; font-weight: 500; }
    .ledger-description { margin: 0.125rem 0 0; color: var(--muted-foreground); }

    .facts {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.625rem 1.5rem;
      margin: 1.25rem 0 0;
      padding: 0.875rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
    }

    .facts > div { min-width: 0; }
    .facts dt { color: var(--muted-foreground); font-size: 0.75rem; }
    .facts dd { margin: 0; font-size: 0.8125rem; overflow-wrap: anywhere; }

    .rows {
      margin: 1.5rem 0 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      overflow: hidden;
    }

    .row { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 1rem; }
    .row + .row { border-top: 1px solid var(--border); }

    .identity { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
    .pair { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; margin: 0; font-weight: 500; }
    .name { overflow-wrap: anywhere; }
    .arrow { flex-shrink: 0; color: var(--muted-foreground); }

    .secondary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.375rem; margin: 0; }
    .description { color: var(--muted-foreground); overflow-wrap: anywhere; }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
      padding: 1px 0.375rem;
      border: 1px solid;
      border-radius: calc(var(--radius) * 0.6);
      font-size: 0.75rem;
      font-weight: 500;
    }

    .badge svg { width: 0.75rem; height: 0.75rem; }

    .badge-accrual {
      color: var(--warning);
      border-color: color-mix(in oklch, var(--warning) 30%, transparent);
      background: color-mix(in oklch, var(--warning) 10%, transparent);
    }

    .badge-payment {
      color: var(--success);
      border-color: color-mix(in oklch, var(--success) 30%, transparent);
      background: color-mix(in oklch, var(--success) 10%, transparent);
    }

    .figures { display: flex; flex-direction: column; gap: 0.125rem; }
    .amount { margin: 0; font-weight: 500; font-variant-numeric: tabular-nums; }
    .meta-line { margin: 0; color: var(--muted-foreground); font-size: 0.75rem; overflow-wrap: anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    .empty {
      margin: 1.5rem 0 0;
      padding: 2rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      text-align: center;
    }

    .empty-title { margin: 0; font-weight: 500; }
    .empty-body { margin: 0.25rem 0 0; color: var(--muted-foreground); }

    .empty-success {
      border-color: color-mix(in oklch, var(--success) 30%, transparent);
      background: color-mix(in oklch, var(--success) 5%, transparent);
    }

    .empty-success .empty-title { color: var(--success); }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border-width: 0;
    }

    @media (min-width: 640px) {
      body { padding: 3rem 2rem 5rem; }
      .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .row { flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem; }
      .figures { flex-shrink: 0; align-items: flex-end; text-align: right; }
    }

    @media print {
      :root {
        --background: oklch(1 0 0);
        --foreground: oklch(0.17 0.02 295);
        --card: oklch(1 0 0);
        --muted-foreground: oklch(0.42 0.03 295);
        --primary: oklch(0.5 0.24 295);
        --success: oklch(0.5 0.098 170);
        --warning: oklch(0.52 0.112 70);
        --border: oklch(0.82 0.017 295);
      }

      body { padding: 0; background-image: none; font-size: 10.5pt; }
      .row { break-inside: avoid; }
      .facts, .empty { break-inside: avoid; }
    }
`;

export function downloadHtmlReport(filename: string, report: HtmlReport) {
  const facts = [
    definition("Rows", report.count),
    definition("Exported", stampFormat.format(report.generatedAt)),
    definition("Ledger id", report.ledger.id, true),
    report.exportedBy ? definition("Exported by", report.exportedBy, true) : "",
  ].join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(report.title)} · ${escape(report.ledger.name)} · Transparent</title>
    <style>${styles}    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <p class="eyebrow">Transparent</p>
        <h1>${escape(report.title)}</h1>
        <p class="ledger">${escape(report.ledger.name)}</p>
        ${report.ledger.description ? `<p class="ledger-description">${escape(report.ledger.description)}</p>` : ""}
        <dl class="facts">${facts}</dl>
      </header>
      ${renderBody(report)}
    </div>
  </body>
</html>
`;

  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
