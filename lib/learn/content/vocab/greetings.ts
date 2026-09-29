// Vocabulary: greetings and manners, mostly whole phrases. Several are also
// in the translator's phrasebook on purpose, and are spelled the same way
// (tests/learn/content.test.ts checks it). Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker.
//
// Open questions for that review:
// - Rabb rakha as a goodbye: common enough across the community to teach?
// - ਮਿਹਰਬਾਨੀ is meharbani, as the phrasebook's note spells it.

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'greetings-sat-sri-akal', topic: 'greetings', gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', roman: 'Sat Sri Akal', english: 'hello; goodbye', pos: 'phrase', note: 'The everyday greeting, both coming and going.' },
    { id: 'greetings-fateh', topic: 'greetings', gurmukhi: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ', roman: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh', english: 'the formal Sikh greeting', pos: 'phrase', note: 'The Khalsa belongs to Waheguru; victory belongs to Waheguru. The reply is the same phrase.' },
    { id: 'greetings-ki-haal-hai', topic: 'greetings', gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?', roman: 'Ki haal hai?', english: 'how are you? (casual)', pos: 'phrase' },
    { id: 'greetings-tuhada-ki-haal-hai', topic: 'greetings', gurmukhi: 'ਤੁਹਾਡਾ ਕੀ ਹਾਲ ਹੈ ਜੀ?', roman: 'Tuhada ki haal hai ji?', english: 'how are you? (respectfully)', pos: 'phrase' },
    { id: 'greetings-main-theek-haan', topic: 'greetings', gurmukhi: 'ਮੈਂ ਠੀਕ ਹਾਂ', roman: 'Main theek haan', english: 'I am fine', pos: 'phrase' },
    { id: 'greetings-haanji', topic: 'greetings', gurmukhi: 'ਹਾਂਜੀ', roman: 'haanji', english: 'yes (respectfully)', pos: 'phrase' },
    { id: 'greetings-nahi-ji', topic: 'greetings', gurmukhi: 'ਨਹੀਂ ਜੀ', roman: 'nahi ji', english: 'no (respectfully)', pos: 'phrase', accept: ['nahin ji'] },
    { id: 'greetings-dhanvaad', topic: 'greetings', gurmukhi: 'ਧੰਨਵਾਦ', roman: 'dhanvaad', english: 'thank you', pos: 'phrase', accept: ['dhanwad'] },
    { id: 'greetings-meharbani', topic: 'greetings', gurmukhi: 'ਮਿਹਰਬਾਨੀ', roman: 'meharbani', english: 'thank you (warmer); kindness', pos: 'phrase', accept: ['mehrbani'] },
    { id: 'greetings-maaf-karna-ji', topic: 'greetings', gurmukhi: 'ਮਾਫ਼ ਕਰਨਾ ਜੀ', roman: 'Maaf karna ji', english: 'excuse me; sorry', pos: 'phrase' },
    { id: 'greetings-ji-aayan-nu', topic: 'greetings', gurmukhi: 'ਜੀ ਆਇਆਂ ਨੂੰ', roman: 'Ji aayan nu', english: 'welcome', pos: 'phrase' },
    { id: 'greetings-fer-milange', topic: 'greetings', gurmukhi: 'ਫੇਰ ਮਿਲਾਂਗੇ', roman: 'Fer milange', english: 'see you later', pos: 'phrase', accept: ['Phir milange'] },
    { id: 'greetings-mil-ke-khushi-hoyi', topic: 'greetings', gurmukhi: 'ਤੁਹਾਨੂੰ ਮਿਲ ਕੇ ਖ਼ੁਸ਼ੀ ਹੋਈ', roman: 'Tuhanu mil ke khushi hoyi', english: 'nice to meet you', pos: 'phrase' },
    { id: 'greetings-achha', topic: 'greetings', gurmukhi: 'ਅੱਛਾ', roman: 'achha', english: 'okay; I see; really?', pos: 'phrase' },
    { id: 'greetings-koi-gall-nahi', topic: 'greetings', gurmukhi: 'ਕੋਈ ਗੱਲ ਨਹੀਂ', roman: 'Koi gall nahi', english: 'no worries; it’s nothing', pos: 'phrase' },
    { id: 'greetings-rabb-rakha', topic: 'greetings', gurmukhi: 'ਰੱਬ ਰਾਖਾ', roman: 'Rabb rakha', english: 'goodbye; God keep you', pos: 'phrase' },
];

export default words;
