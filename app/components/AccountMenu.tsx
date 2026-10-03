'use client';

import type { User } from 'firebase/auth';
import { ArrowRightStartOnRectangleIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useT } from '../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { openDeleteAccount, preloadDeleteAccount } from './account/AccountDialogHost';
import { useMenuButton } from './useMenuButton';

const ITEM = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors hover:bg-white/5';

// Signed in, the navbar's account menu: signing out, and deleting the account
// (#42). The trigger is a person, narrower than the Sign out button it
// replaced, with the greeting beside it from xl up, part of its name. Its
// focus, keys and dismissal are useMenuButton's, as for the pickers beside it.
export default function AccountMenu({ user }: { user: User }) {
    const t = useT();
    const { logOut } = useAuth();
    const { open, rootRef, triggerRef, itemRef, toggle, choose, onRootBlur, onMenuKeyDown } =
        useMenuButton({ itemCount: 2, focusOnOpen: 0 });

    // Signed out, this menu is gone: focus goes to the Sign in that takes its place.
    const signOut = () => choose(() => {
        void logOut().then(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-sign-in]')?.focus()));
    });

    return (
        <div ref={rootRef} className="relative" onBlur={onRootBlur}>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex items-center gap-2 rounded-lg p-2 text-slate-300 hover:text-kesri transition-colors"
            >
                <span className="hidden xl:block max-w-40 truncate text-sm">
                    {fmt(t.nav.greeting, { name: user.displayName?.split(' ')[0] ?? '' })}
                </span>
                <UserCircleIcon className="w-6 h-6 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t.nav.account}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={t.nav.account}
                    onKeyDown={onMenuKeyDown}
                    className="absolute right-0 mt-2 min-w-48 rounded-xl border border-white/10 bg-navy shadow-xl py-1.5 z-50"
                >
                    <button ref={itemRef(0)} type="button" role="menuitem" onClick={signOut} className={`${ITEM} text-slate-200 hover:text-kesri`}>
                        <ArrowRightStartOnRectangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {t.nav.signOut}
                    </button>
                    <button
                        ref={itemRef(1)}
                        type="button"
                        role="menuitem"
                        onClick={() => choose(openDeleteAccount)}
                        onPointerEnter={preloadDeleteAccount}
                        onFocus={preloadDeleteAccount}
                        className={`${ITEM} text-red-300 hover:text-red-200`}
                    >
                        <TrashIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {t.nav.deleteAccount}
                    </button>
                </div>
            )}
        </div>
    );
}
