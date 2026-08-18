import type { PostgrestError } from "@supabase/supabase-js";

export const PAGE_SIZE = 1000;

type PagedResult<T> = { data: T[] | null; error: PostgrestError | null };

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
