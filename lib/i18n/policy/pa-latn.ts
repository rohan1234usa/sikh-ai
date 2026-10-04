// The words of /privacy and /terms, in romanized Punjabi. Why they live here,
// apart from the dictionaries: ./en.ts.
//
// NOTE: AI-drafted translation, pending review by a fluent speaker, following
// lib/i18n/dictionaries/pa-latn.ts's conventions. Keep {placeholders} verbatim.

import type { PolicyDictionary } from './en';

const policy: PolicyDictionary = {
    // /privacy (app/[lang]/privacy): who runs the site; what it keeps, where and
    // for how long; what others can see; what it sends to which service; how it
    // counts visits; age limits; where it's handled; and how to remove it.
    // Sections are keyed by id, the page's anchors (#analytics has the switch),
    // and every language has the same ones in the same order. {placeholders} are
    // filled from lib/policy.ts, so the limits are the ones the code enforces.
    // A new service a visitor's browser or the server talks to needs a line here.
    // The owner signs off on the words.
    privacy: {
        title: 'Nijjta',
        updated: 'Aakhri vaar badleya: {date}.',
        intro: 'SikhAI ik chhoti, sutantar site hai. Ih panna dassda hai ki ih tuhade baare ki rakhdi hai, kithe ate kinne samay layi; hor sevavan nu ki bhejdi hai; ate isnu kiven hatauna hai.',
        sections: {
            who: {
                heading: 'SikhAI pichhe kaun hai',
                items: [
                    'Ih site Rohan Singh ne banai hai ate unhan valon hi chalai jaandi hai. Ih muft hai, is utte koi ishtihaar nahi, ate ih tuhade baare jo jaandi hai us vichon kujh vi kade nahi vechdi.',
                    'Is panne baare, jaan site kol tuhade baare ki hai, ih puchhan layi, jaan kujh vi hatvaun layi, {email} utte email karo.',
                ],
            },
            browser: {
                heading: 'Tuhade browser vich',
                items: [
                    'Tuhadian gallbaatan, {maxLocalChats} tak. Jagah na hove taan oh gallbaat pehlan hatdi hai jis da aakhri sawal sabh ton purana hai, par kade vi pin kiti hoi, khulli hoi, jaan oh gallbaat nahi jisnu aje jawab aa reha hai. Je browser vich thaan mukk jaave, taan ghatt rakhian jaandian han.',
                    'Tuhade aakhri {maxTranslations} anuvaad. “Haalia anuvaad” vich tusi ik-ik karke jaan saare hata sakde ho.',
                    'Tuhadi “Punjabi Sikho” tarakki: poore keete sabak, quiz de sab ton vadhia ank, ate har flashcard kadon dubara aavega.',
                    'Punjabi tutor naal tuhadi gallbaat, tab band hon tak.',
                    'Tuhadian chat settings (Drishtikon, Jawab di shaili ate Jawab di bhasha), tuhadi theme, ki tusi pheriaan di ginti band kiti hai, ate ki tusi sign in si, taan jo tuhada session chheti vapas aa jave.',
                    'Seva samagaman vale panne utte tuhada aakhri chuniaa desh; ate jo samagam tusi likhna shuru kita par paaya nahi, tab band hon tak.',
                    'Ik cookie, {langCookie}, jo sirf bhasha badlan vele lagdi hai. Ih tuhadi chon ik saal layi rakhdi hai, taan jo link tuhadi bhasha vich khulle.',
                    'Jadon tusi sign in hunde ho, Google di sign-in seva Firebase tuhada session ithe rakhdi hai: tuhade khaate di ID, naam, email pata, tuhadi profile photo da pata, ate sign-in token. Sign out karan naal ih hat jaanda hai. Firebase ih vi darj karda hai ki usda code is browser vich kehre din chaliaa, apni varton di ginti layi.',
                ],
            },
            account: {
                heading: 'Tuhade khaate vich',
                items: [
                    'Tusi Google naal sign in kar sakde ho. Ih Google di ik khirki vich, Google di nijjta niti heth hunda hai, ate phir Google site nu tuhada naam, email pata ate profile photo dinda hai.',
                    'Site sirf tuhada pehla naam vartdi hai, jo navbar vich disda hai, ate tuhade khaate di ID, ik betarteeb code jo Firebase tuhade khaate nu dinda hai. Ih tuhada email pata jaan photo kade nahi dikhaundi jaan vartdi.',
                    'Firebase tuhada khaata (tuhada naam, email pata, photo da pata, ate tusi kadon jude ate aakhri vaar kadon sign in kita) mitaye jaan tak rakhda hai. Ih us IP pate nu vi kujh hafteyan layi darj karda hai jis ton tusi sign in karde ho.',
                    'Jadon khaatian layi sambhalian gallbaatan chaalu hon, tuhadian gallbaatan browser di thaan tuhade khaate vich rakhian jaandian han: {maxAccountChats} tak, naal hi jo tusi pin karo. Is ton vadh hon utte, jis gallbaat da aakhri sawal sabh ton purana hai oh apne saanjhe link samet mit jaandi hai. Jo gallbaatan tusi is browser ton uthe lijaande ho, oh sambhale jaan utte browser vichon hat jaandian han.',
                    'Tuhada khaata niji taur utte ih vi rakhda hai ki kehre seva samagaman de prabandhak tusi ho, kehrian vich tuhada naam shamil hai, ate tusi kehrian gallbaatan saanjhian kitian han, taan jo tusi unhan nu sambhal sako. Ih note hor koi nahi parh sakda.',
                ],
            },
            public: {
                heading: 'Duje ki dekh sakde han',
                items: [
                    'Jo gallbaat tusi saanjhi karde ho, oh sirf-parhan vali copy ban jaandi hai jisnu link vala koi vi khol sakda hai, jadon tak tusi saanjha karna band nahi karde, jaan gallbaat jaan apna khaata nahi mitaunde. Copy vich gallbaat da naam ate usde jawab mile sunehe hunde han, jiven tusi likhe, ate tuhade baare hor kujh nahi: na tuhada naam, na email pata, na tuhade khaate di ID.',
                    'Link kholan vala koi vi gallbaat agge tor sakda hai, jis naal oh usde apne browser jaan khaate vich nakal ho jaandi hai. Tuhade saanjha karna band karan ton baad vi unhan di copy rehndi hai.',
                    'Tuhade paaye seva samagam sarian nu disde han, har ik apne panne utte, jisnu koi vi khol jaan saanjha kar sakda hai ate khoj engine dikha sakde han: naam, vervaa, samaan, thaan, “Prabandhak” vala naam ate tuhada ditta koi sampark. Samagam vich tuhade khaate di ID nahi hundi, ate na hi tuhada Google vala naam, jadon tak oh tusi aap na likho.',
                    'Jadon kise seva samagam vich tuhada naam shamil hunda hai, taan usde prabandhak nu tuhada ditta naam disda hai, ate tuhada email pata jaan phone number sirf taan, je tusi oh saanjha karna chuno. Baki sarian nu sirf ih disda hai ki kinne naam shamil han. Prabandhak nu tuhade khaate di ID kade nahi disdi.',
                    'Je tusi kise seva samagam di shikayat karde ho, taan shikayat vich tuhade khaate di ID, samagam, kaaran ate tuhada likhia jo vi hove, oh hunda hai. Isnu sirf site de admin parh sakde han, samagam da prabandhak kade nahi, ate karvai hon utte ih mita ditti jaandi hai. Admin kise samagam nu luka vi sakde han: oh rakhia rehnda hai, ate usde prabandhak nu disda rehnda hai.',
                ],
            },
            services: {
                heading: 'Hor sevavan nu bhejia jaanda',
                items: [
                    'Google Gemini jawab likhda hai. Har chat suneha gallbaat de {maxEarlierMessages} tak pichhle sunehian, tuhade jode kise paath (jo har sunehe naal dubara jaanda hai), ate tuhadian chat settings samet usnu jaanda hai. Jis likhat da tusi anuvaad karde ho, oh vi usnu jaandi hai.',
                    'Punjabi tutor nu bheje sunehe vi Gemini nu jaande han, gallbaat de {maxTutorMessages} tak pichhle sunehian ate us sabak samet jithon tusi tutor kholia.',
                    'Inhan naal tuhadi pachhaan baare kujh nahi jaanda: na tuhada naam, na khaate di ID, na IP pata. Jo tusi likhde ho oh jiven likhia uven jaanda hai, is layi jo gall tusi niji rakhni chahunde ho oh na likho.',
                    'SikhAI Gemini di adaigi vali seva vartda hai. Us layi Google dian shartan heth, Google site da bhejia apne utpaad sudharan layi nahi vartda. Ih usnu 55 dinan tak rakhda hai, sirf durvarton phadan layi ate kanoon valon lorhinde khulasian layi.',
                    'Jadon Gemini rujhia hove, taan English jaan Gurmukhi likhat layi Google Cloud Translation usdi thaan kamm karda hai, ate “Google Translate naal tulna karo” usnu dikhaya gaya anuvaad bhejda hai. Google oh likhat sirf anuvaad karan de samen tak rakhda hai.',
                    'GurbaniNow ton Hukamnama, Ang ate shabad aunde han. Jawab vichli Gurbani jaanchan layi, site da server oh tukkan uthe labbhda hai. Tuhada sawal kade nahi bhejia jaanda. Shabad Khoj vich jo tusi likhde ho, oh vi tukk labbhan layi site de server ton uthe jaanda hai. Ih khoj de pate da hissa vi hunda hai, jisnu Vercel de log kise vi mange panne vaang darj karde han.',
                    'Google da app platform Firebase sign-in chalaunda hai ate khaate, sambhalian gallbaatan, saanjhe link, ate seva samagam unhan vich shamil naaman ate shikayatan samet rakhda hai. Sign in karan layi, sign in rehndian, ate saanjhe link utte tuhada browser sidha is naal judda hai, is layi odon Google tuhada IP pata dekhda hai. Seva de panne is site de server utte bande han, is layi samagam dekhan naal tuhada browser Firebase naal nahi judda. Nahi taan tuhada browser sirf is site naal judda hai.',
                    'Kise samagam tak pahunchan de raah ate calendar vale link Google Maps jaan Google Calendar kholde han, ate isnu WhatsApp utte saanjha karan naal WhatsApp khulda hai, samagam de vervian samet. Phir oh sevavan ih verve ate tuhada IP pata apnian nijjta nitian heth laindian han. Hor calendaran layi calendar file isse site ton aundi hai.',
                    'Vercel site nu chalaunda hai. Isde log thorhe samay layi tuhada IP pata ate mange panne darj karde han. Site de apne logan vich tuhada likhia kade nahi hunda, bhaven unhan vich kise panne da pata ho sakda hai.',
                ],
            },
            analytics: {
                heading: 'Pheriaan di ginti',
                items: [
                    'Vercel Web Analytics pheriaan ginda hai, taan jo site dekh sake ki lok kehre panne vartde han. Har panna khulan utte ih darj karda hai ki kehra panna si (saanjhe link di ID kade nahi), tusi kis site ton aaye, samaan, tuhada lagbhag tikana (desh, ilaaka ate shehar), ate tuhada browser, operating system ate device di kism.',
                    'Ih koi cookie nahi vartda ate tuhade browser vich kujh nahi rakhda. Aun valian nu vakh karan layi ih tuhadi benti ton ik code banaunda hai jo 24 ghantian de andar sutt ditta jaanda hai, is layi tuhadian pheriaan ik din ton duje din naal nahi jodian ja sakdian. Site nu sirf kull gintian disdian han.',
                    'Vercel Speed Insights mapda hai ki panne kinni tezi naal khulhde han: kehra panna si, tuhade connection di raftaar, browser, operating system, device di kism ate desh. Ih vi koi cookie nahi vartda.',
                    'Je tuhada browser Global Privacy Control sanket bhejda hai, taan dohan vichon koi vi tuhanu nahi ginda. Tusi hethan ditte switch naal dove band vi kar sakde ho; tuhadi chon is browser vich rakhi jaandi hai.',
                ],
            },
            age: {
                heading: 'Umar dian hadda',
                items: [
                    'AI vartan valian sahulatan (SikhAI nu Puchho, Anuvadak ate Punjabi tutor) 18 saal jaan vadh umar de lokan layi han, jiven {terms} vich likhia hai. Gemini layi Google dian shartan ih mangdian han.',
                    'SikhAI jaan-bujh ke 13 saal ton ghatt umar de bacheyan ton jaankari ikatthi nahi karda. Je tuhanu lagda hai ki kise bache ne ithe sign in kita hai jaan kujh saanjha kita hai, taan {email} utte email karo ate oh mita ditta jaavega.',
                ],
            },
            location: {
                heading: 'Ih kithe sambhalia jaanda hai',
                items: [
                    'SikhAI America ton chalda hai: Vercel site da server code uthe chalaunda hai, ate Firebase khaate, sambhalian gallbaatan, saanjhe link ate seva samagam uthe rakhda hai. Je tusi kise hor desh ton aunde ho, taan tuhadi jaankari America jaandi hai.',
                    'Google site valon Gemini ate Cloud Translation nu bheji likhat unhan hor deshan vich vi sambhal sakda hai jithe usde data center han.',
                ],
            },
            removing: {
                heading: 'Isnu hatauna',
                items: [
                    'Gallbaatan di suchi vichon koi gallbaat mitao; is naal usda saanjha link vi, je hai, band ho jaanda hai. Anuvaad “Haalia anuvaad” vichon hatao.',
                    'Apni “Punjabi Sikho” tarakki “Punjabi Sikho” panne utte “Tarakki mitao” naal mitao.',
                    'Gallbaat de saanjha karan vale dabbe vichon saanjha karna band karo: link usse vele kamm karna band kar dinda hai.',
                    'Kise seva samagam vichon apna naam, samagam ton pehlan jaan baad, usde panne ton vapas lao; jis samagam de prabandhak tusi ho, usnu vi usde panne ton radd karo.',
                    'Apna khaata har panne de sikhar utte vyakti vale nishaan hethle menu ton, jaan, sign in hon vele, hethle button naal mitao. Pehlan Google tuhanu dubara sign in karan layi kehnda hai. Ih tuhade saanjhe link, jinhan seva samagaman de prabandhak tusi ho (pehlan radd, phir sevadaran de naavan samet mitaye jaande han), seva samagaman vich tuhade naam ate tuhade khaate vich sambhalian gallbaatan mitaunda hai, phir khaata aap. Kise samagam baare tuhadi bheji shikayat admin di karvai tak rehndi hai.',
                    'Sign out karan jaan khaata mitaun naal is browser vich tuhadian gallbaatan, anuvaad ate settings rehndian han. Unhan nu vi hataun layi (jiven kise saanjhe computer utte), hethan “Ih browser saaf karo” varto: ih tuhanu sign out karda hai ate site vallon is browser vich rakhi har cheez mita dinda hai, sivaaye tuhadian pheriaan na ginan di chon de.',
                    'Je tusi sign in nahi kar sakde, jaan sirf apna karvaya koi ik samagam mitvauna chahunde ho, taan jis pate naal tusi sign in karde ho us ton {email} utte email karo, ate ih 30 dinan de andar mita ditta jaavega. Kamm hon utte tuhanu jawab milega.',
                    'Google nu mitaye data nu apne backupan vichon saaf karan layi 180 din hor lag sakde han.',
                ],
            },
            changes: {
                heading: 'Is panne vich tabdilian',
                items: [
                    'Jadon site valon rakhi jaan bheji jaandi cheez badaldi hai, ih panna vi naal badalda hai, ate upar ditti tareekh dassdi hai kadon.',
                ],
            },
        },
    },

    // /terms (app/[lang]/terms): the few rules that come with using SikhAI, among
    // them that its AI features are for people 18 and over, as Google's terms for
    // Gemini require. Sections are keyed by id, the page's anchors, and every
    // language has the same ones in the same order; {placeholders} are filled
    // from lib/policy.ts. The owner signs off on the words.
    terms: {
        title: 'Varton Dian Shartan',
        updated: 'Aakhri vaar badleya: {date}.',
        intro: 'SikhAI vartna muft hai. Is naal jurhe kujh ku niyam ih han, sidhe shabadan vich. Site varat ke tusi inhan nu mannde ho.',
        sections: {
            about: {
                heading: 'SikhAI ki hai',
                items: [
                    'SikhAI Sikhi, Gurbani ate Punjabi bhasha baare ik muft, sutantar site hai, jo Rohan Singh ne banai hai ate unhan valon hi chalai jaandi hai.',
                    'Ih kise Gurdwara, Sikh sanstha jaan Google da hissa nahi hai, ate isnu unhan vichon kise di manyata prapt nahi hai.',
                ],
            },
            ai: {
                heading: 'AI de jawab galat ho sakde han',
                items: [
                    'SikhAI de jawab ate anuvaad, ate tutor de jawab vi, AI likhda hai: Google Gemini, jaan jadon Gemini rujhia hove taan anuvaad layi Google Cloud Translation. Ih galat ho sakde han, bhaven poore yakeen naal likhe lagan.',
                    'Ih Gurbani nahi han, ate inhan nu koi dharmik adhikar prapt nahi hai. Gurbani di har tuk asal sarot naal mila ke jaancho (jawab de heth “Gurbani di jaanch” is vich madad kardi hai), ate sedh layi kise Granthi jaan apni Sangat nu puchho.',
                    'Ih doctori, kanooni jaan maali salah nahi han, ate sankat vele di madad vi nahi. Je tuhanu jaan kise hor nu khatra hai, taan apne ilaake de emergency number utte phone karo.',
                ],
            },
            age: {
                heading: 'AI layi 18 saal jaan vadh',
                items: [
                    'SikhAI de oh hisse jo AI vartde han (SikhAI nu Puchho, Anuvadak ate Punjabi tutor) 18 saal jaan vadh umar de lokan layi han, jiven Gemini layi Google dian shartan mangdian han. Je tuhadi umar 18 saal ton ghatt hai, taan kirpa karke inhan nu na varto.',
                ],
            },
            use: {
                heading: 'Sahi dhang naal varton',
                items: [
                    'SikhAI nu kise nu tang karan, dhamkaun jaan dhokha den layi, nafrat bhari jaan jinsi samagri paun layi, jaan kise vi gair-kanooni kamm layi na varto.',
                    'Is de jawaban nu Gurbani, kise Guru Sahib de bachan, jaan koi adhikarit Sikh faisla bana ke pesh na karo.',
                    'Site di samagri aape-aap ikatthi na karo, isnu automatic benatian naal na bharo, ate is dian hadda jaan suraksha ton bachan di koshish na karo.',
                    'AI vale hissian nu kise vi aise kamm layi na varto jis di Google di {usePolicy} manahi kardi hai.',
                    'Inhan shartan nu torhan vali varton seemit jaan band kiti ja sakdi hai, ate us raahin paai gayi samagri hatai ja sakdi hai.',
                ],
            },
            sharing: {
                heading: 'Jo tusi saanjha karde ho',
                items: [
                    'Saanjhe kite link ate seva samagam sarian nu disde han. Jo tusi saanjha karde jaan paunde ho, us de tusi zimmevar ho, ate usnu saanjha karan da haq tuhade kol hona chahida hai.',
                    'Gallbaat saanjhi karke jaan samagam pa ke, tusi SikhAI nu usnu sarian nu dikhaun di ijazat dinde ho, jadon tak tusi saanjha karna band nahi karde jaan oh hataya nahi jaanda.',
                    'Seva samagam seva de asal mauke hone chahide han. Hor samagam hataye ja sakde han.',
                    'Je tusi koi samagam karvaunde ho, taan sevadaran valon ditte naam ate sampark sirf us samagam de prabandh layi varto, ate agge kise nu na deo.',
                    'SikhAI samagaman jaan unhan de prabandhakan di jaanch nahi karda. Anjaan lokan nu milan ton pehlan apni soojh varto.',
                    'Kise samagam di shikayat sirf nek niyat naal karo. Inhan shartan nu torhan vale samagam admin luka sakde han.',
                ],
            },
            gurbani: {
                heading: 'Gurbani',
                items: [
                    'Gurbani da paath, us de English anuvaad ate rozana Hukamnama {gurbaninow} ton aunde han, dhanvaad sahit. “Gurbani di jaanch” jawab vichlian tukkan nu ise sarot naal milaundi hai.',
                ],
            },
            warranty: {
                heading: 'Koi guarantee nahi',
                items: [
                    'SikhAI jiven hai uven hi ditta jaanda hai, bina kise kism di guarantee de. Ih galat ho sakda hai, hauli chal sakda hai jaan band ho sakda hai, ate koi vi sahulat badal jaan khatam ho sakdi hai.',
                    'Kanoon jithon tak ijazat dinda hai, Rohan Singh SikhAI vartan naal hoye kise vi ghaate jaan nuksaan layi zimmevar nahi han.',
                ],
            },
            changes: {
                heading: 'Tabdilian',
                items: [
                    'Ih shartan badal sakdian han. Upar ditti tareekh dassdi hai ki ih aakhri vaar kadon badlian, ate tabdili ton baad SikhAI vartan da matlab hai ki tusi inhan nu mannde ho.',
                ],
            },
            contact: {
                heading: 'Sampark',
                items: [
                    'Inhan shartan baare sawal: {email} utte email karo. Site tuhade baare ki rakhdi hai, ate usnu kiven hatauna hai, ih {privacy} panne utte hai.',
                ],
            },
        },
    },
};

export default policy;
