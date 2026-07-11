"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInAnonymously 
} from "firebase/auth";
import { auth, googleProvider, db, doc, getDoc, setDoc } from "../lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
  role: "admin" | "auditor" | "viewer";
  createdAt: string;
  lastLoginAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithMock: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithMock: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  // Development bypass: Uses real Firebase Anonymous Authentication.
  // The user is authenticated with a real Firebase token, so all
  // Firestore operations work with real security rules.
  const loginWithMock = async () => {
    try {
      const cred = await signInAnonymously(auth);
      // onAuthStateChanged will handle setting user + profile
      // We store the dev profile metadata so onAuthStateChanged can use it
      if (cred.user) {
        const devProfile: UserProfile = {
          uid: cred.user.uid,
          name: "Mock Auditor",
          email: "work.sufiyan.ahmed078@gmail.com",
          photoUrl: "",
          role: "admin",
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        // Write the dev profile to Firestore so it persists
        const userDocRef = doc(db, "users", cred.user.uid);
        await setDoc(userDocRef, devProfile, { merge: true });
      }
    } catch (error) {
      console.error("Error signing in anonymously for dev login:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          const currentTime = new Date().toISOString();

          if (userDocSnap.exists()) {
            // Update lastLoginAt
            const existingData = userDocSnap.data() as UserProfile;
            const updatedProfile: UserProfile = {
              ...existingData,
              lastLoginAt: currentTime,
              // Fallback fields in case profile data was incomplete
              name: firebaseUser.displayName || existingData.name || "User",
              photoUrl: firebaseUser.photoURL || existingData.photoUrl || "",
            };

            await setDoc(userDocRef, { lastLoginAt: currentTime }, { merge: true });
            setProfile(updatedProfile);
          } else {
            // Determine role based on email address (or default for anonymous users)
            const email = firebaseUser.email || "";
            const adminEmails = ["work.sufiyan.ahmed078@gmail.com", "anwar.ali41@gmail.com"];
            const isAdmin = adminEmails.includes(email.toLowerCase());
            // Anonymous dev users get admin role; real users default to viewer
            const role = (isAdmin || firebaseUser.isAnonymous) ? "admin" : "viewer";

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || (firebaseUser.isAnonymous ? "Mock Auditor" : "User"),
              email: firebaseUser.email || (firebaseUser.isAnonymous ? "work.sufiyan.ahmed078@gmail.com" : ""),
              photoUrl: firebaseUser.photoURL || "",
              role,
              createdAt: currentTime,
              lastLoginAt: currentTime,
            };

            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching or creating user profile:", error);
          const email = firebaseUser.email || "";
          const adminEmails = ["work.sufiyan.ahmed078@gmail.com", "anwar.ali41@gmail.com"];
          const isAdmin = adminEmails.includes(email.toLowerCase());
          const role = (isAdmin || firebaseUser.isAnonymous) ? "admin" : "viewer";
          
          // Fallback minimal profile to let user use the app
          setProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || (firebaseUser.isAnonymous ? "Mock Auditor" : "User"),
            email: firebaseUser.email || (firebaseUser.isAnonymous ? "work.sufiyan.ahmed078@gmail.com" : ""),
            photoUrl: firebaseUser.photoURL || "",
            role,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, loginWithMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
