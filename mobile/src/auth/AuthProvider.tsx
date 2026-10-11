/**
 * mobile/src/auth/AuthProvider.tsx — Auth0 PKCE login per §7.6.
 * Uses expo-auth-session + expo-web-browser + expo-secure-store.
 * Do NOT use react-native-auth0 (needs a custom dev build).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { config } from "../config";
import { api, setAuthHooks } from "../api";
import type { Me } from "../api/types";
import { clearTokens, getTokens, saveTokens } from "./tokenStore";

WebBrowser.maybeCompleteAuthSession();

/** Authorization codes already exchanged. The Auth0 redirect can arrive
 *  twice on some devices (once via the auth session, once as a deep link),
 *  so codes are deduplicated here. */
const processedCodes = new Set<string>();

const SCOPES = ["openid", "profile", "email", "offline_access"];
/** Refresh when the token expires within this window. */
const REFRESH_SKEW_MS = 60_000;

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: Me | null;
  /** Exact redirect URI to paste into the Auth0 dashboard (§7.5 S9). */
  redirectUri: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /**
   * Exchange an authorization code for tokens. Called both by the
   * useAuthRequest response handler and by the /auth deep-link route
   * (Expo Go sometimes delivers the Auth0 redirect as a deep link
   * instead of completing the auth session). Safe to call twice for
   * the same code.
   */
  exchangeCode: (code: string, state: string | null) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function discoveryDocument() {
  return {
    authorizationEndpoint: `https://${config.auth0Domain}/authorize`,
    tokenEndpoint: `https://${config.auth0Domain}/oauth/token`,
    revocationEndpoint: `https://${config.auth0Domain}/oauth/revoke`,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Me | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: config.auth0Scheme,
    path: "auth",
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.auth0ClientId,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
      extraParams: { audience: config.auth0Audience },
    },
    discoveryDocument()
  );

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = await getTokens();
    if (!tokens?.accessToken) return null;
    if (tokens.expiresAt - Date.now() > REFRESH_SKEW_MS) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) return tokens.accessToken;
    try {
      const refreshed = await AuthSession.refreshAsync(
        { clientId: config.auth0ClientId, refreshToken: tokens.refreshToken },
        discoveryDocument()
      );
      const next = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
      };
      await saveTokens(next);
      return next.accessToken;
    } catch {
      return null;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    // Force a refresh by expiring the cached token, then use the normal path.
    const tokens = await getTokens();
    if (!tokens?.refreshToken) return null;
    await saveTokens({ ...tokens, expiresAt: 0 });
    return getAccessToken();
  }, [getAccessToken]);

  const loadUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, [getAccessToken]);

  // Wire the live client's auth hooks once.
  useEffect(() => {
    setAuthHooks({
      getToken: getAccessToken,
      refreshToken,
      onAuthRequired: () => {
        setUser(null);
      },
    });
  }, [getAccessToken, refreshToken]);

  // Restore session on launch.
  useEffect(() => {
    (async () => {
      await loadUser();
      setIsLoading(false);
    })();
  }, [loadUser]);

  // Exchange an authorization code for tokens. Shared by the auth-session
  // response handler below and the /auth deep-link route.
  const exchangeCode = useCallback(
    async (code: string, state: string | null): Promise<boolean> => {
      if (processedCodes.has(code)) return true;
      processedCodes.add(code);
      const verifier = request?.codeVerifier;
      if (!verifier) return false;
      if (state && request?.state && state !== request.state) return false;
      try {
        const exchanged = await AuthSession.exchangeCodeAsync(
          {
            clientId: config.auth0ClientId,
            code,
            redirectUri,
            extraParams: { code_verifier: verifier },
          },
          discoveryDocument()
        );
        await saveTokens({
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          expiresAt: Date.now() + (exchanged.expiresIn ?? 3600) * 1000,
        });
        await loadUser();
        return true;
      } catch {
        // Login failed; user stays logged out. Screens show the error.
        return false;
      }
    },
    [request, redirectUri, loadUser]
  );

  // Handle the redirect back from Auth0 via the auth session.
  useEffect(() => {
    if (response?.type !== "success" || !response.params.code) return;
    exchangeCode(response.params.code, (response.params.state as string) ?? null);
  }, [response, exchangeCode]);

  const login = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
    if (Platform.OS !== "web") {
      const returnTo = encodeURIComponent(redirectUri);
      await WebBrowser.openBrowserAsync(
        `https://${config.auth0Domain}/v2/logout?client_id=${config.auth0ClientId}&returnTo=${returnTo}`
      ).catch(() => {});
    }
  }, [redirectUri]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isLoggedIn: user !== null,
      user,
      redirectUri,
      login,
      logout,
      getAccessToken,
      exchangeCode,
    }),
    [isLoading, user, redirectUri, login, logout, getAccessToken, exchangeCode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
