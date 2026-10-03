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

    // /privacy#removing, for someone signed in: the way to the dialog below.
    deletePanel: {
        heading: 'Delete your account',
        body: 'Deletes your account and what it keeps. You\'ll see what goes, and Google asks you to sign in again, before anything is deleted.',
        open: 'Delete my account…',
    },

    // The Delete account dialog (app/components/account/DeleteAccountDialog.tsx),
    // from the account menu or /privacy. `goes` follows the order things go in
    // (lib/account/deletion.ts), the account itself last.
    deleteAccount: {
        title: 'Delete your account?',
        intro: 'This deletes your SikhAI account and what it keeps. It doesn\'t touch your Google account, and it can\'t be undone.',
        goesHeading: 'What goes',
        goes: {
            links: 'Your share links: they stop working at once',
            events: 'Seva events you host: cancelled, then deleted with their volunteers\' sign-ups',
            signups: 'Your Seva sign-ups: you leave those events',
            chats: 'Chats saved in your account',
            account: 'Your account itself, last',
        },
        staysHeading: 'What stays',
        stays: [
            'Chats, translations and settings in this browser, until you clear it',
            'Reports you sent about Seva events, until the admins deal with them',
            'Copies in Google\'s backups, for up to 180 days',
        ],
        reauth: 'Next, Google asks you to sign in again, to check it\'s you.',
        keep: 'Keep my account',
        confirm: 'Delete my account',
        waiting: 'Waiting for Google…',
        deleting: 'Deleting. Keep this page open until it\'s done.',
        stepDone: 'Done',
        stepNow: 'Now',
        doneTitle: 'Your account is deleted',
        doneBody: 'You\'re signed out. Chats, translations and settings kept in this browser are still here.',
        clearToo: 'Clear this browser too',
        close: 'Close',
        retry: 'Try again',
        signInAgain: 'Sign in again',
        nothingDeleted: 'Nothing was deleted.',
        partlyDeleted: 'Some of it may already be deleted. Trying again is safe: it finishes the rest.',
        problems: {
            cancelled: 'Google\'s window closed before you signed in.',
            blocked: 'Your browser blocked Google\'s window. Allow pop-ups for this site, then try again.',
            'wrong-account': 'That\'s a different Google account. Choose the one you\'re signed in with here.',
            offline: 'You\'re offline. Connect, then try again.',
            'recent-login': 'Everything else is deleted. To delete the account itself, Google needs you to sign in once more.',
            failed: 'Something went wrong. If it keeps happening, email {email}.',
        },
        signedOut: 'You\'re signed out, so there\'s no account to delete here.',
    },
};

export type AccountCopy = typeof account;
export default account;
