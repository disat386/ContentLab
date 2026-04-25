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
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Cleanup previous profile subscription if any
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (currentUser) {
        // Auurio Hub standard: uses UID as document ID for users
        const profileRef = doc(db, 'users', currentUser.uid);
        
        unsubProfile = onSnapshot(profileRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
            setLoading(false);
          } else {
            // Attempt to check if email-based profile exists (migration fallback)
            let existingProfile: UserProfile | null = null;
            if (currentUser.email) {
              const emailRef = doc(db, 'users', currentUser.email);
              const emailSnap = await getDoc(emailRef);
              if (emailSnap.exists()) {
                existingProfile = emailSnap.data() as UserProfile;
              }
            }

            if (existingProfile) {
              setProfile(existingProfile);
              // Optional: Migrate to UID-based doc here if needed
            } else {
              // Initialize user profile if it doesn't exist
              const initialProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || 'User',
                credits: 10,
              };
              try {
                await setDoc(profileRef, initialProfile);
                setProfile(initialProfile);
              } catch (err) {
                console.error("Error creating profile:", err);
              }
            }
            setLoading(false);
          }
        }, (error) => {
          console.error("Profile sync error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // SSO Check
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

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
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
