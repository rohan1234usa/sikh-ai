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
    tip: 'Ik vaar vich {seconds} seconds tak. Je “Aapne aap” galat bhasha samjhe, taan hethan chuno ki kaun bol riha hai.',
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
    errors: {
        translate_voice_empty: 'Kujh vi record nahi hoia. Kirpa karke bolde vele button daba ke rakho.',
        translate_voice_too_long: 'Ih recording bhejan layi bahut lammi hai. Kirpa karke isnu chhoti rakho.',
        translate_voice_bad_audio: 'Ih recording parhi nahi ja saki. Kirpa karke dubara koshish karo.',
        translate_voice_failed: 'Maaf karna, avaaz da anuvaad nahi ho sakia. Kirpa karke dubara koshish karo.',
        translate_voice_busy: 'Avaaz vala anuvadak is vele rujjhia hoia hai. Kirpa karke thorhi der baad dubara koshish karo.',
        translate_voice_limit: 'Tuhada connection ajj layi avaaz vale anuvadak di hadd tak pahunch gaya hai. Kirpa karke baad vich dubara koshish karo.',
        translate_voice_blocked: 'Avaaz vala anuvadak is recording da anuvaad nahi kar sakia. Kirpa karke isnu hor shabdan vich keh ke dekho.',
        speak_unavailable: 'Is vele parh ke sunaya nahi ja sakda.',
        speak_failed: 'Maaf karna, ih parh ke sunaya nahi ja sakia. Kirpa karke dubara koshish karo.',
        speak_busy: 'Parh ke sunaun vali seva is vele rujjhi hoi hai. Kirpa karke thorhi der baad dubara koshish karo.',
        speak_limit: 'Tuhada connection ajj layi parh ke sunaun di hadd tak pahunch gaya hai. Kirpa karke baad vich dubara koshish karo.',
    },
    disclaimer: 'Anuvaad AI likhda hai, ate ih galat ho sakda hai. Har recording Google Gemini nu jandi hai, ate Punjabi Google parh ke sunaunda hai (ate Angrezi vi, jadon tuhada device aap na parh sake). Ih site is vichon kujh nahi rakhdi: panna dubara kholan naal sab mit janda hai.',
};

export default talk;
