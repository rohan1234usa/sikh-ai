'use client';

// Account chats' share of Firebase: Firestore, and the Auth listener that
// drops an account's chats when it signs out. chatStores.ts loads this with
// import(), only once account chats are on and someone is signed in, so the
// chat page otherwise ships neither.

import { auth, onAuthStateChanged } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/firestore';
import { FirestoreChatStore, type AccountStoreOptions } from '@/lib/chat/store/firestore';

export function createAccountStore(uid: string, opts: AccountStoreOptions): FirestoreChatStore {
    return new FirestoreChatStore(db, uid, opts);
}

// The signed-in account, here or in another tab; null once signed out.
export function onAccountChange(onChange: (uid: string | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => onChange(user?.uid ?? null));
}
