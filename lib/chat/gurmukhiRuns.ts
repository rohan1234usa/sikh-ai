// Client-safe: a rehype plugin for chat and tutor replies (app/components/chat/Bubbles.tsx).
// It wraps each stretch of Gurmukhi in a reply in <span lang="pa">, so a screen
// reader reads it as Punjabi, and gives the stretches that are Gurbani the
// Gurbani face (font-gurmukhi), like the source they quote.
//
// Which stretches are Gurbani depends on the reply:
//   'quotes'  only those inside a blockquote. For a reply written in Punjabi,
//             and the tutor's: their Gurmukhi is prose, and keeps the
//             interface's face.
//   'all'     every one. For a reply in English, whose Gurmukhi is quoted
//             Gurbani, wherever the answer put it: a Gurbani-first answer often
//             sets its tukk in a bold line of its own, not in a quote.
// Stretches, not paragraphs: one paragraph often holds the tukk, its
// transliteration and its translation, and only the first is Gurmukhi.
//
// It works on react-markdown's HTML tree with no dependency of its own, node by
// node, so a reply rendered a block at a time while it streams comes out the
// same as the whole reply (lib/chat/markdownBlocks.ts). Code is left as written.

export type GurbaniIn = 'quotes' | 'all';

type Node = {
    type: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, unknown>;
    children?: Node[];
};

// A stretch starts and ends on a Gurmukhi letter, sign, digit or danda, and may
// hold spaces between them: "ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥" is one stretch.
const GURMUKHI = '\\u0A01-\\u0A76\\u0964\\u0965';
const RUN = new RegExp(`[${GURMUKHI}](?:[${GURMUKHI}\\s]*[${GURMUKHI}])?`, 'g');
const SKIP = new Set(['code', 'pre']);

export function rehypeGurmukhiRuns(options?: { gurbani?: GurbaniIn }) {
    const all = options?.gurbani === 'all';
    return (tree: unknown) => {
        walk(tree as Node, all);
    };
}

function walk(node: Node, gurbani: boolean): void {
    if (!node.children || (node.type === 'element' && SKIP.has(node.tagName ?? ''))) return;
    const here = gurbani || (node.type === 'element' && node.tagName === 'blockquote');
    const children: Node[] = [];
    for (const child of node.children) {
        if (child.type === 'text' && typeof child.value === 'string') {
            children.push(...splitRuns(child.value, here));
        } else {
            walk(child, here);
            children.push(child);
        }
    }
    node.children = children;
}

function splitRuns(value: string, gurbani: boolean): Node[] {
    const nodes: Node[] = [];
    let last = 0;
    for (const match of value.matchAll(RUN)) {
        const start = match.index ?? 0;
        if (start > last) nodes.push({ type: 'text', value: value.slice(last, start) });
        nodes.push({
            type: 'element',
            tagName: 'span',
            properties: gurbani ? { lang: 'pa', className: ['font-gurmukhi'] } : { lang: 'pa' },
            children: [{ type: 'text', value: match[0] }],
        });
        last = start + match[0].length;
    }
    if (nodes.length === 0) return [{ type: 'text', value }];
    if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
    return nodes;
}

// Whether a reply is written in Gurmukhi: most of its letters are. ChatMessage
// asks this of a reply in Punjabi rather than trusting its saved script, since
// the prompt mirrors a user who types in the other script (lib/chat/prompts.ts).
const GURMUKHI_CHAR = new RegExp(`[${GURMUKHI}]`, 'g');
export function inGurmukhi(text: string): boolean {
    const gurmukhi = text.match(GURMUKHI_CHAR)?.length ?? 0;
    const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
    return gurmukhi > latin;
}
