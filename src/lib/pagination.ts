import type { PostgrestError } from "@supabase/supabase-js";

// Must stay <= PostgREST's max_rows (supabase/config.toml). A larger value
// would make the server cap a page below what was asked for, so the
// short-page check below would stop early and re-truncate the result.
export const PAGE_SIZE = 1000;

type PagedResult<T> = { data: T[] | null; error: PostgrestError | null };

// Pages through a supabase-js query in batches of PAGE_SIZE. `fetchPage`
// must build a fresh query per call (builders are one-shot) and apply
// `.range(from, to)` itself. Returns the same `{ data, error }` shape as a
// single `await supabase.from(...)...`, so it drops into an existing
// `Promise.all([...])` call site unchanged.
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>,
): Promise<PagedResult<T>> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) return { data: null, error };

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };

    from += PAGE_SIZE;
  }
}
