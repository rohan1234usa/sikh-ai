// The words of /privacy and /terms (app/components/PolicyPage.tsx), in English.
// They live apart from the dictionaries, which every page sends to the browser:
// only those two pages' server components read these (getPolicyCopy() in
// ./index.ts), so the words ship with those pages alone. The i18n audit checks
// them with the rest of the site's strings, under `policy.`

const policy = {
    // /privacy (app/[lang]/privacy): who runs the site; what it keeps, where and
    // for how long; what others can see; what it sends to which service; how it
    // counts visits; age limits; where it's handled; and how to remove it.
    // Sections are keyed by id, the page's anchors (#analytics has the switch),
    // and every language has the same ones in the same order. {placeholders} are
    // filled from lib/policy.ts, so the limits are the ones the code enforces.
    // A new service a visitor's browser or the server talks to needs a line here.
    // The owner signs off on the words.
    privacy: {
        title: 'Privacy',
        updated: 'Last updated {date}.',
        intro: 'SikhAI is a small, independent site. This page says what it keeps about you, where, and for how long; what it sends to other services; and how to remove it.',
        sections: {
            who: {
                heading: 'Who runs SikhAI',
                items: [
                    'Rohan Singh built SikhAI and runs it. It is free, it shows no ads, and it never sells anything it knows about you.',
                    'To ask about this page or what the site holds about you, or to have anything removed, email {email}.',
                ],
            },
            browser: {
                heading: 'Kept in your browser',
                items: [
                    'Your chats, up to {maxLocalChats}. When there is no room, the chat whose last question is oldest goes first, but never a pinned chat, an open one, or one still getting a reply. If the browser runs out of space, fewer are kept.',
                    'Your last {maxTranslations} translations. You can remove one, or all of them, under Recent translations.',
                    'Your Learn Punjabi progress: the lessons you finished, your best quiz scores, and when each flashcard comes back.',
                    'Your conversation with the Punjabi tutor, until you close the tab.',
                    'Your chat settings (perspective, response style and reply language), your theme, whether you turned off visit counting, and whether you were signed in, so your session comes back quickly.',
                    'One cookie, {langCookie}, set only when you change the language. It keeps your choice for a year, so a link opens in your language.',
                    'While you are signed in, Firebase, Google\'s sign-in service, keeps your session here: your account ID, name, email address, the address of your profile photo, and sign-in tokens. Signing out removes it.',
                ],
            },
            account: {
                heading: 'Kept in your account',
                items: [
                    'You can sign in with Google. You do it in a window from Google, under Google\'s privacy policy, and Google then gives the site your name, email address and profile photo.',
                    'The site uses only your first name, which the navbar shows, and your account ID, a random code Firebase gives your account. It never shows or uses your email address or photo.',
                    'Firebase keeps your account (your name, email address, photo address, and when you signed up and last signed in) until it is deleted. It also logs the IP address you sign in from, for a few weeks.',
                    'Once saved chats are switched on for accounts, your chats are kept in your account instead of the browser: up to {maxAccountChats}, plus any you pin. Past that, the chat whose last question is oldest is deleted, with its share link. Chats you move there from this browser are removed from the browser once saved.',
                    'Your account also keeps, privately, which Seva events you host and which you\'ve joined, so you can manage them. No one else can read these notes.',
                ],
            },
            public: {
                heading: 'What others can see',
                items: [
                    'A chat you share becomes a read-only copy that anyone with the link can open, until you stop sharing it or delete the chat. The copy doesn\'t show your name or email address, but it does hold your account ID.',
                    'Anyone who opens the link can continue the conversation, which copies it into their own browser or account. Their copy stays after you stop sharing.',
                    'Seva events you post are public, each on a page of its own that anyone can open or share and search engines can list: the title, description, time, place, the “Hosted by” name and any contact you add. An event doesn\'t hold your account ID, or your Google name unless you type it in.',
                    'When you join a Seva event, its host sees the name you give and, only if you choose to share them, your email address or phone number. Everyone else sees only how many have joined. The host never sees your account ID.',
                    'If you report a Seva event, the report holds your account ID, the event, the reason and anything you add. Only the site\'s admins can read it, never the event\'s host, and it\'s deleted once dealt with. Admins can also hide an event: it stays stored, and its host still sees it.',
                ],
            },
            services: {
                heading: 'Sent to other services',
                items: [
                    'Google Gemini writes the answers. Each chat message goes to it with up to {maxEarlierMessages} earlier messages from the chat, any passage you attached (sent again with every message), and your chat settings. Text you translate goes to it too.',
                    'Messages to the Punjabi tutor go to Gemini too, with up to {maxTutorMessages} earlier messages from the conversation and the lesson you opened it from.',
                    'Nothing about who you are goes with them: not your name, account ID or IP address. What you write goes as you wrote it, so leave out anything you want to keep private.',
                    'SikhAI uses Gemini\'s paid service. Under Google\'s terms for it, Google doesn\'t use what the site sends to improve its products. It keeps it for up to 55 days, only to detect misuse and for disclosures the law requires.',
                    'Google Cloud Translation stands in when Gemini is busy, for English or Gurmukhi text, and “Compare with Google Translate” sends it the translation shown. Google holds that text only while translating it.',
                    'GurbaniNow supplies the Hukamnama and the Angs. To check the Gurbani a reply quotes, the site\'s server looks up the quoted lines there. Your question is never sent.',
                    'Firebase, Google\'s app platform, runs sign-in and keeps accounts, saved chats, share links, and Seva events with their sign-ups and reports. Your browser connects to it directly for signing in, while you\'re signed in, and on a share link, so Google sees your IP address then. The Seva pages are built on this site\'s server, so looking at events doesn\'t connect your browser to Firebase. Otherwise your browser connects only to this site.',
                    'An event\'s directions and calendar links open Google Maps or Google Calendar, and sharing it on WhatsApp opens WhatsApp, with the event\'s details. Those services then get the details, and your IP address, under their own privacy policies. The calendar file for other calendars comes from this site.',
                    'Vercel hosts the site. Its logs record your IP address and the pages you request, for a short time. The site\'s own logs never contain what you write, though they can contain a page\'s address.',
                ],
            },
            analytics: {
                heading: 'Counting visits',
                items: [
                    'Vercel Web Analytics counts visits, so the site can see which pages people use. For each page view it records which page it was (never a share link\'s ID), the site you came from, the time, your approximate location (country, region and city), and your browser, operating system and kind of device.',
                    'It uses no cookies and keeps nothing in your browser. To tell visitors apart, it makes a code from your request that is thrown away within 24 hours, so your visits can\'t be linked from one day to the next. The site sees only totals.',
                    'Vercel Speed Insights measures how fast pages load: which page it was, your connection speed, browser, operating system, kind of device and country. It uses no cookies either.',
                    'If your browser sends a Global Privacy Control signal, neither counts you. You can also turn both off with the switch below; your choice is kept in this browser.',
                ],
            },
            age: {
                heading: 'Age limits',
                items: [
                    'The features that use AI (Ask SikhAI, the translator and the Punjabi tutor) are for people 18 and over, as the {terms} say. Google\'s terms for Gemini require it.',
                    'SikhAI doesn\'t knowingly collect information from children under 13. If you think a child has signed in or shared something here, email {email} and it will be deleted.',
                ],
            },
            location: {
                heading: 'Where it is handled',
                items: [
                    'SikhAI is run from the United States: Vercel runs the site\'s server code there, and Firebase keeps accounts, saved chats, share links and Seva events there. If you visit from another country, your information goes to the US.',
                    'Google may handle what the site sends to Gemini and Cloud Translation in other countries where it has data centers.',
                ],
            },
            removing: {
                heading: 'Removing it',
                items: [
                    'Delete a chat from the chat list; that also ends its share link, if it has one. Remove translations under Recent translations.',
                    'Clear your Learn Punjabi progress with Reset progress on the Learn Punjabi page.',
                    'Stop sharing a chat from its share dialog: the link stops working at once.',
                    'Signing out ends your session in this browser but leaves your chats, translations and settings. To remove those too (on a shared computer, say), clear this site\'s data in your browser\'s settings.',
                    'Leave a Seva event, or remove your sign-up once it\'s over, from the event\'s page; cancel an event you host from its page too. There is no button yet to delete your account or an event: email {email} from the address you sign in with, and your account with its chats, share links and Seva sign-ups, or an event you host, will be deleted within 30 days. You\'ll get a reply when it\'s done.',
                    'Google can take up to 180 days more to clear deleted data from its backups.',
                ],
            },
            changes: {
                heading: 'Changes to this page',
                items: [
                    'When what the site keeps or sends changes, this page changes with it, and the date at the top says when.',
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
        title: 'Terms of use',
        updated: 'Last updated {date}.',
        intro: 'SikhAI is free to use. These are the few rules that come with it, in plain words. By using the site, you agree to them.',
        sections: {
            about: {
                heading: 'What SikhAI is',
                items: [
                    'SikhAI is a free, independent site about Sikhi, Gurbani and the Punjabi language, built and run by Rohan Singh.',
                    'It isn\'t part of, or endorsed by, any Gurdwara, Sikh organization or Google.',
                ],
            },
            ai: {
                heading: 'AI answers can be wrong',
                items: [
                    'SikhAI\'s answers and translations, and the tutor\'s replies, are written by AI: Google Gemini, or, for a translation when Gemini is busy, Google Cloud Translation. They can be wrong, even when they sound sure.',
                    'They are not Gurbani, and they carry no religious authority. Check every Gurbani quote against the source (the Gurbani check under a reply helps), and for guidance, ask a Granthi or your Sangat.',
                    'They are not medical, legal or financial advice, and not help in a crisis. If you or someone else is in danger, call your local emergency number.',
                ],
            },
            age: {
                heading: '18 and over for AI',
                items: [
                    'The parts of SikhAI that use AI (Ask SikhAI, the translator and the Punjabi tutor) are for people 18 and over, as Google\'s terms for Gemini require. If you are under 18, please don\'t use them.',
                ],
            },
            use: {
                heading: 'Using it fairly',
                items: [
                    'Don\'t use SikhAI to harass, threaten or deceive anyone, to post hateful or sexual content, or for anything illegal.',
                    'Don\'t present its answers as Gurbani, as a Guru\'s words, or as an official Sikh ruling.',
                    'Don\'t scrape the site, flood it with automated requests, or try to get around its limits or security.',
                    'Don\'t use the AI features for anything Google\'s {usePolicy} forbids.',
                    'Use that breaks these terms can be limited or blocked, and what it posted removed.',
                ],
            },
            sharing: {
                heading: 'What you share',
                items: [
                    'Share links and Seva events are public. You are responsible for what you share and post, and it must be yours to share.',
                    'By sharing a chat or posting an event, you let SikhAI show it publicly until you stop sharing it or it is removed.',
                    'Seva events must be real chances to serve. Others may be removed.',
                    'If you host an event, use the names and contacts volunteers share with you only to organise that event, and don\'t pass them on.',
                    'SikhAI doesn\'t check events or the people who host them. Use your own judgement before meeting people you don\'t know.',
                    'Report an event only in good faith. Admins may hide an event that breaks these terms.',
                ],
            },
            gurbani: {
                heading: 'Gurbani',
                items: [
                    'Gurbani text, its English translations and the daily Hukamnama come from {gurbaninow}, with thanks. The Gurbani check compares a reply\'s quotes with the same source.',
                ],
            },
            warranty: {
                heading: 'No guarantees',
                items: [
                    'SikhAI is offered as it is, with no guarantee of any kind. It may be wrong, slow or unavailable, and any feature may change or end.',
                    'As far as the law allows, Rohan Singh is not responsible for any loss or harm that comes from using SikhAI.',
                ],
            },
            changes: {
                heading: 'Changes',
                items: [
                    'These terms may change. The date at the top says when they last did, and using SikhAI after a change means you accept it.',
                ],
            },
            contact: {
                heading: 'Contact',
                items: [
                    'Questions about these terms: email {email}. What the site keeps about you, and how to remove it, is on the {privacy} page.',
                ],
            },
        },
    },
};

export type PolicyDictionary = typeof policy;
export default policy;
