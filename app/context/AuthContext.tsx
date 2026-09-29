'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AUTH_HINT_KEY,
  hasFirebaseAuthDb,
  planAuthStart,
  readAuthHint,
  writeAuthHint,
} from '@/lib/firebase/hint';

type AuthModule = typeof import('@/lib/firebase/auth');

type AuthContextType = {
  user: User | null;
  // A signed-in session is being restored, so who's here isn't known yet.
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  // Spread onto a sign-in button: Auth starts loading as the pointer, focus
  // or a finger arrives, so the click can open Google's popup at once. Safari
  // may block a popup that opens only after a download.
  signInIntent: { onPointerEnter: () => void; onFocus: () => void; onTouchStart: () => void };
};

const AuthContext = createContext<AuthContextType | null>(null);

// Firebase Auth loads at most once per page, and only when it's needed:
// straight away for a browser that was signed in last time
// (lib/firebase/hint.ts), and otherwise on the way to a sign-in button. Until
// then the visitor counts as signed out and nothing waits on it.
let authModule: AuthModule | null = null;
let authLoad: Promise<AuthModule> | null = null;

function loadAuth(): Promise<AuthModule> {
  if (!authLoad) {
    authLoad = import('@/lib/firebase/auth').then((m) => (authModule = m));
    authLoad.catch(() => { authLoad = null; }); // offline: the next need tries again
  }
  return authLoad;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthModule | null>(authModule);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (authModule) {
      setAuth(authModule);
      return;
    }
    loadAuth().then(setAuth, () => {
      // Couldn't fetch it: show the sign-in button, which tries again.
      setLoading(false);
      delete document.documentElement.dataset.auth;
    });
  }, []);

  // Once Auth is here, follow it: sign-ins and sign-outs in this tab or others.
  useEffect(() => {
    if (!auth) return;
    return auth.onAuthStateChanged(auth.auth, (u) => {
      setUser(u);
      setLoading(false);
      writeAuthHint(!!u);
    });
  }, [auth]);

  useEffect(() => {
    let cancelled = false;
    const hint = readAuthHint();
    void (async () => {
      const plan = planAuthStart(hint, hint === null ? await hasFirebaseAuthDb() : null);
      if (cancelled || plan === 'wait') return;
      if (plan === 'restore') setLoading(true);
      load();
    })();
    // Signed in in another tab, while this one hasn't loaded Auth.
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_HINT_KEY && e.newValue === '1') load();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, [load]);

  const signIn = useCallback(async () => {
    try {
      let m = authModule;
      if (!m) {
        // A click with no hover or focus first. Fetch Auth, and let it restore
        // any session this browser has before asking Google.
        m = await loadAuth();
        setAuth(m);
        await m.auth.authStateReady();
      }
      if (m.auth.currentUser) return;
      await m.signInWithPopup(m.auth, m.googleProvider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  }, []);

  const logOut = useCallback(async () => {
    if (!authModule) return; // no one is signed in before Auth has loaded
    try {
      await authModule.signOut(authModule.auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    signIn,
    logOut,
    signInIntent: { onPointerEnter: load, onFocus: load, onTouchStart: load },
  }), [user, loading, signIn, logOut, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
