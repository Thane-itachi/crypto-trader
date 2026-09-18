import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  EmailAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth';
import type { ConfirmationResult, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import type { Profile } from '../types';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  googleSignIn: () => Promise<{ error: string | null }>;
  sendPhoneCode: (phoneE164: string) => Promise<{ error: string | null }>;
  confirmPhoneCode: (code: string, displayName: string) => Promise<{ error: string | null }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (fields: Partial<Profile>) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function mapProfile(id: string, data: Record<string, unknown> | undefined): Profile {
  return {
    id,
    display_name: (data?.display_name as string | null) ?? null,
    avatar_url: (data?.avatar_url as string | null) ?? null,
    theme: (data?.theme as string) ?? 'dark',
    notif_trades: (data?.notif_trades as boolean) ?? true,
    notif_market: (data?.notif_market as boolean) ?? true,
  };
}

/** Bootstrap profile + $10,000 DEMO FUNDS portfolio for a new (or partially
 *  provisioned) account. Firestore security rules only allow creating the
 *  portfolio doc with exactly the demo seed values — clients can never
 *  update or delete it; all later mutations happen server-side in /api/trade. */
async function ensureBootstrap(uid: string, displayName: string | null): Promise<void> {
  const profileRef = doc(db, 'users', uid, 'profile', 'main');
  const portfolioRef = doc(db, 'users', uid, 'portfolio', 'main');
  const [profileSnap, portfolioSnap] = await Promise.all([getDoc(profileRef), getDoc(portfolioRef)]);
  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      display_name: displayName,
      avatar_url: null,
      theme: 'dark',
      notif_trades: true,
      notif_market: true,
      created_at: serverTimestamp(),
    });
  }
  if (!portfolioSnap.exists()) {
    await setDoc(portfolioRef, {
      cash: 10000,
      realized_pl: 0,
      realized_cost: 0,
      created_at: serverTimestamp(),
    });
  }
}

function authError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters';
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled yet. Enable it once in the Firebase console.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled';
    case 'auth/popup-blocked':
      return 'Pop-up blocked — please allow pop-ups for this site and try again';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in';
    case 'auth/invalid-phone-number':
      return 'Please enter a valid phone number';
    case 'auth/invalid-verification-code':
      return 'That code is incorrect — check the SMS and try again';
    case 'auth/code-expired':
      return 'That code has expired — request a new one';
    case 'auth/missing-verification-code':
      return 'Please enter the code from the SMS';
    case 'auth/captcha-check-failed':
      return 'Human verification failed — please try again';
    case 'auth/quota-exceeded':
      return 'SMS quota reached — please try again later';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// ---- Theme (dark default, persisted) ----

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ct-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ct-theme', theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    return onAuthStateChanged(auth, async (u) => {
      if (!active) return;
      setUser(u);
      if (u) {
        try {
          const pSnap = await getDoc(doc(db, 'users', u.uid, 'profile', 'main'));
          if (!pSnap.exists()) {
            const displayName = u.displayName ?? u.email?.split('@')[0] ?? 'Trader';
            await ensureBootstrap(u.uid, displayName);
            setProfile(mapProfile(u.uid, { display_name: displayName }));
          } else {
            setProfile(mapProfile(u.uid, pSnap.data()));
          }
        } catch {
          setProfile(mapProfile(u.uid, { display_name: u.displayName }));
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fbUpdateProfile(cred.user, { displayName });
      await ensureBootstrap(cred.user.uid, displayName);
      return { error: null };
    } catch (e) {
      return { error: authError((e as { code?: string }).code ?? '') };
    }
  }, []);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const sendPhoneCode = useCallback(async (phoneE164: string) => {
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'phone-recaptcha', { size: 'invisible' });
      }
      confirmationRef.current = await signInWithPhoneNumber(auth, phoneE164, recaptchaRef.current);
      return { error: null };
    } catch (e) {
      return { error: authError((e as { code?: string }).code ?? '') };
    }
  }, []);

  const confirmPhoneCode = useCallback(async (code: string, displayName: string) => {
    try {
      if (!confirmationRef.current) return { error: 'Please request a code first' };
      const cred = await confirmationRef.current.confirm(code);
      if (displayName) {
        try {
          await fbUpdateProfile(cred.user, { displayName });
        } catch {
          // non-fatal
        }
      }
      try {
        await ensureBootstrap(cred.user.uid, displayName);
      } catch {
        // self-heal on next auth state change
      }
      return { error: null };
    } catch (e) {
      return { error: authError((e as { code?: string }).code ?? '') };
    }
  }, []);

  const googleSignIn = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      try {
        await ensureBootstrap(cred.user.uid, cred.user.displayName);
      } catch {
        // self-heal on next auth state change if this fails
      }
      return { error: null };
    } catch (e) {
      return { error: authError((e as { code?: string }).code ?? '') };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      try {
        await ensureBootstrap(cred.user.uid, cred.user.displayName);
      } catch {
        // self-heal on next auth state change if this fails
      }
      return { error: null };
    } catch (e) {
      return { error: authError((e as { code?: string }).code ?? '') };
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      // Never reveal whether the account exists; same message either way.
      return { error: null };
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/invalid-email') return { error: 'That email address looks invalid.' };
      if (code === 'auth/too-many-requests') return { error: 'Too many attempts. Please try again in a few minutes.' };
      return { error: 'Could not send the reset email. Please try again.' };
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user || !user.email) return { error: 'Not signed in' };
      try {
        // changing a password requires recent authentication
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
        await fbUpdatePassword(user, newPassword);
        return { error: null };
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
          return { error: 'Your current password is incorrect' };
        }
        if (code === 'auth/weak-password') return { error: 'New password must be at least 6 characters' };
        if (code === 'auth/too-many-requests') return { error: 'Too many attempts — please wait a moment and try again' };
        return { error: 'Could not change your password. Please try again.' };
      }
    },
    [user],
  );

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const updateProfile = useCallback(
    async (fields: Partial<Profile>) => {
      if (!user) return { error: 'Not signed in' };
      try {
        await updateDoc(doc(db, 'users', user.uid, 'profile', 'main'), fields);
        setProfile((p) => (p ? { ...p, ...fields } : p));
        return { error: null };
      } catch {
        return { error: 'Could not save your profile. Please try again.' };
      }
    },
    [user],
  );

  return (
    <Ctx.Provider value={{ user, profile, loading, configured: isFirebaseConfigured, signUp, signIn, googleSignIn, sendPhoneCode, confirmPhoneCode, forgotPassword, changePassword, signOut, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}
