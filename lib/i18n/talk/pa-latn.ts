// The words of the Talk page (/translate/talk, #37), in romanized Punjabi.
// Why they live here, apart from the dictionaries: ./en.ts.
//
// NOTE: AI-drafted translation, pending review by a fluent speaker, in the
// community romanization of lib/i18n/dictionaries/pa-latn.ts.

import type { TalkCopy } from './en';

const talk: TalkCopy = {
    title: 'Bol ke anuvaad',
    typeInstead: 'Likh ke anuvaad karo',
    newConversation: 'Navin gallbaat',
    intro: 'Button daba ke rakho ate Punjabi jaan Angrezi vich bolo. Button chhaddo, taan anuvaad disega ate parh ke sunaya javega.',
    tip: 'Ik vaar vich 15 seconds tak. Je “Aapne aap” galat bhasha samjhe, taan hethan chuno ki kaun bol riha hai.',
    threadAria: 'Gallbaat',
    heard: '{lang} vich sunia',
    translation: '{lang} vich anuvaad',
    // The two languages: in the labels above, and on the chips under
    // the thread.
    langs: { pa: 'Punjabi', en: 'Angrezi' },
    cut: 'Akhir ton pehlan kattia gaya.',
    readAloud: 'Parh ke sunao',
    stopReading: 'Sunauna band karo',
    copyTranslation: 'Anuvaad copy karo',
    latest: 'Sab ton navan',
    speakerAria: 'Kaun bol riha hai',
    speakerAuto: 'Aapne aap',
    speakSwitch: 'Sunao',
    speakSwitchHint: 'Anuvaad parh ke sunao',
    hold: 'Bolan layi daba ke rakho',
    starting: 'Microphone chalu ho riha hai…',
    listening: 'Sun riha hai… anuvaad layi button chhaddo',
    paused: 'Kirpa karke udeek karo…',
    unavailable: 'Ithe record nahi ho sakda',
    keyboardHint: 'Keyboard naal: shuru karan layi Space, rokan layi dubara Space.',
    translating: 'Anuvaad ho riha hai…',
    notes: {
        tooShort: 'Bolde vele button daba ke rakho.',
        tooLong: 'Ih recording bhejan layi bahut vaddi si. Kirpa karke isnu chhoti rakho.',
        micReady: 'Microphone tiar hai. Button daba ke rakho ate bolo.',
        interrupted: 'Panna lukan karke recording ruk gayi.',
        nothingHeard: 'Kujh sunai nahi dita. Button daba ke rakho ate saaf bolo.',
        denied: 'Microphone band hai. Apne browser dian is site valian settings vich isdi ijazat dio, phir dubara koshish karo.',
        unavailable: 'Koi microphone nahi milia.',
        busy: 'Koi hor app microphone vart rahi hai.',
        unsupported: 'Ih browser avaaz record nahi kar sakda. Chrome, Safari jaan Firefox vart ke dekho.',
        insecure: 'Record karan layi surakhiat (https) connection chahida hai.',
        failed: 'Recording nahi ho saki. Kirpa karke dubara koshish karo.',
    },
    disclaimer: 'Anuvaad AI likhda hai, ate ih galat ho sakda hai. Har recording Google Gemini nu jandi hai, ate Punjabi Google parh ke sunaunda hai; kujh vi rakhia nahi janda, ate panna dubara kholan naal sab mit janda hai.',
};

export default talk;
