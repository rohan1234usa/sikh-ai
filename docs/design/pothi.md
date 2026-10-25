# Pothi: SikhAI's look

**Status:** chosen on 10 October 2026 and built on 11 October 2026. This page is the spec the build followed; what changed along the way is under [As built](#as-built).

**The study:** [scheme-studies.html](scheme-studies.html) shows Pothi beside the three schemes it was weighed against: Nishan, Sarovar and Phulkari. Each one renders the same real content: the Hukamnama of Assu 26, 558 from Ang 685, a chat reply with its Gurbani check, an event from the Seva board and a Gurmukhi lesson. Download the file and open it in a browser. Its fonts load from Google Fonts.

## Why Pothi

The site's values are already enforced in code. The chat's system prompt says SikhAI is never a Guru and never invents Gurbani. The Gurbani check says its lines come word for word from GurbaniNow, not from the AI. The look should make the same promise before anyone reads a label.

Pothi treats every screen as a page of a bir:
- Gurbani is set in a text face made for Gurmukhi, at a reading measure.
- The raag and the Ang are rubrics, and gold hairlines take the place of boxes.
- Everything else is set smaller and quieter: the AI's replies, the tools and the chrome.

So the Guru's words look senior to the machine's.

The look it replaced followed the 2023 AI start-up idiom: a navy gradient hero with glows, a mock chat window, a "Powered by Google Gemini" badge, rounded shadowed cards, and Gurmukhi in a fallback font set bold. Pothi keeps the site's kesri and its blue and drops the rest.

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
| `--link` (new) | links | `#1E3F8F` | `#A0BAF2` |
| `--focus-ring` | keyboard focus outline | `#1E3F8F` | `#A0BAF2` |
| `--rule-gold` (new) | gold rules, the border band, progress | `#9A7620` | `#CDA65A` |
| `--good` (new) | a quote that matches the source | `#2F5E2A` | `#99CE9A` |
| `--dawn-sky`, `--dawn-horizon` (new) | the dawn behind the Hukamnama's head | `#EAF4FB`, `#FDF0E0` | `#0C1723`, `#20140B` |

`THEME_COLORS` in `lib/theme.ts` must equal `--surface`: `light: '#F6F2EB'` and `dark: '#171512'`.

The dawn runs from `--dawn-sky` through the ground to `--dawn-horizon`. Every text token keeps AA on every stop: faint text, the lowest, is 4.6:1 by day and 5.4:1 at night.

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
| `--rule-gold` | 3.7:1 | 7.3:1 | 3, graphics only |
| `--good` | 6.8:1 | 9.3:1 | 4.5 |

### Kesri needs two values

The site already switches kesri between modes: `--accent-text` is kesri-deep `#B45309` in light and kesri `#FF9933` in dark. That holds for Pothi with one change:
- **By day:** `#B45309` reaches only 4.50:1 on eggshell, with no margin. Deepen it to `#AD4E08`, which reaches 4.86:1.
- **At night:** keep full kesri, at 8.55:1 on ink. Kesri-deep would fail there, at 3.63:1.

### Links get their own colour

Of the 106 uses of `text-accent-text`, 55 were links or text buttons. Pothi keeps kesri for rubrics: the raag, the Ang and labels. Anything you can press takes `--link`, and the existing `--focus-ring` token moves from kesri to the same blue.

## Type

Three faces, each with a job, so nothing ever needs a bold its font doesn't have:

- **Tiro Gurmukhi** sets Gurbani and other reading text in Gurmukhi: the Hukamnama, Angs, shabads, quoted tukks and the Gurbani check. It has one weight (400) and an italic, so hierarchy comes from size, never weight.
- **Newsreader** sets running Latin, headings and the interface. It is variable in weight, from 200 to 800, with an italic, so headings and buttons get real bolds. It's loaded without its optical-size axis, which would more than double its files.
- **Noto Serif Gurmukhi** sets Gurmukhi interface text, which is the whole interface under `/pa`. It is variable from weight 100 to 900, so Punjabi headings, buttons and labels keep their weight too.
- **Geist Mono** stays for inline code in chat replies.

All three come through `next/font/google`, which serves the files from the site itself. The Content Security Policy's `font-src 'self'` needs no new host.

The study sets running Latin in Tiro as well. This spec moves it to Newsreader because Tiro has no bold: the site has 252 `font-bold` and `font-semibold` uses, and a browser fakes a missing bold by smearing the glyphs. Under `/pa` every one of them is Gurmukhi, which is why the interface's Gurmukhi gets its own variable face.

Tiro is applied only where Gurbani is read, through the `font-gurmukhi` utility. Six places set that text in bold or semibold, and each dropped the weight for size:
- `app/[lang]/hukamnama/page.tsx`, for the raag and for each line;
- `app/[lang]/shabad/[ang]/page.tsx`;
- `app/components/shabad/ShabadVerse.tsx`;
- `app/components/shabad/VerseResultCard.tsx`;
- `app/components/learn/Quiz.tsx`, for a Gurmukhi answer choice (`font-semibold`).

Setting `font-synthesis-weight: none` on the `font-gurmukhi` utility stops any bold that slips through from being faked. Don't set it on the whole page: under `/pa` it would turn every Punjabi heading to regular weight.

## System

- **Rules, not cards.** Hairline rules, margins and a folio header do the structuring. Corners are square, with no shadows.
- **One ornament.** A gold and kesri border band, after illuminated birs, along the foot of the header. It's painted over a solid gold border, so a rule remains where forced colours drop backgrounds, and it sits inside the header's 4rem.
- **Three voices.** Source (Gurbani from GurbaniNow), SikhAI, and you each get their own register. Gurbani quoted inside a reply is set like Source, never like the AI's prose.
- **The tukk.** The Gurmukhi, transliteration and translation are one unit wherever they appear. It is built once.
- **Chat is a transcript.** Your line hangs on a kesri rule under "You". An answer is always labelled SikhAI, whatever lens it was asked through: the lens, which may be a Guru's name, is a setting said after the name, never the speaker. Quoted Gurbani is indented on a gold rule. The Gurbani check becomes numbered notes.
- **Motion is a fade.** Nothing floats, bounces or glows, and the existing reduced-motion rule still zeroes every duration.

## As built

One commit per step, in this order, so no commit put the new palette on the old navy:

1. **Groundwork.** One primary fill in `buttons.ts`; the `focus-ring`, `link`, `rule-gold` and `good` utilities on the old colours; nine focus cues that hard-coded kesri moved onto the token.
2. **Chrome.** The navbar and its band; page headers in place of the navy bands; controls and tints; links split from labels; Seva's stamps, double-hairline notices and gold capacity rule. Before it there were 136 lines of literal colour classes in 51 files. The five kesri focus overrides were on the navbar, the 404 page's header, the Learn hub's panel, the Seva header and the home hero, not on every band.
3. **Palette.** The tokens above, square corners and no shadows through Tailwind's own theme variables (`--radius`, `--radius-*`, `--shadow-*: initial`), a fade that no longer rises, and the theme and manifest colours.
4. **Type.** The three faces. The preloaded fonts come to 164 KB a page, against 63 KB for Geist and Noto Sans Gurmukhi.
5. **The tukk.** `app/components/gurbani/Tukk.tsx`, and `HukamnamaHeader` on the dawn. `/hukamnama` is rebuilt on a new parser, `parseHukamnamaPayload`, with a recorded fixture. It gained the transliterations, the heading kinds, the Ang link and GurbaniNow's attribution. Search results became ruled rows.
6. **Home.** A short masthead, then today's Hukamnama (its opening four verses), the Seva strip, and the six features in equal cells. The badge, mock chat, glows and motion went, with their four strings.
7. **Chat.** A transcript for the chat, the tutor and shared chats. `lib/chat/gurmukhiRuns.ts` marks every stretch of Gurmukhi in a reply as Punjabi for screen readers, and sets the Gurbani ones in Tiro. That means everything in quotes, and everything in a reply in English, since an answer often puts its tukk in a bold line of its own, not in a quote. A reply written in Punjabi keeps its prose in the interface face. The check's notes aren't marked in the reply's text, because they follow neither its order nor its wording.
8. **Refinement.** A survey of every page, in both modes and at 360 px, found six places that still fell short of "rules, not cards":
   - A shabad's page was a raised card. It is now set open, like the Hukamnama: a header ruled in gold, then the lines.
   - Each line on an Ang page ended with "Guru Granth Sahib Ji". The page's title says it once.
   - A tukk's closing ॥ could fall onto a line of its own on a phone. Gurbani lines now balance when they wrap (`text-wrap: balance`), and their Latin lines avoid a one-word last line.
   - Eighteen chips and toggles were still fully round. They now have the 2px corner.
   - Learn's tracks and topics were cards. They sit in equal cells, and a track's lessons are ruled rows led by kesri numerals.
   - The About page still had the old look. It is now set like the other pages.

   Three smaller clean-ups are filed as [#62](https://github.com/rohan1234usa/sikh-ai/issues/62): the dead `shadow-*` classes, one weight for page titles, and the home masthead's fade.

### Since the build

- **Learn's lessons** ([#67](https://github.com/rohan1234usa/sikh-ai/pull/67)):
  - A lesson's examples were the last boxed cards. They are now ruled rows in the tukk style, with the note under the row and no copy button.
  - A lesson page shows its progress as a 2px gold rule under the navbar, the width of the text, held apart from the band by a sliver of ground. Its fill is a border, so forced colours keep it.
  - The outline under a lesson's title is a numbered list with kesri numerals, between hairlines.
- **The Learn hub** ([#70](https://github.com/rohan1234usa/sikh-ai/pull/70)):
  - The panel at the top is "Today", with one kesri rubric. The kind of step (Continue, Up next, Start here) moved into the line under the lesson's title. It is still a raised field inside a hairline, the hub's last box, kept as it is for now.
  - A track's progress is a gold rule under its count, as on a lesson page, its fill a border so forced colours keep it. Until the track's first milestone, the cell shows the milestone in kesri and no rule.
  - Saving, reset and the AI-drafted caveat sit in a foot ruled off by a hairline, under a kesri "About your progress".
  - The flashcard review uses the Learn header. Each card names its topic in a kesri rubric, as the word list labels an example.

## Checks for the build

- Run axe on every page in both modes, and check the contrast of any new pair.
- In forced colours, rules and focus rings must survive.
- Check 360 px wide in English, Gurmukhi and romanized Punjabi.
- The `theme-color` tag must follow the new grounds.
- Test with reduced motion on.
- Run `npm run audit:i18n -- --dry-run` and commit the report if any string changes.

## Decisions

The owner decided these on 11 October 2026:

- **Rubrics are kesri,** so the brand's colour carries through. Pothi had been drawn with vermilion: `#A5281F` by day and `#E9745C` at night, each at least 5.6:1.
- **Dense screens use Newsreader,** like the rest of the interface: the translator, Seva's hosting form and the account dialogs.
- **Both borrowings from the study:** Nishan's equal-cell grid for the home page's features, and Sarovar's single dawn gradient behind the Hukamnama's head only.

Still with the owner:

- The app icons and the link-preview image are kesri on navy, drawn for the old look.
- The new "You" label (ਤੁਸੀਂ, Tusi) wants a fluent read.
