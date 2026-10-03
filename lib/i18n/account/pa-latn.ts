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
        clearing: 'Saaf ho riha hai…',
        done: 'Ih browser saaf hai.',
    },

    deletePanel: {
        heading: 'Aapna khaata mitao',
        body: 'Tuhada khaata ate us vich rakhi har cheez mita dinda hai. Kujh vi mitan ton pehlan tusi vekhoge ki ki mitega, ate Google tuhanu dubara sign in karan layi kahega.',
        open: 'Mera khaata mitao…',
    },

    deleteAccount: {
        title: 'Aapna khaata mitauna hai?',
        intro: 'Ih tuhada SikhAI khaata ate us vich rakhi har cheez mita dinda hai. Tuhade Google khaate nu hath nahi launda, ate ih vapas nahi ho sakda.',
        goesHeading: 'Ki mitega',
        goes: {
            links: 'Tuhade saanjhe link: uh use vele kamm karna band kar dinde han',
            events: 'Jinhan Seva samagaman de prabandhak tusi ho: pehlan radd, phir sevadaran de naavan samet mitaye jaande han',
            signups: 'Seva samagaman vich tuhade naam: tusi unhan ton naam vapas lai lainde ho',
            chats: 'Tuhade khaate vich sambhalian gallbaatan',
            account: 'Sab ton akheer vich, tuhada khaata aap',
        },
        staysHeading: 'Ki rahega',
        stays: [
            'Is browser vich rakhian gallbaatan, anuvaad ate settingan, jadon tak tusi isnu saaf nahi karde',
            'Seva samagaman baare tuhadian bhejian shikayatan, jadon tak admin unhan nu vekh nahi lainde',
            'Google de backupan vichlian naklan, 180 dinan tak',
        ],
        reauth: 'Agge, Google tuhanu dubara sign in karan layi kahega, ih pakka karan layi ki ih tusi hi ho.',
        keep: 'Khaata rehan dio',
        confirm: 'Mera khaata mitao',
        waiting: 'Google di udeek ho rahi hai…',
        deleting: 'Mitaia ja riha hai. Poora hon tak ih panna khulla rakho.',
        stepDone: 'Ho gaya',
        stepNow: 'Hun',
        doneTitle: 'Tuhada khaata mita ditta gaya hai',
        doneBody: 'Tusi sign out ho. Is browser vich rakhian gallbaatan, anuvaad ate settingan aje ithe han.',
        clearToo: 'Ih browser vi saaf karo',
        close: 'Band karo',
        retry: 'Dubara koshish karo',
        signInAgain: 'Dubara sign in karo',
        nothingDeleted: 'Kujh vi nahi mitia.',
        partlyDeleted: 'Ho sakda hai kujh pehlan hi mit gaya hove. Dubara koshish karna surakhit hai: ih baaki poora kar dinda hai.',
        problems: {
            cancelled: 'Tuhade sign in karan ton pehlan Google di window band ho gayi.',
            blocked: 'Tuhade browser ne Google di window rok ditti. Is site layi pop-up chaalu karo, phir dubara koshish karo.',
            'wrong-account': 'Ih koi hor Google khaata hai. Uh chuno jis naal tusi ithe sign in ho.',
            offline: 'Tusi offline ho. Internet naal judo, phir dubara koshish karo.',
            'recent-login': 'Baaki sab mit gaya hai. Khaata aap mitaun layi, Google chahunda hai ki tusi ik vaar hor sign in karo.',
            failed: 'Kujh galat ho gaya. Je ih vaar-vaar hove, taan {email} nu email karo.',
        },
        signedOut: 'Tusi sign out ho, is layi ithe mitaun layi koi khaata nahi hai.',
    },
};

export default account;
