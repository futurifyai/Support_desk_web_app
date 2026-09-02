import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setAuthTokenGetter, registerPushToken } from "@workspace/api-client-react";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserProfile) => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "sd_token";
const USER_KEY = "sd_user";

async function tryRegisterPushToken(authToken: string) {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications").catch(() => null);
    if (!Notifications) return;
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== "granted") {
      const { status: asked } = await Notifications.requestPermissionsAsync();
      finalStatus = asked;
    }
    if (finalStatus !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (!tokenData?.data) return;
    setAuthTokenGetter(() => authToken);
    await registerPushToken({ token: tokenData.data }).catch(() => null);
  } catch {
    // Silently ignore — push notifications are optional
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as UserProfile;
          setToken(storedToken);
          setUser(parsedUser);
          setAuthTokenGetter(() => storedToken);
          void tryRegisterPushToken(storedToken);
        }
      } catch {
        // ignore storage errors
      } finally {
        setIsLoading(false);
      }
    }
    void loadStoredAuth();
  }, []);

  async function login(newToken: string, newUser: UserProfile) {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, newToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
    ]);
    setAuthTokenGetter(() => newToken);
    setToken(newToken);
    setUser(newUser);
    void tryRegisterPushToken(newToken);
  }

  async function updateUser(nextUser: UserProfile) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }

  async function logout() {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setAuthTokenGetter(() => null);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
