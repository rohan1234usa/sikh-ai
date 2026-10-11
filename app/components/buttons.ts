// The site's buttons, as class strings for <button> and <a> alike.
//   PRIMARY    the one action a view asks for
//   SECONDARY  an action beside it
//   DANGER     confirms something a visitor can't take back from the page
//   BUTTON_LG  added to any of them: a full-width, 44px target on phones
// A busy or unavailable button keeps its focus with aria-disabled (a disabled
// one drops it), so each look dims aria-disabled too.

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 disabled:cursor-not-allowed disabled:opacity-60';

// The fill every primary action shares, whatever its size: PRIMARY_BUTTON, and
// the smaller ones in chat's panels and dialogs, which keep their own padding.
export const PRIMARY_FILL = 'bg-kesri text-navy font-bold hover:bg-kesri-hover';

export const PRIMARY_BUTTON = `${BASE} ${PRIMARY_FILL} shadow-md shadow-kesri/20`;

export const SECONDARY_BUTTON = `${BASE} border border-edge-strong bg-surface-raised text-ink font-semibold hover:bg-edge/60`;

export const DANGER_BUTTON = `${BASE} bg-red-700 text-white font-bold hover:bg-red-800`;

export const BUTTON_LG = 'min-h-11 w-full sm:w-auto';
