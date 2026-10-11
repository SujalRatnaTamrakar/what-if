/**
 * web/src/auth/AuthProvider.tsx — sign-in for the web app (§12).
 *
 * With VITE_AUTH0_CLIENT_ID set: Auth0 SPA login via @auth0/auth0-react
 * (redirect + PKCE, refresh tokens, audience = VITE_AUTH0_AUDIENCE). The
 * live client gets its bearer token from getAccessTokenSilently.
 *
 * Without a client ID in fixture mode: "Sign in" signs into the fixture user
 * (GET /me from fixtures) so the whole flow can be demoed with no tenant.
 *
 * Screens use the same useAuth() shape as mobile.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { config } from "../config";
import { api, setAuthHooks } from "../api";
import type { Me } from "../api/types";
import { kvGet, kvRemove, kvSet } from "../lib/kv";

const SCOPE = "openid profile email offline_access";

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: Me | null;
  /** Exact callback URL to paste into the Auth0 dashboard (§7.5 S9). */
  redirectUri: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const redirectUri = () => window.location.origin;

/** GET /me once a session exists; null when signed out. */
function useMeWhen(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ---------------------------------------------------------------- Auth0
function Auth0Bridge({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, getAccessTokenSilently, loginWithRedirect, logout: auth0Logout } = useAuth0();
  const qc = useQueryClient();
  const [expired, setExpired] = useState(false);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated) return null;
    try {
      return (await getAccessTokenSilently({ authorizationParams: { audience: config.auth0Audience, scope: SCOPE } })) ?? null;
    } catch {
      return null;
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Wire the live client's auth hooks during render: child queries start in
  // their own effects, which run before this component's effects would.
  setAuthHooks({
    getToken: getAccessToken,
    refreshToken: async () => {
      if (!isAuthenticated) return null;
      try {
        return (await getAccessTokenSilently({ cacheMode: "off", authorizationParams: { audience: config.auth0Audience, scope: SCOPE } })) ?? null;
      } catch {
        return null;
      }
    },
    onAuthRequired: () => setExpired(true),
  });

  const me = useMeWhen(isAuthenticated && !expired);

  const login = useCallback(async () => {
    setExpired(false);
    await loginWithRedirect({
      appState: { returnTo: window.location.pathname + window.location.search },
      authorizationParams: { audience: config.auth0Audience, scope: SCOPE, redirect_uri: redirectUri() },
    });
  }, [loginWithRedirect]);

  const logout = useCallback(async () => {
    qc.removeQueries({ queryKey: ["me"] });
    await auth0Logout({ logoutParams: { returnTo: redirectUri() } });
  }, [auth0Logout, qc]);

  const user = isAuthenticated && !expired ? (me.data ?? null) : null;
  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: isLoading || (isAuthenticated && !expired && me.isLoading),
      isLoggedIn: user !== null,
      user,
      redirectUri: redirectUri(),
      login,
      logout,
      getAccessToken,
    }),
    [isLoading, isAuthenticated, expired, me.isLoading, user, login, logout, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0Auth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Auth0Provider
      domain={config.auth0Domain}
      clientId={config.auth0ClientId}
      authorizationParams={{ redirect_uri: redirectUri(), audience: config.auth0Audience, scope: SCOPE }}
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => navigate(appState?.returnTo || "/profile", { replace: true })}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

// ---------------------------------------------------------------- fixture
function FixtureAuth({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void kvGet("fixture_signed_in").then((v) => setSignedIn(v === "1"));
  }, []);

  setAuthHooks({ getToken: async () => null, refreshToken: async () => null, onAuthRequired: () => setSignedIn(false) });

  const me = useMeWhen(signedIn === true);

  const login = useCallback(async () => {
    if (config.apiMode === "live") {
      window.alert("Sign-in needs VITE_AUTH0_CLIENT_ID in web/.env (see web/README.md).");
      return;
    }
    await kvSet("fixture_signed_in", "1");
    setSignedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await kvRemove("fixture_signed_in");
    qc.removeQueries({ queryKey: ["me"] });
    setSignedIn(false);
  }, [qc]);

  const user = signedIn ? (me.data ?? null) : null;
  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: signedIn === null || (signedIn && me.isLoading),
      isLoggedIn: user !== null,
      user,
      redirectUri: redirectUri(),
      login,
      logout,
      getAccessToken: async () => null,
    }),
    [signedIn, me.isLoading, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return config.auth0ClientId ? <Auth0Auth>{children}</Auth0Auth> : <FixtureAuth>{children}</FixtureAuth>;
}
