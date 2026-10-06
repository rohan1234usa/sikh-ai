// The Seva pages' shared looks, as class strings, so that what sits side by
// side stays alike: one shape for every chip, and one box for the board's
// panels and cards. A variant gets its own colours from the shape rather
// than adding them to CHIP: Tailwind settles two colour classes by their
// order in the stylesheet, not in the class list.
//   CHIP        a fact about an event: its category, Full, Cancelled
//   MINE_CHIP   the board's word for the one signed in: hosting, joined
//   PANEL       a box on the board: the filters, Your seva, each event

const CHIP_SHAPE = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm';

export const CHIP = `${CHIP_SHAPE} border-edge-strong text-ink`;

export const MINE_CHIP = `${CHIP_SHAPE} border-accent-text font-semibold text-accent-text`;

export const PANEL = 'rounded-xl border border-edge bg-surface-raised p-4 shadow-sm sm:p-5';
