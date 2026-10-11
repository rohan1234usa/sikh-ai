# Pothi: SikhAI's next look

**Status:** chosen on 10 October 2026, not built yet. This page is the spec for building it.

**The study:** [scheme-studies.html](scheme-studies.html) shows Pothi beside the three schemes it was weighed against: Nishan, Sarovar and Phulkari. Each one renders the same real content: the Hukamnama of Assu 26, 558 from Ang 685, a chat reply with its Gurbani check, an event from the Seva board and a Gurmukhi lesson. Download the file and open it in a browser. Its fonts load from Google Fonts.

## Why Pothi

The site's values are already enforced in code. The chat's system prompt says SikhAI is never a Guru and never invents Gurbani. The Gurbani check says its lines come word for word from GurbaniNow, not from the AI. The look should make the same promise before anyone reads a label.

Pothi treats every screen as a page of a bir:
- Gurbani is set in a text face made for Gurmukhi, at a reading measure.
- The raag and the Ang are rubrics, and gold hairlines take the place of boxes.
- Everything else is set smaller and quieter in the same family: the AI's replies, the tools and the chrome.

So the Guru's words look senior to the machine's.

The current look follows the 2023 AI start-up idiom: a navy gradient hero with glows, a mock chat window, a "Powered by Google Gemini" badge, rounded shadowed cards, and Gurmukhi in a fallback font set bold. Pothi keeps the site's kesri and its blue and drops the rest.

## Palette

The semantic tokens in `app/globals.css` already carry about 850 class uses, so most of the palette changes in one file. By day the ground is eggshell. At night the day turns inside out: eggshell text on an ink ground.

| Token | Job | Day | Night |
|---|---|---|---|
| `--surface` | page ground | `#F6F2EB` eggshell | `#171512` ink |
| `--surface-raised` | panels, fields | `#F9F6F2` | `#1F1D1A` |
| `--ink` | text | `#1D1711` | `#EAE6DF` |
| `--ink-muted` | secondary text | `#61564B` | `#B4AFA7` |
| `--ink-faint` | tertiary text | `#746C62` | `#928D86` |
| `--edge` | hairline rules | `#DAD5CD` | `#3E3B37` |
| `--edge-strong` | field and button outlines | `#837C73` | `#78746E` |
| `--accent-text` | kesri rubrics | `#AD4E08` | `#FF9933` |
| `--link` (new) | links, the focus ring | `#1E3F8F` | `#A0BAF2` |
| `--gold` (new) | gold rules, the border band, progress | `#9A7620` | `#CDA65A` |
| `--good` (new) | a quote that matches the source | `#2F5E2A` | `#99CE9A` |

`THEME_COLORS` in `lib/theme.ts` must equal `--surface`: `light: '#F6F2EB'` and `dark: '#171512'`.

### Contrast

Each figure is the token's lowest WCAG ratio against the ground and the raised surface of that mode, rounded down.

| Token | Day | Night | Needs |
|---|---|---|---|
| `--ink` | 15.9:1 | 13.5:1 | 4.5 |
| `--ink-muted` | 6.3:1 | 7.7:1 | 4.5 |
| `--ink-faint` | 4.6:1 | 5.1:1 | 4.5 |
| `--edge-strong` | 3.6:1 | 3.6:1 | 3, outlines |
| `--accent-text` | 4.8:1 | 7.8:1 | 4.5 |
| `--link` | 8.7:1 | 8.6:1 | 4.5 |
| `--gold` | 3.7:1 | 7.3:1 | 3, graphics only |
| `--good` | 6.8:1 | 9.3:1 | 4.5 |

### Kesri needs two values

The site already switches kesri between modes: `--accent-text` is kesri-deep `#B45309` in light and kesri `#FF9933` in dark. That holds for Pothi with one change:
- **By day:** `#B45309` reaches only 4.50:1 on eggshell, with no margin. Deepen it to `#AD4E08`, which reaches 4.86:1.
- **At night:** keep full kesri, at 8.55:1 on ink. Kesri-deep would fail there, at 3.63:1.

### Links get their own colour

About a third of the 106 uses of `text-accent-text` are links. Pothi keeps kesri for rubrics: the raag, the Ang and labels. Anything you can press takes `--link`, which also draws the focus ring.

## Type

- **Tiro Gurmukhi** sets Gurbani, Punjabi and running Latin. One family carries both scripts, so a quoted tukk inside an English sentence keeps its voice. It has one weight (400) and an italic, in the `gurmukhi`, `latin` and `latin-ext` subsets.
- **Newsreader** sets display text: page titles, folio headers and the Hukamnama's translation. It is variable, from weight 200 to 800 and optical size 6 to 72, with an italic.
- **Geist Mono** stays for inline code in chat replies.

Both new faces come through `next/font/google`, which serves the files from the site itself. The Content Security Policy's `font-src 'self'` needs no new host.

Tiro Gurmukhi has no bold, and a browser fakes a missing bold by smearing the glyphs. Five places set Gurmukhi in bold today. Each one drops `font-bold` and uses size instead:
- `app/[lang]/hukamnama/page.tsx`, for the raag and for each line;
- `app/[lang]/shabad/[ang]/page.tsx`;
- `app/components/shabad/ShabadVerse.tsx`;
- `app/components/shabad/VerseResultCard.tsx`.

Setting `font-synthesis-weight: none` on the Gurmukhi stack stops any bold that slips through from being faked.

## System

- **Rules, not cards.** Hairline rules, margins and a folio header do the structuring. Corners are square, with no shadows.
- **One ornament.** A gold and kesri border band, after illuminated birs, at the top of a page.
- **Three voices.** Source (Gurbani from GurbaniNow), SikhAI, and you each get their own register. Gurbani quoted inside a reply is set like Source, never like the AI's prose.
- **The tukk.** The Gurmukhi, transliteration and translation are one unit wherever they appear. It is built once.
- **Chat is a transcript.** Your line carries a kesri label. Quoted Gurbani is indented on a gold rule. The Gurbani check becomes numbered footnotes.
- **Motion is a fade.** Nothing floats, bounces or glows, and the existing reduced-motion rule still zeroes every duration.

## Build plan

Commit once per step, in this order:

1. **Tokens.** Put the values above in `app/globals.css` under `:root` and `.dark`, add `--link`, `--gold` and `--good`, and update `THEME_COLORS` in `lib/theme.ts`.
2. **Fonts.** In `app/fonts.ts`, replace Geist and Noto Sans Gurmukhi with Tiro Gurmukhi and Newsreader. Point `--font-sans` and `--font-gurmukhi` at Tiro and add a display token. Drop bold from Gurmukhi in the five places above.
3. **The tukk component.** Build one component with a fixed rhythm. It goes on the Hukamnama page, the Ang and shabad pages (`ShabadVerse.tsx`), search results (`VerseResultCard.tsx`), the Gurbani check (`Citations.tsx`), the translator (`TranslationCard.tsx`) and Learn (`ExampleRow.tsx`, `WordList.tsx`).
4. **Chrome.** Restyle the navbar, the footer, `app/components/buttons.ts` and `app/components/seva/styles.ts`. Then replace the 150 literal navy, kesri and slate classes in 45 files. These include the navy bands that open the home, Shabad, Translator, Learn and Seva pages, and the five `[--focus-ring:var(--color-kesri)]` overrides they carry.
5. **Home.** The hero becomes the day's Hukamnama, live. The mock chat window and the Gemini badge go. Gemini stays named where it matters: the chat's disclaimer and /privacy.
6. **Chat.** Move to the transcript layout in `Bubbles.tsx` and `ChatMessage.tsx`, which the Punjabi tutor shares. Turn the Gurbani check in `Citations.tsx` into footnotes.

## Checks for the build

- Run axe on every page in both modes, and check the contrast of any new pair.
- In forced colours, rules and focus rings must survive.
- Check 360 px wide in English, Gurmukhi and romanized Punjabi.
- The `theme-color` tag must follow the new grounds.
- Test with reduced motion on.
- Run `npm run audit:i18n -- --dry-run` and commit the report if any string changes.

## Open decisions for the owner

- **Kesri or vermilion for rubrics.** Pothi was drawn with vermilion: `#A5281F` by day and `#E9745C` at night, each at least 5.6:1. The recommendation is kesri, so the brand's colour carries through.
- **Forms.** Decide whether dense screens keep Tiro's Latin or take Newsreader: the translator, Seva's hosting form and account dialogs.
- **Two borrowings the study suggests.** Nishan's equal-cell grid for the home page's features, and Sarovar's single dawn gradient for the Hukamnama header only.
