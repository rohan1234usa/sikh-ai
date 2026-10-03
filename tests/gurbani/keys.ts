// Lookup keys for recorded GurbaniNow answers, shared by the replaying client
// (./helpers.ts) and the recorder (scripts/gurbani-fixtures/record.ts) so the
// two can never disagree. The quote checker's keys stay exactly as first
// recorded; a lookup limited to one source says so before its query.
//
// No imports: the recorder loads this with a relative path.

export const angKey = (ang: number) => `ang:${ang}`;

export const searchKey = (query: string, type: number, results: number, source?: number) =>
    `search:${type}:${results}:${source === undefined ? '' : `source=${source}:`}${query}`;
