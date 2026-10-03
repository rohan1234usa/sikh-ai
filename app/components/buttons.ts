// The site's buttons, as class strings for <button> and <a> alike.
//   PRIMARY    the one action a view asks for
//   SECONDARY  an action beside it
//   DANGER     confirms something a visitor can't take back from the page
//   BUTTON_LG  added to any of them: a full-width, 44px target on phones
// A busy or unavailable button keeps its focus with aria-disabled (a disabled
// one drops it), so each look dims aria-disabled too.

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

export const PRIMARY_BUTTON = `${BASE} bg-kesri text-navy font-bold shadow-md shadow-kesri/20 hover:bg-kesri-hover`;

export const SECONDARY_BUTTON = `${BASE} border border-edge-strong bg-surface-raised text-ink font-semibold hover:bg-edge/60`;

export const DANGER_BUTTON = `${BASE} bg-red-700 text-white font-bold hover:bg-red-800`;

export const BUTTON_LG = 'min-h-11 w-full sm:w-auto';
