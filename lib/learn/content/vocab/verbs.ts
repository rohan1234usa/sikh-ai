// Vocabulary: the verbs you need most, each as its -na infinitive with an
// example sentence. Daily-routine verbs (uthna, nahauna, sauna) are in the
// home topic. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Many examples come from
// the lessons and the phrasebook, and are spelled the same way
// (tests/learn/content.test.ts checks it). By the house rules ਪੀਣਾ is pina.
//
// Open questions for that review:
// - ਚਲਣਾ is spelled without addak, to match ਚਲੋ in the phrasebook.
// - khedna (to play) and banauna (to make, to cook).

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    {
        id: 'verbs-hona', topic: 'verbs', gurmukhi: 'ਹੋਣਾ', roman: 'hona', english: 'to be; to become; to happen', pos: 'verb',
        example: { gurmukhi: 'ਕੀ ਹੋਇਆ?', roman: 'Ki hoya?', english: 'What happened?' },
    },
    {
        id: 'verbs-karna', topic: 'verbs', gurmukhi: 'ਕਰਨਾ', roman: 'karna', english: 'to do', pos: 'verb',
        example: { gurmukhi: 'ਤੁਸੀਂ ਕੀ ਕਰਦੇ ਹੋ?', roman: 'Tusi ki karde ho?', english: 'What do you do?' },
    },
    {
        id: 'verbs-jana', topic: 'verbs', gurmukhi: 'ਜਾਣਾ', roman: 'jana', english: 'to go', pos: 'verb',
        example: { gurmukhi: 'ਮੈਂ ਘਰ ਜਾ ਰਿਹਾ ਹਾਂ', roman: 'Main ghar ja riha haan', english: 'I am going home (a man speaking)' },
    },
    {
        id: 'verbs-auna', topic: 'verbs', gurmukhi: 'ਆਉਣਾ', roman: 'auna', english: 'to come', pos: 'verb',
        example: { gurmukhi: 'ਇੱਥੇ ਆਓ', roman: 'Ithe aao', english: 'Come here' },
    },
    {
        id: 'verbs-khana', topic: 'verbs', gurmukhi: 'ਖਾਣਾ', roman: 'khana', english: 'to eat', pos: 'verb',
        example: { gurmukhi: 'ਰੋਟੀ ਖਾ ਲਵੋ', roman: 'Roti kha lavo', english: 'Come and eat (politely)' },
    },
    {
        id: 'verbs-pina', topic: 'verbs', gurmukhi: 'ਪੀਣਾ', roman: 'pina', english: 'to drink', pos: 'verb', accept: ['peena'],
        example: { gurmukhi: 'ਪਾਣੀ ਪੀ ਲਵੋ', roman: 'Pani pi lavo', english: 'Have some water' },
    },
    {
        id: 'verbs-baithna', topic: 'verbs', gurmukhi: 'ਬੈਠਣਾ', roman: 'baithna', english: 'to sit', pos: 'verb',
        example: { gurmukhi: 'ਬੈਠੋ ਜੀ', roman: 'Baitho ji', english: 'Please sit' },
    },
    {
        id: 'verbs-bolna', topic: 'verbs', gurmukhi: 'ਬੋਲਣਾ', roman: 'bolna', english: 'to speak', pos: 'verb',
        example: { gurmukhi: 'ਹੌਲੀ ਹੌਲੀ ਬੋਲੋ ਜੀ', roman: 'Hauli hauli bolo ji', english: 'Please speak slowly' },
    },
    {
        id: 'verbs-kehna', topic: 'verbs', gurmukhi: 'ਕਹਿਣਾ', roman: 'kehna', english: 'to say; to tell', pos: 'verb',
        example: { gurmukhi: 'ਮੰਮੀ ਕਹਿੰਦੇ ਹਨ', roman: 'Mummy kehnde han', english: 'Mom says' },
    },
    {
        id: 'verbs-sunna', topic: 'verbs', gurmukhi: 'ਸੁਣਨਾ', roman: 'sunna', english: 'to listen; to hear', pos: 'verb',
        example: { gurmukhi: 'ਮੇਰੀ ਗੱਲ ਸੁਣੋ', roman: 'Meri gall suno', english: 'Listen to me' },
    },
    {
        id: 'verbs-dekhna', topic: 'verbs', gurmukhi: 'ਦੇਖਣਾ', roman: 'dekhna', english: 'to see; to watch', pos: 'verb',
        example: { gurmukhi: 'ਮੈਂ ਫ਼ਿਲਮ ਦੇਖੀ', roman: 'Main film dekhi', english: 'I watched a film' },
    },
    {
        id: 'verbs-parhna', topic: 'verbs', gurmukhi: 'ਪੜ੍ਹਨਾ', roman: 'parhna', english: 'to read; to study', pos: 'verb',
        example: { gurmukhi: 'ਉਸ ਨੇ ਕਿਤਾਬ ਪੜ੍ਹੀ', roman: 'Us ne kitaab parhi', english: 'He (or she) read the book' },
    },
    {
        id: 'verbs-likhna', topic: 'verbs', gurmukhi: 'ਲਿਖਣਾ', roman: 'likhna', english: 'to write', pos: 'verb',
        example: { gurmukhi: 'ਆਪਣਾ ਨਾਮ ਲਿਖੋ', roman: 'Apna naam likho', english: 'Write your name' },
    },
    {
        id: 'verbs-dena', topic: 'verbs', gurmukhi: 'ਦੇਣਾ', roman: 'dena', english: 'to give', pos: 'verb',
        example: { gurmukhi: 'ਮੈਨੂੰ ਪਾਣੀ ਦਿਓ', roman: 'Mainu pani deo', english: 'Give me some water, please' },
    },
    {
        id: 'verbs-laina', topic: 'verbs', gurmukhi: 'ਲੈਣਾ', roman: 'laina', english: 'to take', pos: 'verb', accept: ['lena'],
        example: { gurmukhi: 'ਪ੍ਰਸ਼ਾਦ ਲੈ ਲਵੋ ਜੀ', roman: 'Parshad lai lavo ji', english: 'Please take Parshad' },
    },
    {
        id: 'verbs-milna', topic: 'verbs', gurmukhi: 'ਮਿਲਣਾ', roman: 'milna', english: 'to meet; to get', pos: 'verb',
        example: { gurmukhi: 'ਫੇਰ ਮਿਲਾਂਗੇ', roman: 'Fer milange', english: 'See you later' },
    },
    {
        id: 'verbs-rehna', topic: 'verbs', gurmukhi: 'ਰਹਿਣਾ', roman: 'rehna', english: 'to live; to stay', pos: 'verb',
        example: { gurmukhi: 'ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ?', roman: 'Tusi kithe rehnde ho?', english: 'Where do you live?' },
    },
    {
        id: 'verbs-samajhna', topic: 'verbs', gurmukhi: 'ਸਮਝਣਾ', roman: 'samajhna', english: 'to understand', pos: 'verb',
        example: { gurmukhi: 'ਮੈਂ ਸਮਝ ਗਿਆ', roman: 'Main samajh gaya', english: 'Got it (a man speaking)' },
    },
    {
        id: 'verbs-sochna', topic: 'verbs', gurmukhi: 'ਸੋਚਣਾ', roman: 'sochna', english: 'to think', pos: 'verb',
        example: { gurmukhi: 'ਸੋਚ ਕੇ ਦੱਸਾਂਗਾ', roman: 'Soch ke dassanga', english: 'I will think and let you know (a man speaking)' },
    },
    {
        id: 'verbs-sikhna', topic: 'verbs', gurmukhi: 'ਸਿੱਖਣਾ', roman: 'sikhna', english: 'to learn', pos: 'verb',
        example: { gurmukhi: 'ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਹੀ ਹਾਂ', roman: 'Main Punjabi sikh rahi haan', english: 'I am learning Punjabi (a woman speaking)' },
    },
    {
        id: 'verbs-lagna', topic: 'verbs', gurmukhi: 'ਲੱਗਣਾ', roman: 'lagna', english: 'to seem; to be felt', pos: 'verb',
        example: { gurmukhi: 'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', roman: 'Mainu bhukh lagi hai', english: 'I am hungry' },
    },
    {
        id: 'verbs-chalna', topic: 'verbs', gurmukhi: 'ਚਲਣਾ', roman: 'chalna', english: 'to walk; to go along', pos: 'verb',
        example: { gurmukhi: 'ਚਲੋ, ਚਲੀਏ', roman: 'Chalo, chaliye', english: 'Come on, let’s go' },
    },
    {
        id: 'verbs-banauna', topic: 'verbs', gurmukhi: 'ਬਣਾਉਣਾ', roman: 'banauna', english: 'to make; to cook', pos: 'verb',
        example: { gurmukhi: 'ਮੰਮੀ ਨੇ ਦਾਲ ਬਣਾਈ', roman: 'Mummy ne daal banayi', english: 'Mom made daal' },
    },
    {
        id: 'verbs-khedna', topic: 'verbs', gurmukhi: 'ਖੇਡਣਾ', roman: 'khedna', english: 'to play', pos: 'verb',
        example: { gurmukhi: 'ਬੱਚੇ ਬਾਹਰ ਖੇਡ ਰਹੇ ਹਨ', roman: 'Bache bahar khed rahe han', english: 'The kids are playing outside' },
    },
];

export default words;
