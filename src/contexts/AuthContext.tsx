import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  credits: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (emailHint?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  popupBlocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        // Setup realtime profile sync - Using email as key per Hub requirements
        const profileRef = doc(db, 'users', currentUser.email);
        
        const unsubProfile = onSnapshot(profileRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          } else {
            // Initialize user profile if it doesn't exist
            const initialProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'User',
              credits: 10, // Starter credits
            };
            const path = 'users/' + (currentUser.email || currentUser.uid);
            try {
              await setDoc(profileRef, initialProfile);
              setProfile(initialProfile);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, path);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'users/' + (currentUser.email || currentUser.uid));
          setLoading(false);
        });

        return () => unsubProfile();
      } else if (currentUser && !currentUser.email) {
        // Fallback for anonymous users without email
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // SSO Check (CRITICAL requirement)
    const handleSSO = async () => {
      const params = new URLSearchParams(window.location.search);
      const isSSO = params.get('sso') === 'true';
      const email = params.get('email');

      if (isSSO && email && !auth.currentUser) {
        try {
          googleProvider.setCustomParameters({ login_hint: email });
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/popup-blocked') {
            setPopupBlocked(true);
          }
          console.error("SSO Error:", error);
        }
      }
    };
    handleSSO();

    return () => unsubscribe();
  }, []);

  const signIn = async (emailHint?: string) => {
    try {
      setPopupBlocked(false);
      if (emailHint) {
        googleProvider.setCustomParameters({ login_hint: emailHint });
      }
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (user && user.email) {
      const path = 'users/' + user.email;
      try {
        const snapshot = await getDoc(doc(db, 'users', user.email));
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    } else if (user) {
      const path = 'users/' + user.uid;
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, refreshProfile, popupBlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
