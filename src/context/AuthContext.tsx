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
import { isAdminEmail } from "../lib/adminConfig";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
  role: "admin" | "auditor" | "viewer";
  /** Approval workflow: new Google accounts start as "pending" and may
      not use the application until an administrator approves them. */
  status: ApprovalStatus;
  createdAt: string;
  lastLoginAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** True only for the configured administrator accounts. */
  isAdmin: boolean;
  /** True when the signed-in account may use the application. */
  isApproved: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithMock: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isApproved: false,
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
          status: "approved",
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
              // Accounts created before the approval workflow have no
              // status field; they keep their existing access.
              status: existingData.status || "approved",
              // Fallback fields in case profile data was incomplete
              name: firebaseUser.displayName || existingData.name || "User",
              photoUrl: firebaseUser.photoURL || existingData.photoUrl || "",
            };

            await setDoc(userDocRef, { lastLoginAt: currentTime }, { merge: true });
            setProfile(updatedProfile);
          } else {
            // First sign-in for this account.
            const email = firebaseUser.email || "";
            const admin = isAdminEmail(email);
            // Administrators and anonymous dev sessions are auto-approved;
            // every other new Google account starts as a PENDING request
            // and must be approved by an administrator before gaining access.
            const autoApproved = admin || firebaseUser.isAnonymous;

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || (firebaseUser.isAnonymous ? "Mock Auditor" : "User"),
              email: firebaseUser.email || (firebaseUser.isAnonymous ? "work.sufiyan.ahmed078@gmail.com" : ""),
              photoUrl: firebaseUser.photoURL || "",
              role: (admin || firebaseUser.isAnonymous) ? "admin" : "viewer",
              status: autoApproved ? "approved" : "pending",
              createdAt: currentTime,
              lastLoginAt: currentTime,
            };

            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching or creating user profile:", error);
          const email = firebaseUser.email || "";
          const admin = isAdminEmail(email);

          // Fallback minimal profile. Non-admin accounts stay pending here
          // so a Firestore outage can never bypass the approval gate.
          setProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || (firebaseUser.isAnonymous ? "Mock Auditor" : "User"),
            email: firebaseUser.email || (firebaseUser.isAnonymous ? "work.sufiyan.ahmed078@gmail.com" : ""),
            photoUrl: firebaseUser.photoURL || "",
            role: (admin || firebaseUser.isAnonymous) ? "admin" : "viewer",
            status: (admin || firebaseUser.isAnonymous) ? "approved" : "pending",
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

  const isAdmin = !!profile && (profile.role === "admin" || isAdminEmail(profile.email));
  const isApproved = !!profile && (profile.status === "approved" || isAdmin);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isApproved, loginWithGoogle, loginWithMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
