// A streaming reply, cut into Markdown blocks that can each be rendered on
// their own. Text only ever arrives at the end, so every block but the last
// is finished: the chat renders each one once, and every new piece re-parses
// only the unfinished end instead of the whole reply (#22).
//
// A cut goes at a blank line, before a line that starts a new block of its
// own. Never:
// - inside a fenced code block (``` or ~~~), which may hold blank lines;
// - before an indented line, which may continue a list item;
// - before a list item, so a list separated by blank lines stays one list
//   (its items keep their spacing and numbering);
// - before a line that hasn't finished arriving, which might yet turn into
//   a list item.
// Joining the blocks gives back the text exactly. A finished reply is still
// rendered whole, so anything the cuts get wrong (a reference-style link
// defined in a later block) lasts only while it streams.

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^([-*+]|\d{1,9}[.)])(\s|$)/;

export function splitMarkdownBlocks(text: string): string[] {
    const lines = text.split('\n');
    const blocks: string[] = [];
    let start = 0; // index into lines of the current block's first line
    let fence: string | null = null; // the open fence's marker, while inside one
    let blankBefore = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const complete = i < lines.length - 1; // a newline follows it
        if (fence) {
            const close = FENCE.exec(line);
            if (close && close[1][0] === fence[0] && close[1].length >= fence.length && line.trim() === close[1]) fence = null;
            blankBefore = false;
            continue;
        }
        if (line.trim() === '') {
            blankBefore = true;
            continue;
        }
        if (blankBefore && i > start && complete && !/^\s/.test(line) && !LIST_ITEM.test(line)) {
            blocks.push(lines.slice(start, i).join('\n') + '\n');
            start = i;
        }
        blankBefore = false;
        const open = FENCE.exec(line);
        if (open) fence = open[1];
    }
    blocks.push(lines.slice(start).join('\n'));
    return blocks;
}
