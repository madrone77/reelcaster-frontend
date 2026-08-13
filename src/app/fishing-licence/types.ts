/**
 * Shapes shared by every jurisdiction's licence data.
 *
 * Lives apart from guide-ui.tsx so the per-region data modules can import the
 * types without importing a React component — data should not depend on the
 * thing that renders it.
 */

export interface FeeRow {
  /** Left-hand label — the licence term or product, not the buyer. */
  term: string;
  /** One cell per column in the table's header, same order. */
  prices: string[];
}

export interface FeeTable {
  /** Column headers after the term column. */
  columns: string[];
  rows: FeeRow[];
  /** Rendered under the table for the caveats a cell can't hold. */
  notes: string[];
}
