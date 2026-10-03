// The words of removing what the site keeps, in romanized Punjabi. Why they
// live here, apart from the dictionaries: ./en.ts.
//
// NOTE: AI-drafted translation, pending review by a fluent speaker, following
// lib/i18n/dictionaries/pa-latn.ts's conventions. Keep {placeholders} verbatim.

import type { AccountCopy } from './en';

const account: AccountCopy = {
    clearBrowser: {
        heading: 'Ih browser saaf karo',
        body: 'SikhAI vallon is browser vich rakhi har cheez mita dinda hai: ithe sambhalian gallbaatan, tuhade anuvaad, Punjabi Sikho di tarakki, settingan, bhasha di chon ate theme. Sirf tuhadian pheriaan na ginan di chon rehndi hai.',
        signedIn: 'Ih tuhanu ithon sign out vi kar dinda hai. Tuhade khaate vich rakhian cheezan nu hath nahi laaia jaanda.',
        action: 'Ih browser saaf karo…',
        prompt: 'SikhAI vallon is browser vich rakhi har cheez mitauni hai? Sirf ithe sambhalian gallbaatan vapas nahi aa sakdian.',
        confirm: 'Saaf karo',
        cancel: 'Radd karo',
        clearing: 'Saaf ho reha hai…',
        done: 'Ih browser saaf hai.',
    },
};

export default account;
