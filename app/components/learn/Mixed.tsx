// English text with Punjabi in it ("Tippi goes with ਪੰਜ and ਸਿੰਘ"): each run of
// Gurmukhi is marked lang="pa", so a screen reader reads it with a Punjabi
// voice instead of spelling it out in English. Nothing changes on screen: the
// site's fonts already cover Gurmukhi. A run takes in a dotted circle before a
// vowel sign (◌ਾ), dandas, and the spaces between Gurmukhi words.
const RUN = /(◌?\p{Script=Gurmukhi}(?:[\p{Script=Gurmukhi}\p{M}।॥]|[  ](?=◌?\p{Script=Gurmukhi}))*)/u;

export default function Mixed({ text }: { text: string }) {
    const parts = text.split(RUN);
    if (parts.length === 1) return text;
    // split() with a capture group alternates text and runs: runs are the odd ones.
    return parts.map((part, i) => (i % 2 === 1 ? <span key={i} lang="pa">{part}</span> : part));
}
