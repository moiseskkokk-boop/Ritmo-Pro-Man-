import { lazy, Suspense } from "react";
const Fitness = lazy(() => import("./pages/Fitness"));
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Home = lazy(() => import("./pages/Home"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const WorkoutBuilder = lazy(() => import("./pages/Workouts"));
const WorkoutsLibrary = lazy(() =>
  import("./pages/Workouts").then(module => ({
    default: module.WorkoutsLibrary,
  }))
);
const LegalPage = lazy(() => import("./pages/Legal"));
const WeeklyAssessmentPage = lazy(() => import("./pages/WeeklyAssessment"));
const SubscriptionPage = lazy(() => import("./pages/Subscription"));
const SignOutPage = lazy(() => import("./pages/SignOut"));
const Experience = lazy(() => import("./pages/Experience"));
const Woman = lazy(() => import("./pages/Woman"));

const TrainingPage = () => <Fitness view="training" />;
const AnalysisPage = () => <Home view="analysis" />;

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center" role="status">
          Ritmo Pro…
        </main>
      }
    >
      <Switch>
        <Route path={"/"} component={Experience} />
        <Route path={"/treino"} component={TrainingPage} />
        <Route path={"/analise"} component={AnalysisPage} />
        <Route path={"/perfil"} component={Profile} />
        <Route path={"/escolher-versao"} component={Experience} />
        <Route path={"/woman"} component={Woman} />
        <Route path={"/dashboard"}>{() => <Fitness view="dashboard" />}</Route>
        <Route path={"/treinos"} component={WorkoutsLibrary} />
        <Route path={"/treinos/criar"} component={WorkoutBuilder} />
        <Route path={"/alimentacao"} component={TrainingPage} />
        <Route path={"/corpo"}>{() => <Fitness view="body" />}</Route>
        <Route path={"/historico"}>{() => <Fitness view="history" />}</Route>
        <Route path={"/coach"}>{() => <Fitness view="coach" />}</Route>
        <Route path={"/avaliacao"} component={WeeklyAssessmentPage} />
        <Route path={"/assinatura"} component={SubscriptionPage} />
        <Route path={"/sair"} component={SignOutPage} />
        <Route path={"/termos"}>{() => <LegalPage kind="terms" />}</Route>
        <Route path={"/privacidade"}>
          {() => <LegalPage kind="privacy" />}
        </Route>
        <Route path={"/login"} component={Login} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
