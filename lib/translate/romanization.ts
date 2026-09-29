// SERVER-ONLY: the site's house romanization, as prompt text. The
// translator (lib/translate/prompts.ts) and the Punjabi tutor
// (lib/learn/prompts.ts) both build it into their system instructions, so
// both write romanized Punjabi the same way, the way Punjabi families text
// each other, as the phrasebook (lib/translate/phrasebook.ts), the romanized
// interface (lib/i18n/dictionaries/pa-latn.ts) and the Learn Punjabi lessons
// do.
//
// A blanket "double every long vowel" rule gave "Chaachaa ji" and "Taaiaa
// Ji" where families write Chacha ji and Taya ji, so length is only marked
// where a learner needs to hear it. The examples come from the pa-latn
// dictionary and the 20 phrases `--limit 20` covers in the translator eval.
// The other 30 phrases were the check that the rules generalize
// (npm run eval:translate -- --limit 50); a few of their words were pinned
// here afterwards, where the model wavered (Kirtan, Ardaas, Ji aayan nu,
// nahi).
//
// Changing either constant changes what translations look like: bump
// TRANSLATE_RESULT_REV in ./config so saved history stops being reused,
// and rerun npm run build:phrasebook. The phrasebook test fails until then,
// because it fingerprints the whole translate request.

// The spelling rules, one bullet per line.
export const ROMANIZATION_RULES = `- Plain ASCII only: no diacritics, no dots, no apostrophes.
- A vowel sign at the END of a word is always one letter: ਾ → a, ੀ → i, ੂ → u (ਕੀ ki, ਜੀ ji, ਤੁਸੀਂ tusi, ਰੋਟੀ roti, ਖਾ kha, ਅੱਛਾ achha, ਸਕਦਾ sakda, ਮੈਨੂੰ mainu).
- Inside a word, double a long vowel only where a learner needs to hear the length — in a one-syllable word or in the last syllable of a longer one: ਹਾਲ haal, ਨਾਲ naal, ਪਾਠ paath, ਠੀਕ theek, ਸੁਆਦ suaad, ਇਤਿਹਾਸ itihaas, ਅਨੁਵਾਦ anuvaad, ਪਰਿਵਾਰ parivaar. A one-syllable word keeps it before a nasal (ਹਾਂ haan, ਹਾਂਜੀ haanji); at the end of a longer word ਾਂ is an (ਪਹਿਲਾਂ pehlan, ਸ਼ਬਦਾਂ shabdan).
- Everywhere else write the long vowel once, as the community does: kinship terms (ਚਾਚਾ chacha, ਤਾਇਆ taya, ਮਾਮਾ mama, ਮਾਸੀ masi), everyday words (ਦੁਬਾਰਾ dubara, ਚਾਹੀਦਾ chahida, ਬਿਮਾਰੀ bimari), and Sikh terms (Khalsa, Sangat, Guru, Sahib, Bani, Kirtan).
- Short vowels single a/i/u; ੇ → e, ੈ → ai (hai, main, lai), ੋ → o, ੌ → au (hauli, kaun); ਇਹ ih, ਪਹਿਲਾਂ pehlan. After a vowel, ਇਆ/ਈ → ya/yi (ਤਾਇਆ taya, ਗਿਆ gaya, ਲਈ layi); after a consonant, ਿਆ → ia (ਮਿਲਿਆ milia, ਸਕਿਆ sakia).
- Aspirated consonants as consonant + h: kh, gh, chh, jh, th, dh, ph, bh. ੜ is rh (ਥੋੜ੍ਹੀ thorhi, ਪੜ੍ਹੋ parho, ਨੇੜਲੀ nerhli). ਵ is v (vich, seva, lavo) except in the fixed spellings below.
- A doubled consonant (ੱ) is written twice — ਬੱਸ bass, ਰੱਜ rajj, ਦੱਸੋ dasso, ਗੱਲਬਾਤ gallbaat, ਲੱਭੋ labbho — except ch, chh, kh and th, which stay single: ਅੱਛਾ achha, ਪੁੱਛੋ puchho, ਵਿੱਚ vich, ਸਿੱਖ Sikh, ਮੱਥਾ matha, ਮਿੱਠਾ mitha, ਇੱਥੇ ithe.
- Nasalization is written n or m as commonly heard (main, haan, ton, vichon, Punjabi) — no special marks — and not at all after a final ੀ or ੂ (ਤੁਸੀਂ tusi, ਨਹੀਂ nahi, ਮੈਨੂੰ mainu). Retroflex and dental are both spelled t/d/n — cover that difference in pronunciation tips, not in spelling. English loanwords keep their English spelling.
- Fixed community spellings, always exactly so, even where they break the rules above: Waheguru, Gurdwara, Khalsa, Punjabi, Hukamnama, Darbar Sahib, Akal, Ardaas, Parshad, Karah Parshad, langar, seva, and the greetings Sat Sri Akal, Ji aayan nu, Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.`;

// How to capitalize, without the "- " of a bullet.
export const ROMANIZATION_CAPITALS = `Capitalize like an English sentence: the first word of each sentence, plus proper nouns and Sikh terms of reverence (Waheguru, Guru, Gurdwara, Khalsa, Hukamnama, Punjabi, Sat Sri Akal); everything else lowercase. "ji" is lowercase after a kinship or everyday word (Chacha ji, Hor lavo ji) and capitalized only inside a name or formal title (Guru Nanak Dev Ji, Waheguru Ji Ka Khalsa).`;
