/**
 * web/src/App.tsx — root layout + routes (§12: same route names as mobile).
 * Providers: Router, QueryClient, Auth, Toast; FixtureBanner pinned on top.
 * Tabs: Community · Map · Create · Mine · Profile (bottom TabBar).
 */
import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthProvider";
import { AnimatedSplash } from "./components/AnimatedSplash";
import { FixtureBanner } from "./components/FixtureBanner";
import { TabBar } from "./components/TabBar";
import { ToastProvider } from "./ui/Toast";
import { CenterSpinner, View } from "./ui/primitives";
import { hasSeenOnboarding } from "./lib/onboarding";
import { theme } from "./theme";
import FeedScreen from "./screens/Feed";
import CreateScreen from "./screens/Create";
import MineScreen from "./screens/Mine";
import ProfileScreen from "./screens/Profile";
import Onboarding from "./screens/Onboarding";
import ProposalDetailScreen from "./screens/proposal/Detail";
import SuggestScreen from "./screens/proposal/Suggest";
import MaskScreen from "./screens/proposal/Mask";
import GenerateScreen from "./screens/proposal/Generate";
import ReviewScreen from "./screens/proposal/Review";
import Celebrate from "./screens/proposal/Celebrate";

// Leaflet is the biggest dependency; load it only when the Map tab opens.
const MapScreen = lazy(() => import("./screens/Map"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Screens manage their own polling (useJobPolling); don't refetch
      // aggressively on focus during the demo.
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

/** Sends first-time visitors to the onboarding story once. */
function OnboardingGate() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    // Deep links to a proposal (and the Auth0 callback) skip the story.
    if (pathname !== "/" || search.includes("code=")) return;
    let alive = true;
    void hasSeenOnboarding().then((seen) => {
      if (alive && !seen) navigate("/onboarding", { replace: true });
    });
    return () => {
      alive = false;
    };
    // First load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Tab screens above the bottom TabBar. */
function TabsLayout() {
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </View>
      <TabBar />
    </View>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <View style={{ height: "100dvh", backgroundColor: theme.colors.background, overflow: "hidden" }}>
              <FixtureBanner />
              <View style={{ flex: 1, minHeight: 0 }}>
                <Routes>
                  <Route element={<TabsLayout />}>
                    <Route index element={<FeedScreen />} />
                    <Route
                      path="map"
                      element={
                        <Suspense fallback={<CenterSpinner />}>
                          <MapScreen />
                        </Suspense>
                      }
                    />
                    <Route path="create" element={<CreateScreen />} />
                    <Route path="mine" element={<MineScreen />} />
                    <Route path="profile" element={<ProfileScreen />} />
                  </Route>
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="proposal/:id" element={<ProposalDetailScreen />} />
                  <Route path="proposal/:id/suggest" element={<SuggestScreen />} />
                  <Route path="proposal/:id/mask" element={<MaskScreen />} />
                  <Route path="proposal/:id/generate" element={<GenerateScreen />} />
                  <Route path="proposal/:id/review" element={<ReviewScreen />} />
                  <Route path="proposal/:id/celebrate" element={<Celebrate />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </View>
            </View>
            <OnboardingGate />
            <AnimatedSplash />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
