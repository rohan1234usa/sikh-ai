// Vocabulary: the Gurdwara and seva. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker, especially the short
// English descriptions of things of reverence. Spellings follow the
// phrasebook and the fixed community spellings (Gurdwara, Hukamnama,
// langar, seva, Ardaas, Parshad), then the house rules.
//
// Open questions for that review:
// - Is "rumaal" right for the head coverings kept at the entrance, next to
//   "rumaala" for the cloths over Sri Guru Granth Sahib Ji?
// - Which of these terms should be capitalized in running romanized text?

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'gurdwara-gurdwara', topic: 'gurdwara', gurmukhi: 'ਗੁਰਦੁਆਰਾ', roman: 'Gurdwara', english: 'Gurdwara, the Guru’s door: a Sikh place of worship', pos: 'noun', gender: 'm', accept: ['gurudwara'] },
    { id: 'gurdwara-darbar', topic: 'gurdwara', gurmukhi: 'ਦਰਬਾਰ', roman: 'darbar', english: 'the main hall, where Sri Guru Granth Sahib Ji is', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-palki', topic: 'gurdwara', gurmukhi: 'ਪਾਲਕੀ', roman: 'palki', english: 'the canopied throne of Sri Guru Granth Sahib Ji', pos: 'noun', gender: 'f' },
    { id: 'gurdwara-langar', topic: 'gurdwara', gurmukhi: 'ਲੰਗਰ', roman: 'langar', english: 'the free community kitchen and meal', pos: 'noun', gender: 'm', note: 'Everyone sits together on the floor, whoever they are.' },
    { id: 'gurdwara-seva', topic: 'gurdwara', gurmukhi: 'ਸੇਵਾ', roman: 'seva', english: 'selfless service', pos: 'noun', gender: 'f' },
    { id: 'gurdwara-sevadaar', topic: 'gurdwara', gurmukhi: 'ਸੇਵਾਦਾਰ', roman: 'sevadaar', english: 'a volunteer who does seva', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-sangat', topic: 'gurdwara', gurmukhi: 'ਸੰਗਤ', roman: 'Sangat', english: 'the congregation', pos: 'noun', gender: 'f' },
    { id: 'gurdwara-parshad', topic: 'gurdwara', gurmukhi: 'ਪ੍ਰਸ਼ਾਦ', roman: 'Parshad', english: 'the blessed sweet offering', pos: 'noun', gender: 'm', note: 'Karah Parshad; receive it with both hands cupped.' },
    { id: 'gurdwara-ardaas', topic: 'gurdwara', gurmukhi: 'ਅਰਦਾਸ', roman: 'Ardaas', english: 'the congregational prayer', pos: 'noun', gender: 'f' },
    { id: 'gurdwara-kirtan', topic: 'gurdwara', gurmukhi: 'ਕੀਰਤਨ', roman: 'Kirtan', english: 'the singing of Gurbani', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-paath', topic: 'gurdwara', gurmukhi: 'ਪਾਠ', roman: 'paath', english: 'a reading of Gurbani', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-hukamnama', topic: 'gurdwara', gurmukhi: 'ਹੁਕਮਨਾਮਾ', roman: 'Hukamnama', english: 'the Guru’s command of the day', pos: 'noun', gender: 'm', note: 'Read each day from the page where Sri Guru Granth Sahib Ji opens.' },
    { id: 'gurdwara-granthi', topic: 'gurdwara', gurmukhi: 'ਗ੍ਰੰਥੀ', roman: 'granthi', english: 'the reader who cares for Sri Guru Granth Sahib Ji', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-nishan-sahib', topic: 'gurdwara', gurmukhi: 'ਨਿਸ਼ਾਨ ਸਾਹਿਬ', roman: 'Nishan Sahib', english: 'the Sikh flag flown at every Gurdwara', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-jorha-ghar', topic: 'gurdwara', gurmukhi: 'ਜੋੜਾ ਘਰ', roman: 'jorha ghar', english: 'the shoe room', pos: 'noun', gender: 'm', accept: ['jora ghar', 'joda ghar'] },
    { id: 'gurdwara-rumaal', topic: 'gurdwara', gurmukhi: 'ਰੁਮਾਲ', roman: 'rumaal', english: 'a head covering; a handkerchief', pos: 'noun', gender: 'm', note: 'Kept in baskets at the entrance for anyone who needs one.' },
    { id: 'gurdwara-chaur', topic: 'gurdwara', gurmukhi: 'ਚੌਰ', roman: 'chaur', english: 'the whisk waved over Sri Guru Granth Sahib Ji', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-simran', topic: 'gurdwara', gurmukhi: 'ਸਿਮਰਨ', roman: 'simran', english: 'remembering Waheguru, often by repeating the Name', pos: 'noun', gender: 'm' },
    { id: 'gurdwara-gutka', topic: 'gurdwara', gurmukhi: 'ਗੁਟਕਾ', roman: 'gutka', english: 'a small prayer book', pos: 'noun', gender: 'm', note: 'Treated with respect: gutka sahib.' },
    { id: 'gurdwara-nitnem', topic: 'gurdwara', gurmukhi: 'ਨਿਤਨੇਮ', roman: 'nitnem', english: 'the daily prayers', pos: 'noun', gender: 'm' },
    {
        id: 'gurdwara-matha-tekna', topic: 'gurdwara', gurmukhi: 'ਮੱਥਾ ਟੇਕਣਾ', roman: 'matha tekna', english: 'to bow before Sri Guru Granth Sahib Ji', pos: 'verb',
        example: { gurmukhi: 'ਅਸੀਂ ਮੱਥਾ ਟੇਕਿਆ', roman: 'Asi matha tekia', english: 'We bowed' },
    },
    {
        id: 'gurdwara-chhakna', topic: 'gurdwara', gurmukhi: 'ਛਕਣਾ', roman: 'chhakna', english: 'to eat langar or Parshad', pos: 'verb',
        example: { gurmukhi: 'ਲੰਗਰ ਛਕ ਲਵੋ ਜੀ', roman: 'Langar chhak lavo ji', english: 'Please have langar' },
        note: 'The respectful verb for langar and Parshad, not the everyday word for eating.',
    },
];

export default words;
