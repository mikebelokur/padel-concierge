import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "sonner";
import Welcome from "@/pages/welcome";
import Quiz from "@/pages/quiz";
import Result from "@/pages/result";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-[#555]">
      <div className="text-center">
        <div className="text-4xl mb-4">🏸</div>
        <p>Страница не найдена</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/result" component={Result} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
      <Toaster theme="dark" position="top-center" />
    </WouterRouter>
  );
}
