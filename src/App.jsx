import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LanguageProvider } from '@/components/providers/LanguageContext';
import Affiliate from './pages/Affiliate';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated, authError } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the app
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/login" element={<Pages.Login />} />
      <Route path="/Login" element={<Pages.Login />} />
      <Route path="/register" element={<Pages.Register />} />
      <Route path="/Register" element={<Pages.Register />} />
      <Route path="/forgot-password" element={<Pages.ForgotPassword />} />
      <Route path="/ForgotPassword" element={<Pages.ForgotPassword />} />
      <Route path="/reset-password" element={<Pages.ResetPassword />} />
      <Route path="/ResetPassword" element={<Pages.ResetPassword />} />

      {/* Main app routes (with layout & auth check) */}
      <Route path="/" element={
        !isAuthenticated ? <Pages.Login /> :
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />

      {Object.entries(Pages).map(([path, Page]) => {
        // Skip Login and Register as they are handled above
        if (['Login', 'Register', 'ForgotPassword', 'ResetPassword'].includes(path)) return null;
        
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              !isAuthenticated ? <Pages.Login /> :
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        );
      })}
      
      <Route path="/Affiliate" element={
        !isAuthenticated ? <Pages.Login /> :
        <LayoutWrapper currentPageName="Affiliate"><Affiliate /></LayoutWrapper>
      } />
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App