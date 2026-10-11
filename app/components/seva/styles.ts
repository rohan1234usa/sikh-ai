// The Seva pages' shared looks, as class strings, so that what sits side by
// side stays alike: one shape for every chip, and one box for the board's
// panels and cards. A variant gets its own colours from the shape rather
// than adding them to CHIP: Tailwind settles two colour classes by their
// order in the stylesheet, not in the class list.
//   CHIP        an event's category, stamped in kesri
//   STATE_CHIP  its state (Full, Cancelled, Hidden, Changed), the same stamp
//               in ink, so a state never reads as another category
//   MINE_CHIP   the board's word for the one signed in, hosting or joined:
//               the category's stamp, framed, so it stands out from the facts
//   PANEL       a notice on the board, in a double hairline: the filters,
//               Your seva, each event
//   PILL        one of a few choices on the hosting form, a radio in a row
//               that wraps: its dot stays, for forced colours and the focus
//               ring, and checked it isn't bold, which would reflow the row

const STAMP = 'inline-flex items-center text-xs font-semibold uppercase tracking-widest';

export const CHIP = `${STAMP} text-accent-text`;

export const STATE_CHIP = `${STAMP} text-ink`;

export const MINE_CHIP = `${CHIP} rounded-full border border-accent-text px-2.5 py-0.5`;

export const PANEL = 'rounded-xl border border-edge bg-surface-raised p-4 outline outline-edge outline-offset-2 sm:p-5';

export const PILL =
    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-3xl border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink hover:border-accent-text/60 has-[:checked]:border-accent-text has-[:checked]:bg-accent-text/10';
