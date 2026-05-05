import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

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
import Admin from "@/pages/admin";
import Courts from "@/pages/courts";
import Members from "@/pages/members";
import MatchRequests from "@/pages/match-requests";
import Assessment from "@/pages/assessment";
import Clients from "@/pages/clients";
import ClientProfile from "@/pages/client-profile";
import CoachMessages from "@/pages/coach-messages";
import PadelRules from "@/pages/padel-rules";
import PadelNews from "@/pages/padel-news";
import Registrations from "@/pages/registrations";

setAuthTokenGetter(() => localStorage.getItem("token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>

      <Route path="/matches/suggest">{() => <ProtectedRoute component={MatchSuggest} />}</Route>
      <Route path="/matches/:id">{() => <ProtectedRoute component={MatchDetail} />}</Route>
      <Route path="/matches">{() => <ProtectedRoute component={Matches} />}</Route>

      <Route path="/bookings/:id">{() => <ProtectedRoute component={BookingDetail} />}</Route>
      <Route path="/bookings">{() => <ProtectedRoute component={Bookings} />}</Route>

      <Route path="/courts">{() => <ProtectedRoute component={Courts} />}</Route>
      <Route path="/members">{() => <ProtectedRoute component={Members} />}</Route>
      <Route path="/match-requests">{() => <ProtectedRoute component={MatchRequests} />}</Route>
      <Route path="/assessment">{() => <ProtectedRoute component={Assessment} />}</Route>

      <Route path="/clients/:id">{() => <ProtectedRoute component={ClientProfile} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/clients">{() => <ProtectedRoute component={Clients} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/messages">{() => <ProtectedRoute component={CoachMessages} allowedRoles={["coach", "admin", "owner"]} />}</Route>
      <Route path="/rules">{() => <ProtectedRoute component={PadelRules} />}</Route>
      <Route path="/news">{() => <ProtectedRoute component={PadelNews} />}</Route>

      <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
      <Route path="/video-analysis/:id">{() => <ProtectedRoute component={VideoAnalysisDetail} />}</Route>
      <Route path="/video-analysis">{() => <ProtectedRoute component={VideoAnalysisList} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>

      <Route path="/registrations">{() => <ProtectedRoute component={Registrations} allowedRoles={["admin", "owner"]} />}</Route>
      <Route path="/coach">{() => <ProtectedRoute component={CoachDashboard} allowedRoles={["coach", "admin", "owner"]} />}</Route>
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
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
