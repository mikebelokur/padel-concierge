import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage, type Language } from "@/contexts/LanguageContext";
import { DrawerProvider } from "@/contexts/DrawerContext";
import { Drawer } from "@/components/layout/Drawer";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DevToolbar } from "@/components/DevToolbar";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import Matches from "@/pages/matches";
import MatchSuggest from "@/pages/match-suggest";
import MatchDetail from "@/pages/match-detail";
import Bookings from "@/pages/bookings";
import BookingDetail from "@/pages/booking-detail";
import Profile from "@/pages/profile";
import VideoAnalysisList from "@/pages/video-analysis-list";
import VideoAnalysisDetail from "@/pages/video-analysis-detail";
import Settings from "@/pages/settings";
import CoachDashboard from "@/pages/coach";
import CoachGroupTrainings from "@/pages/coach-group-trainings";
const GroupTrainings = lazy(() => import("@/pages/group-trainings"));
import Admin from "@/pages/admin";
import AdminUsers from "@/pages/admin-users";
import Courts from "@/pages/courts";
import Members from "@/pages/members";
import MatchRequests from "@/pages/match-requests";
import Assessment from "@/pages/assessment";
import Clients from "@/pages/clients";
import ClientNew from "@/pages/client-new";
import ClientProfile from "@/pages/client-profile";
import MatchLog from "@/pages/match-log";
import MatchFeedback from "@/pages/match-feedback";
import CoachMessages from "@/pages/coach-messages";
import PadelRules from "@/pages/padel-rules";
import PadelNews from "@/pages/padel-news";
import Registrations from "@/pages/registrations";
import Quiz from "@/pages/quiz";
import LevelQuiz from "@/pages/level-quiz";
import LevelQuizResult from "@/pages/level-quiz-result";
import LevelQuizProfile from "@/pages/level-quiz-profile";
import LevelQuizAdmin from "@/pages/level-quiz-admin";
import PlayerProfilePage from "@/pages/player-profile";
import FindMatch from "@/pages/find-match";
import Invite from "@/pages/invite";
import AdminClientProfile from "@/pages/admin-client-profile";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";

setAuthTokenGetter(() => localStorage.getItem("token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/** Syncs user.language → i18n on login */
function LanguageSync() {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  useEffect(() => {
    const lang = user?.language;
    if (lang === "ru" || lang === "en") {
      setLanguage(lang as Language);
    }
  }, [user?.id, user?.language]);
  return null;
}

function ProtectedRoute({
  component: Component,
  allowedRoles,
  allowedEmails,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
  allowedEmails?: string[];
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  const roleOk = !allowedRoles || allowedRoles.includes(user.role);
  const emailOk = allowedEmails && allowedEmails.includes(user.email);
  if (!roleOk && !emailOk) {
    return <Redirect to="/dashboard" />;
  }
  return (
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/invite/:token" component={Invite} />

      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/find-match">{() => <ProtectedRoute component={FindMatch} />}</Route>

      <Route path="/matches/suggest">{() => <ProtectedRoute component={MatchSuggest} />}</Route>
      <Route path="/matches/:id">{() => <ProtectedRoute component={MatchDetail} />}</Route>
      <Route path="/matches">{() => <ProtectedRoute component={Matches} />}</Route>

      <Route path="/bookings/:id">{() => <ProtectedRoute component={BookingDetail} />}</Route>
      <Route path="/bookings">{() => <ProtectedRoute component={Bookings} />}</Route>

      <Route path="/courts">{() => <ProtectedRoute component={Courts} />}</Route>
      <Route path="/members">{() => <ProtectedRoute component={Members} />}</Route>
      <Route path="/players/:id">{() => <ProtectedRoute component={PlayerProfilePage} />}</Route>
      <Route path="/match-requests">{() => <ProtectedRoute component={MatchRequests} />}</Route>
      <Route path="/match-log/:id">{() => <ProtectedRoute component={MatchLog} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/match-feedback/:id">{() => <ProtectedRoute component={MatchFeedback} />}</Route>
      <Route path="/assessment">{() => <ProtectedRoute component={Assessment} />}</Route>

      <Route path="/clients/new">{() => <ProtectedRoute component={ClientNew} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/clients/:id">{() => <ProtectedRoute component={ClientProfile} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/clients">{() => <ProtectedRoute component={Clients} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/messages">{() => <ProtectedRoute component={CoachMessages} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/rules">{() => <ProtectedRoute component={PadelRules} />}</Route>
      <Route path="/news">{() => <ProtectedRoute component={PadelNews} />}</Route>

      <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
      <Route path="/video-analysis/:id">{() => <ProtectedRoute component={VideoAnalysisDetail} />}</Route>
      <Route path="/video-analysis">{() => <ProtectedRoute component={VideoAnalysisList} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>

      <Route path="/quiz" component={Quiz} />

      {/* Level Quiz — no auth required */}
      <Route path="/level-quiz" component={LevelQuiz} />
      <Route path="/level-quiz/result" component={LevelQuizResult} />
      <Route path="/level-quiz/profile" component={LevelQuizProfile} />
      <Route path="/level-quiz/admin">{() => <ProtectedRoute component={LevelQuizAdmin} allowedRoles={["admin", "owner", "coach"]} />}</Route>

      <Route path="/registrations">{() => <ProtectedRoute component={Registrations} allowedRoles={["admin", "owner"]} />}</Route>
      <Route path="/coach/group-trainings">{() => <ProtectedRoute component={CoachGroupTrainings} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/group-trainings">{() => (
        <Suspense fallback={null}>
          <ProtectedRoute component={GroupTrainings} />
        </Suspense>
      )}</Route>
      <Route path="/coach">{() => <ProtectedRoute component={CoachDashboard} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} allowedRoles={["admin", "owner"]} allowedEmails={["mikebelokur8@gmail.com"]} />}</Route>
      <Route path="/admin/clients/:userId">{() => <ProtectedRoute component={AdminClientProfile} allowedRoles={["admin", "owner", "coach"]} />}</Route>
      <Route path="/admin/coaching">{() => <Redirect to="/admin/users" />}</Route>
      <Route path="/admin">{() => <ProtectedRoute component={Admin} allowedRoles={["admin", "owner"]} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <LanguageSync />
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <DrawerProvider>
                <Drawer />
                <Router />
                <DevToolbar />
                <PWAInstallBanner />
              </DrawerProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
