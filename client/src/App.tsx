import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import WorkoutBuilder, { WorkoutsLibrary } from "./pages/Workouts";
import LegalPage from "./pages/Legal";
import Dashboard from "./pages/Dashboard";
import DailyHealth from "./pages/DailyHealth";
import SmartwatchPage from "./pages/Smartwatch";
import WeeklyAssessmentPage from "./pages/WeeklyAssessment";
import SubscriptionPage from "./pages/Subscription";
import SignOutPage from "./pages/SignOut";

const TrainingPage = () => <Home view="training" />;
const AnalysisPage = () => <Home view="analysis" />;

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={TrainingPage} />
      <Route path={"/treino"} component={TrainingPage} />
      <Route path={"/analise"} component={AnalysisPage} />
      <Route path={"/perfil"} component={Profile} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/treinos"} component={WorkoutsLibrary} />
      <Route path={"/treinos/criar"} component={WorkoutBuilder} />
      <Route path={"/alimentacao"} component={DailyHealth} />
      <Route path={"/smartwatch"} component={SmartwatchPage} />
      <Route path={"/avaliacao"} component={WeeklyAssessmentPage} />
      <Route path={"/assinatura"} component={SubscriptionPage} />
      <Route path={"/sair"} component={SignOutPage} />
      <Route path={"/termos"}>{() => <LegalPage kind="terms" />}</Route>
      <Route path={"/privacidade"}>{() => <LegalPage kind="privacy" />}</Route>
      <Route path={"/login"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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
