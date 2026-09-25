// PostgREST caps a single response at 1000 rows and gives no signal that it
// truncated, so any "all of a user's rows" read has to page explicitly. The
// query must order by a unique column (or end with one as a tiebreaker), or
// pages can overlap and skip rows.
const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) return { rows, error };

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}
