'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { ERROR_TEXT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { MODAL_DIALOG, useModalDialog } from '@/app/components/useModalDialog';
import { DELETION_STEPS, problemOf, type DeletionProblem, type DeletionStep } from '@/lib/account/steps';
import { prepareAccountDeletion } from '@/lib/account/prepare';
import { clearThisBrowser } from '@/lib/browserData';
import { cloudChatsEnabled } from '@/lib/firebase/config';
import { getAccountCopy, type AccountCopy } from '@/lib/i18n/account';
import { localePath } from '@/lib/i18n/paths';
import { splitTemplate } from '@/lib/i18n/fmt';
import { CONTACT_EMAIL } from '@/lib/site';
import { deleteAccountData, loadAccountDeletion } from './accountDeletion';

// Deleting the signed-in account (#42), from the account menu or /privacy
// (./AccountDialogHost.tsx). It says what goes and what stays; Google then
// confirms it's them (Firebase wants a recent sign-in), everything the
// account keeps goes (lib/account/deletion.ts), and the account itself last.
// Any step can be cut short and run again: the run finishes what's left.

type Step = DeletionStep | 'account';
type Phase =
    | { kind: 'confirm' }
    | { kind: 'reauth' }
    | { kind: 'deleting'; step: Step }
    | { kind: 'problem'; problem: DeletionProblem }
    | { kind: 'done' };

const ORDER: Step[] = [...DELETION_STEPS, 'account'];
// Share links and chats are kept in accounts only once that's on
// (NEXT_PUBLIC_CHAT_CLOUD); the run looks for them either way.
const SHOWN = ORDER.filter((step) => cloudChatsEnabled || (step !== 'links' && step !== 'chats'));

const isBusy = (phase: Phase) => phase.kind === 'reauth' || phase.kind === 'deleting';

export default function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    // While Google is asked and the account goes, the dialog stays: Escape
    // and the backdrop do nothing, and Chromium's forced close on a second
    // Escape is put straight back.
    const busyRef = useRef(false);
    const close = () => { if (!busyRef.current) onClose(); };
    const { ref, onCancel, onClick } = useModalDialog(open, close);
    const onDialogClose = () => {
        if (open && busyRef.current) ref.current?.showModal();
        else if (open) onClose();
    };

    // Whatever opened it may be gone by now (the account deleted, or signed
    // out): once it has closed and the browser has handed focus back, focus
    // goes to Sign in rather than the top of the page.
    const wasOpen = useRef(false);
    useEffect(() => {
        if (open) {
            wasOpen.current = true;
            return;
        }
        if (!wasOpen.current) return;
        wasOpen.current = false;
        const timer = setTimeout(() => {
            if (document.activeElement === document.body) document.querySelector<HTMLElement>('[data-sign-in]')?.focus();
        });
        return () => clearTimeout(timer);
    }, [open]);
    return (
        <dialog
            ref={ref}
            onCancel={onCancel}
            onClick={onClick}
            onClose={onDialogClose}
            aria-labelledby="delete-account-title"
            className={MODAL_DIALOG}
        >
            {open && <Body busyRef={busyRef} onClose={close} />}
        </dialog>
    );
}

// Accounts this tab has started deleting: a problem after that, in this
// dialog or one opened later, can't say "nothing was deleted".
const started = new Set<string>();

function Body({ busyRef, onClose }: { busyRef: RefObject<boolean>; onClose: () => void }) {
    const { lang } = useLanguage();
    const { deleteAccount: copy, clearBrowser } = getAccountCopy(lang);
    const { user, reauthenticate, deleteAccount } = useAuth();
    const [phase, setPhase] = useState<Phase>({ kind: 'confirm' });
    // Each try, so the same problem twice is read out twice.
    const [attempt, setAttempt] = useState(0);
    const [askingToClear, setAskingToClear] = useState(false);
    const { announce, announcer } = useAnnouncer();
    const working = isBusy(phase);

    useEffect(() => { busyRef.current = working; }, [busyRef, working]);

    // Leaving the page while the account goes would cut the run short: safe
    // to run again, but not what anyone means to do.
    useEffect(() => {
        if (!working) return;
        const stay = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener('beforeunload', stay);
        return () => window.removeEventListener('beforeunload', stay);
    }, [working]);

    // A problem, or the end, takes focus, so it's read out where it appears.
    const outcomeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (phase.kind === 'problem' || phase.kind === 'done') outcomeRef.current?.focus();
    }, [phase.kind, attempt]);

    // Asking before clearing this browser too swaps the buttons, so focus
    // moves with them: to Cancel when the question appears, then back.
    const clearTooRef = useRef<HTMLButtonElement>(null);
    const askedToClear = useRef(false);
    useEffect(() => {
        if (askingToClear) askedToClear.current = true;
        else if (askedToClear.current) clearTooRef.current?.focus();
    }, [askingToClear]);

    const run = async (uid: string, confirmed: Promise<void>) => {
        try {
            await confirmed;
            prepareAccountDeletion(uid);
            await deleteAccountData(uid, (step) => {
                started.add(uid);
                setPhase({ kind: 'deleting', step });
                if (SHOWN.includes(step)) announce(copy.goes[step]);
            });
            setPhase({ kind: 'deleting', step: 'account' });
            announce(copy.goes.account);
            await deleteAccount();
            setPhase({ kind: 'done' });
        } catch (error) {
            setPhase({ kind: 'problem', problem: problemOf(error, navigator.onLine) });
        }
    };

    const start = () => {
        if (working || !user) return;
        setAttempt((n) => n + 1);
        if (!navigator.onLine) {
            setPhase({ kind: 'problem', problem: 'offline' });
            return;
        }
        // Google's window opens now, in this click, before anything awaits
        // (Safari blocks it otherwise); the deletion's code arrives meanwhile.
        const confirmed = reauthenticate();
        void loadAccountDeletion().catch(() => {});
        setPhase({ kind: 'reauth' });
        void run(user.uid, confirmed);
    };

    if (phase.kind === 'done') {
        return (
            <div className="p-5">
                <div ref={outcomeRef} tabIndex={-1} className="outline-none">
                    <h2 id="delete-account-title" className="text-lg font-bold text-ink">{copy.doneTitle}</h2>
                    <p className="mt-2 text-ink">{copy.doneBody}</p>
                </div>
                {askingToClear ? (
                    // As /privacy asks: chats kept only here can't come back.
                    <div role="group" aria-labelledby="clear-too-prompt" className="mt-5 space-y-3">
                        <p id="clear-too-prompt" className="text-sm text-ink">{clearBrowser.prompt}</p>
                        <div className="flex flex-wrap justify-end gap-3">
                            {/* autoFocus: it takes the place of the button just pressed. */}
                            <button type="button" autoFocus onClick={() => setAskingToClear(false)} className={SECONDARY_BUTTON}>
                                {clearBrowser.cancel}
                            </button>
                            <button type="button" onClick={() => clearThisBrowser(localePath(lang, '/privacy'))} className={DANGER_BUTTON}>
                                {clearBrowser.confirm}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button ref={clearTooRef} type="button" onClick={() => setAskingToClear(true)} className={SECONDARY_BUTTON}>
                            {copy.clearToo}
                        </button>
                        <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>{copy.close}</button>
                    </div>
                )}
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-5">
                <h2 id="delete-account-title" className="text-lg font-bold text-ink">{copy.title}</h2>
                <p className="mt-2 text-ink">{copy.signedOut}</p>
                <div className="mt-5 flex justify-end">
                    <button type="button" data-initial-focus onClick={onClose} className={SECONDARY_BUTTON}>{copy.close}</button>
                </div>
            </div>
        );
    }

    const stepState = (step: Step): 'done' | 'now' | 'waiting' => {
        if (phase.kind !== 'deleting') return 'waiting';
        const at = ORDER.indexOf(phase.step);
        const mine = ORDER.indexOf(step);
        return mine < at ? 'done' : mine === at ? 'now' : 'waiting';
    };

    return (
        <div className="p-5">
            <h2 id="delete-account-title" className="text-lg font-bold text-ink">{copy.title}</h2>
            <p className="mt-2 text-ink">{copy.intro}</p>

            <h3 className="mt-4 font-semibold text-ink">{copy.goesHeading}</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
                {SHOWN.map((step) => (
                    <StepItem key={step} label={copy.goes[step]} state={phase.kind === 'deleting' ? stepState(step) : null} copy={copy} />
                ))}
            </ul>

            <h3 className="mt-4 font-semibold text-ink">{copy.staysHeading}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {copy.stays.map((item) => <li key={item}>{item}</li>)}
            </ul>

            {phase.kind === 'problem' ? (
                <div key={attempt} ref={outcomeRef} tabIndex={-1} role="alert" className="mt-4 space-y-1 outline-none">
                    <p className={ERROR_TEXT}><Problem text={copy.problems[phase.problem]} /></p>
                    {/* Asked to sign in again, everything else is already gone. */}
                    {phase.problem !== 'recent-login' && (
                        <p className="text-sm text-ink-muted">{started.has(user.uid) ? copy.partlyDeleted : copy.nothingDeleted}</p>
                    )}
                </div>
            ) : (
                <p className="mt-4 text-sm text-ink-muted">{phase.kind === 'deleting' ? copy.deleting : copy.reauth}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
                {phase.kind === 'problem' ? (
                    <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>{copy.close}</button>
                ) : (
                    <button type="button" data-initial-focus onClick={onClose} aria-disabled={working || undefined} className={SECONDARY_BUTTON}>
                        {copy.keep}
                    </button>
                )}
                <button type="button" onClick={start} aria-disabled={working || undefined} className={DANGER_BUTTON}>
                    {phase.kind === 'reauth' ? copy.waiting
                        : phase.kind === 'deleting' ? copy.deletingNow
                            : phase.kind === 'problem' ? (phase.problem === 'recent-login' ? copy.signInAgain : copy.retry)
                                : copy.confirm}
                </button>
            </div>
            {announcer}
        </div>
    );
}

function StepItem({ label, state, copy }: {
    label: string;
    state: 'done' | 'now' | 'waiting' | null;
    copy: AccountCopy['deleteAccount'];
}) {
    if (state === null) {
        return (
            <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                {label}
            </li>
        );
    }
    return (
        <li className={`flex items-start gap-2 ${state === 'waiting' ? 'text-ink-muted' : ''}`}>
            {state === 'done' && <CheckCircleIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />}
            {state === 'now' && <ArrowPathIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text motion-safe:animate-spin" />}
            {state === 'waiting' && <span aria-hidden="true" className="h-5 w-5 shrink-0" />}
            <span>
                {label}
                {state !== 'waiting' && <span className="sr-only"> ({state === 'done' ? copy.stepDone : copy.stepNow})</span>}
            </span>
        </li>
    );
}

// The problem, with the contact address as a link.
function Problem({ text }: { text: string }) {
    return splitTemplate(text).map((part, i) => (typeof part === 'string' ? part : part.key === 'email'
        ? <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="underline break-all">{CONTACT_EMAIL}</a>
        : `{${part.key}}`));
}
