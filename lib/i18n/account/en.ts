// The words of removing what the site keeps (#42): the two controls under
// "Removing it" on /privacy, and the Delete account dialog that any page opens
// from the account menu. They live apart from the dictionaries, which every
// page ships: /privacy passes its controls their words from the server, and
// the dialog loads them with its own code. The i18n audit checks them with
// the rest of the site's strings, under `account.`

const account = {
    // /privacy#removing, for anyone: clearing what this browser keeps
    // (lib/browserData.ts).
    clearBrowser: {
        heading: 'Clear this browser',
        body: 'Removes everything SikhAI keeps in this browser: the chats kept here, your translations, Learn Punjabi progress, settings, language choice and theme. Only a choice not to count your visits stays.',
        signedIn: 'It signs you out here too. What your account keeps isn\'t touched.',
        action: 'Clear this browser…',
        prompt: 'Remove everything SikhAI keeps in this browser? Chats kept only here can\'t be brought back.',
        confirm: 'Clear it',
        cancel: 'Cancel',
        clearing: 'Clearing…',
        done: 'This browser is clear.',
    },
};

export type AccountCopy = typeof account;
export default account;
