"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";
import { getDeviceDetails, isMobileLoginAllowed } from "../lib/deviceDetection";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
  subscriptionPlan?: string;
  loginHistory?: Array<{
    browser: string;
    os: string;
    deviceCategory: string;
    ipAddress: string;
    timestamp: string;
    _id?: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ requiresOtp: boolean; email?: string } | void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => Promise<{ requiresOtp: boolean; email?: string } | void>;
  verifyOtpCode: (email: string, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        // For Chrome browsers, require OTP verification token in localStorage
        const device = getDeviceDetails();
        const isChrome = device.browser === "Google Chrome";
        const isOtpVerified = localStorage.getItem("otp-verified") === "true";

        if (isChrome && !isOtpVerified) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) {
            setUser(res.data);
            localStorage.setItem("twitter-user", JSON.stringify(res.data));
          }
        } catch (err) {
          console.log("Failed to fetch user:", err);
        }
      } else {
        setUser(null);
        localStorage.removeItem("twitter-user");
        localStorage.removeItem("otp-verified");
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const device = getDeviceDetails();

    // 1. Mobile login time constraint enforcement
    if (device.deviceCategory === "mobile" && !isMobileLoginAllowed()) {
      setIsLoading(false);
      throw new Error("Mobile access blocked. Login attempts allowed only between 10:00 AM and 1:00 PM IST.");
    }

    const usercred = await signInWithEmailAndPassword(auth, email, password);
    const firebaseuser = usercred.user;

    if (!firebaseuser?.email) {
      setIsLoading(false);
      throw new Error("Authentication failed. No email found.");
    }

    // 2. Google Chrome OTP verification redirection
    if (device.browser === "Google Chrome") {
      await axiosInstance.post("/generate-otp", { email: firebaseuser.email });
      setIsLoading(false);
      return { requiresOtp: true, email: firebaseuser.email };
    }

    // 3. Register standard login history for other environments
    await axiosInstance.post("/login-history", {
      email: firebaseuser.email,
      clientDeviceCategory: device.deviceCategory
    });

    const res = await axiosInstance.get("/loggedinuser", {
      params: { email: firebaseuser.email },
    });
    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));
    }
    setIsLoading(false);
    return { requiresOtp: false };
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);
    // Mock authentication - in real app, this would call an API
    const usercred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = usercred.user;
    const newuser: any = {
      username,
      displayName,
      avatar: user.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      email: user.email,
    };
    const res = await axiosInstance.post("/register", newuser);
    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));
    }
    // const mockUser: User = {
    //   id: '1',
    //   username,
    //   displayName,
    //   avatar: 'https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400',
    //   bio: '',
    //   joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    // };
    setIsLoading(false);
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
    localStorage.removeItem("twitter-user");
    localStorage.removeItem("otp-verified");
  };

  const verifyOtpCode = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      await axiosInstance.post("/verify-otp", { email, otp });
      localStorage.setItem("otp-verified", "true");

      const device = getDeviceDetails();
      // Record login history
      await axiosInstance.post("/login-history", {
        email,
        clientDeviceCategory: device.deviceCategory
      });

      const res = await axiosInstance.get("/loggedinuser", {
        params: { email },
      });
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } catch (err: any) {
      localStorage.removeItem("otp-verified");
      throw new Error(err.response?.data?.error || "OTP verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => {
    if (!user) return;

    setIsLoading(true);
    // Mock API call - in real app, this would call an API
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedUser: User = {
      ...user,
      ...profileData,
    };
    const res = await axiosInstance.patch(
      `/userupdate/${user.email}`,
      updatedUser
    );
    if (res.data) {
      setUser(updatedUser);
      localStorage.setItem("twitter-user", JSON.stringify(updatedUser));
    }

    setIsLoading(false);
  };
  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const device = getDeviceDetails();

      // Mobile login time window constraint
      if (device.deviceCategory === "mobile" && !isMobileLoginAllowed()) {
        throw new Error("Mobile access blocked. Login attempts allowed only between 10:00 AM and 1:00 PM IST.");
      }

      const googleauthprovider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleauthprovider);
      const firebaseuser = result.user;

      if (!firebaseuser?.email) {
        throw new Error("No email found in Google account");
      }

      let userData;

      try {
        const res = await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseuser.email },
        });
        userData = res.data;
      } catch (err: any) {
        const newuser: any = {
          username: firebaseuser.email.split("@")[0],
          displayName: firebaseuser.displayName || "User",
          avatar: firebaseuser.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseuser.email,
        };

        const registerRes = await axiosInstance.post("/register", newuser);
        userData = registerRes.data;
      }

      if (device.browser === "Google Chrome") {
        await axiosInstance.post("/generate-otp", { email: firebaseuser.email });
        setIsLoading(false);
        return { requiresOtp: true, email: firebaseuser.email };
      }

      // Record login history
      await axiosInstance.post("/login-history", {
        email: firebaseuser.email,
        clientDeviceCategory: device.deviceCategory
      });

      if (userData) {
        setUser(userData);
        localStorage.setItem("twitter-user", JSON.stringify(userData));
      } else {
        throw new Error("Login/Register failed: No user data returned");
      }
      return { requiresOtp: false };
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(error.response?.data?.message || error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        verifyOtpCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
