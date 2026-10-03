# Search eval

57 searches through the real verse search (`lib/gurbani/search.ts`) against the live GurbaniNow API, Sri Guru Granth Sahib Ji only, as `/api/shabad/search` runs it. Run on 2026-10-03, with 94 lookups made live and the rest from the cache. Gurmukhi searches are cut from pinned lines of the live source; romanized ones are typed as readers type them (`scripts/search-eval/cases.ts`).

## Against the bar to ship

| | Result | Bar | |
| --- | --- | --- | --- |
| Gurmukhi: the right line in the top three | 19/19 (100%) | 90% | ✓ |
| Romanized as readers type it: in the top three | 18/18 (100%) | 80% | ✓ |
| Nothing to find, and nothing found | 8/8 (100%) | 100% | ✓ |
| Lookups per search, on average | 2.00 | ≤ 2.5 | ✓ |

Overall, the right line came first in 46/46 (100%) of the searches that had one to find (MRR@10 1.00); Ang numbers opened their Ang in 3/3 (100%).
Lookups per search: mean 2.00, p95 4, most 4. GurbaniNow answered a lookup in 62 ms (median), 75 ms (p95), over 94 live lookups. The site runs a wave's lookups together, so a search takes about that per wave; the eval paces them a second apart.
Unanswered: 0; incomplete: 0; truncated: 2.

## By kind of search

| Kind | Cases | First (or right) | Top three | MRR@10 | Lookups |
| --- | --- | --- | --- | --- | --- |
| gurmukhi | 6 | 6/6 (100%) | 6/6 (100%) | 1.00 | 2.0 |
| gurmukhi-loose | 4 | 4/4 (100%) | 4/4 (100%) | 1.00 | 2.0 |
| gurmukhi-part | 3 | 3/3 (100%) | 3/3 (100%) | 1.00 | 2.0 |
| gurmukhi-typo | 2 | 2/2 (100%) | 2/2 (100%) | 1.00 | 4.0 |
| letters | 4 | 4/4 (100%) | 4/4 (100%) | 1.00 | 1.0 |
| roman-source | 5 | 5/5 (100%) | 5/5 (100%) | 1.00 | 2.0 |
| roman-casual | 18 | 18/18 (100%) | 18/18 (100%) | 1.00 | 1.8 |
| roman-letters | 4 | 4/4 (100%) | 4/4 (100%) | 1.00 | 1.3 |
| negative | 8 | 8/8 (100%) | | | 2.0 |
| ang | 3 | 3/3 (100%) | | | 0.0 |

## Every case

| Case | Kind | Typed | Read as | Right line at | Lookups | First hit | |
| --- | --- | --- | --- | --- | --- | --- | --- |
| anand-line | gurmukhi | ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ | gurmukhi | 1 | 2 | Ang 917 · 2UEB · exact · ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ |  |
| man-tu-line | gurmukhi | ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ | gurmukhi | 1 | 2 | Ang 441 · 9H5T · exact · ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ |  |
| pavan-line | gurmukhi | ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ | gurmukhi | 1 | 2 | Ang 8 · 62FB · exact · ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ |  |
| hukam-line | gurmukhi | ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥ | gurmukhi | 1 | 2 | Ang 1 · H0PC · exact · ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥ |  |
| koi-bole-line | gurmukhi | ਕੋਈ ਬੋਲੈ ਰਾਮ ਰਾਮ ਕੋਈ ਖੁਦਾਇ ॥ | gurmukhi | 1 | 2 | Ang 885 · 7PXE · exact · ਕੋਈ ਬੋਲੈ ਰਾਮ ਰਾਮ ਕੋਈ ਖੁਦਾਇ ॥ |  |
| haumai-line | gurmukhi | ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥ | gurmukhi | 1 | 2 | Ang 466 · 8D52 · exact · ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥ |  |
| mera-baid-loose | gurmukhi-loose | ਮਰ ਬਦ ਗਰ ਗਵਦ | gurmukhi | 1 | 2 | Ang 618 · JLAS · contained · ਮੇਰਾ ਬੈਦੁ ਗੁਰੂ ਗੋਵਿੰਦਾ ॥ |  |
| simran-loose | gurmukhi-loose | ਪਰਭ ਕ ਸਮਰਨ ਸਭ ਤ ਊਚ | gurmukhi | 1 | 2 | Ang 263 · EJU0 · contained · ਪ੍ਰਭ ਕਾ ਸਿਮਰਨੁ ਸਭ ਤੇ ਊਚਾ ॥ |  |
| jap-tap-loose | gurmukhi-loose | ਜਪ ਤਪ ਕ ਬਧ ਬੜਲ ਜਤ ਲਘਹ ਵਹਲ | gurmukhi | 1 | 2 | Ang 729 · C70F · contained · ਜਪ ਤਪ ਕਾ ਬੰਧੁ ਬੇੜੁਲਾ ਜਿਤੁ ਲੰਘਹਿ ਵਹੇਲਾ ॥ |  |
| sochai-loose | gurmukhi-loose | ਸਚ ਸਚ ਨ ਹਵਈ ਜ ਸਚ ਲਖ ਵਰ | gurmukhi | 1 | 2 | Ang 1 · BL70 · contained · ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ ॥ |  |
| anand-part | gurmukhi-part | ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ | gurmukhi | 1 | 2 | Ang 917 · 2UEB · exact · ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ |  |
| man-tu-part | gurmukhi-part | ਮਨ ਤੂੰ ਜੋਤਿ | gurmukhi | 1 | 2 | Ang 441 · 9H5T · exact · ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ |  |
| jai-ghar-part | gurmukhi-part | ਜੈ ਘਰਿ ਕੀਰਤਿ | gurmukhi | 1 | 2 | Ang 12 · ZGW1 · exact · ਜੈ ਘਰਿ ਕੀਰਤਿ ਆਖੀਐ ਕਰਤੇ ਕਾ ਹੋਇ ਬੀਚਾਰੋ ॥ |  |
| tati-vao-typo | gurmukhi-typo | ਤਾਤੀ ਵਾਉ ਨ ਲਗਈ ਪਾਰਬ੍ਰਹਭ ਸਰਣਾਈ | gurmukhi | 1 | 4 | Ang 819 · D7PD · close · ਤਾਤੀ ਵਾਉ ਨ ਲਗਈ ਪਾਰਬ੍ਰਹਮ ਸਰਣਾਈ ॥ |  |
| jo-mange-typo | gurmukhi-typo | ਜੋ ਮਾਗਸਿ ਠਾਕੁਰ ਅਪੁਨੇ ਤੇ ਸੋਈ ਸੋਈ ਦੇਵੈ | gurmukhi | 1 | 4 | Ang 681 · NGMS · close · ਜੋ ਮਾਗਹਿ ਠਾਕੁਰ ਅਪੁਨੇ ਤੇ ਸੋਈ ਸੋਈ ਦੇਵੈ ॥ |  |
| anand-letters | letters | ਅਭਮਮਸਮਪ | gurmukhi-letters | 1 | 1 | Ang 917 · 2UEB · letters · ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ |  |
| man-tu-letters | letters | ਮਤਜਸਹਅਮਪ | gurmukhi-letters | 1 | 1 | Ang 441 · 9H5T · letters · ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ |  |
| pavan-spaced | letters | ਪ ਗ ਪ ਪ ਮ ਧ ਮ | gurmukhi-letters | 1 | 1 | Ang 8 · 62FB · letters · ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ |  |
| haumai-vowels | letters | ਹਦਰਹਦਭਇਮ | gurmukhi-letters | 1 | 1 | Ang 466 · 8D52 · letters · ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥ |  |
| anand-source | roman-source | anand bheaa meree maae satiguroo mai paaeaa \| | roman | 1 | 2 | Ang 917 · 2UEB · roman · ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ |  |
| man-tu-source | roman-source | man toon jot saroop hai aapanaa mool pachhaan \| | roman | 1 | 2 | Ang 441 · 9H5T · roman · ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ |  |
| pavan-source | roman-source | pavan guroo paanee pitaa maataa dharat mehat \| | roman | 1 | 2 | Ang 8 · 62FB · roman · ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ |  |
| hukam-source | roman-source | hukam rajaaee chalanaa naanak likhiaa naal \|1\| | roman | 1 | 2 | Ang 1 · H0PC · roman · ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥ |  |
| koi-bole-source | roman-source | koee bolai raam raam koee khudaae \| | roman | 1 | 2 | Ang 885 · 7PXE · roman · ਕੋਈ ਬੋਲੈ ਰਾਮ ਰਾਮ ਕੋਈ ਖੁਦਾਇ ॥ |  |
| so-purakh | roman-casual | so purakh niranjan | roman | 1 | 1 | Ang 10 · 546S · roman · ਸੋ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਅਗਮਾ ਅਗਮ ਅਪਾਰਾ ॥ |  |
| tu-thakur | roman-casual | tu thakur tum peh ardas | roman | 1 | 2 | Ang 268 · Y99N · roman · ਤੂ ਠਾਕੁਰੁ ਤੁਮ ਪਹਿ ਅਰਦਾਸਿ ॥ |  |
| ik-onkar | roman-casual | ik onkar satnam karta purakh | roman | 1 | 1 | Ang 1 · 0NVY · roman · ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥ | truncated |
| aad-sach | roman-casual | aad sach jugaad sach | roman | 1 | 1 | Ang 1 · J92N · roman · ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥ |  |
| hukam | roman-casual | hukam rajai chalna nanak likhia naal | roman | 1 | 2 | Ang 1 · H0PC · roman · ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥ |  |
| sochai | roman-casual | sochai soch na hovai je sochi lakh vaar | roman | 1 | 2 | Ang 1 · BL70 · roman · ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ ॥ |  |
| pavan | roman-casual | pavan guru pani pita mata dharat mahat | roman | 1 | 2 | Ang 8 · 62FB · roman · ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ |  |
| jo-mange | roman-casual | jo mange thakur apne te soi soi deve | roman | 1 | 2 | Ang 681 · NGMS · roman · ਜੋ ਮਾਗਹਿ ਠਾਕੁਰ ਅਪੁਨੇ ਤੇ ਸੋਈ ਸੋਈ ਦੇਵੈ ॥ |  |
| mera-baid | roman-casual | mera baid guru govinda | roman | 1 | 2 | Ang 618 · JLAS · roman · ਮੇਰਾ ਬੈਦੁ ਗੁਰੂ ਗੋਵਿੰਦਾ ॥ |  |
| tati-vao | roman-casual | tati vao na lagai parbrahm sarnai | roman | 1 | 2 | Ang 819 · D7PD · roman · ਤਾਤੀ ਵਾਉ ਨ ਲਗਈ ਪਾਰਬ੍ਰਹਮ ਸਰਣਾਈ ॥ |  |
| dhan-dhan | roman-casual | dhan dhan ram das gur | roman | 1 | 2 | Ang 968 · YLSG · roman · ਧੰਨੁ ਧੰਨੁ ਰਾਮਦਾਸ ਗੁਰੁ ਜਿਨਿ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ ॥ |  |
| koi-bole | roman-casual | koi bole ram ram koi khudai | roman | 1 | 2 | Ang 885 · 7PXE · roman · ਕੋਈ ਬੋਲੈ ਰਾਮ ਰਾਮ ਕੋਈ ਖੁਦਾਇ ॥ |  |
| tera-kiya | roman-casual | tera kiya meetha laage | roman | 1 | 2 | Ang 394 · 2GYN · roman · ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥ |  |
| haumai | roman-casual | haumai deeragh rog hai daru bhi is mahe | roman | 1 | 2 | Ang 466 · 8D52 · roman · ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥ |  |
| man-tu | roman-casual | man tu jot saroop hai apna mool pachhan | roman | 1 | 2 | Ang 441 · 9H5T · roman · ਮਨ ਤੂੰ ਜੋਤਿ ਸਰੂਪੁ ਹੈ ਆਪਣਾ ਮੂਲੁ ਪਛਾਣੁ ॥ |  |
| anand | roman-casual | anand bhaya meri maye satguru mai paya | roman | 1 | 2 | Ang 917 · 2UEB · roman · ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥ |  |
| jap-tap | roman-casual | jap tap ka bandh berhula jit langhe vahela | roman | 1 | 2 | Ang 729 · C70F · roman · ਜਪ ਤਪ ਕਾ ਬੰਧੁ ਬੇੜੁਲਾ ਜਿਤੁ ਲੰਘਹਿ ਵਹੇਲਾ ॥ |  |
| jai-ghar | roman-casual | jai ghar keerat aakhiai karte ka hoe beecharo | roman | 1 | 2 | Ang 12 · ZGW1 · roman · ਜੈ ਘਰਿ ਕੀਰਤਿ ਆਖੀਐ ਕਰਤੇ ਕਾ ਹੋਇ ਬੀਚਾਰੋ ॥ |  |
| spnh | roman-letters | spnh | roman-letters | 1 | 1 | Ang 10 · 546S · letters · ਸੋ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਅਗਮਾ ਅਗਮ ਅਪਾਰਾ ॥ |  |
| spnh-spaced | roman-letters | s p n h | roman-letters | 1 | 1 | Ang 10 · 546S · letters · ਸੋ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਅਗਮਾ ਅਗਮ ਅਪਾਰਾ ॥ |  |
| asjs | roman-letters | asjs | roman-letters | 1 | 1 | Ang 1 · J92N · letters · ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥ |  |
| mbgg | roman-letters | mbgg | roman-letters | 1 | 2 | Ang 618 · JLAS · letters · ਮੇਰਾ ਬੈਦੁ ਗੁਰੂ ਗੋਵਿੰਦਾ ॥ |  |
| shepherd | negative | the lord is my shepherd | roman | nothing found | 3 | — |  |
| question | negative | what does japji sahib mean | invalid | declined (english) | 0 | — |  |
| gibberish | negative | asdf qwer zxcv | roman | nothing found | 2 | — | truncated |
| hello | negative | hello how are you doing today | invalid | declined (english) | 0 | — |  |
| ardas | negative | nanak naam chardi kala tere bhane sarbat da bhala | roman | nothing found | 4 | — |  |
| deh-shiva | negative | deh shiva bar mohe ihai shubh karman te kabhu na taro | roman | nothing found | 4 | — |  |
| mitar-pyare | negative | mitar pyare nu haal mureedan da kehna | roman | nothing found | 3 | — |  |
| devanagari | negative | सो पुरखु निरंजनु | invalid | declined (unsupported-script) | 0 | — |  |
| ang-last | ang | 1430 | ang | opens its Ang | 0 | — |  |
| ang-gurmukhi | ang | ੧੪੩੦ | ang | opens its Ang | 0 | — |  |
| ang-word | ang | ang 5 | ang | opens its Ang | 0 | — |  |

Every case was right.
