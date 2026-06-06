import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import AssetDetail from "@/pages/AssetDetail";
import Watchlists from "@/pages/Watchlists";
import Alerts from "@/pages/Alerts";
import SocialPage from "@/pages/Social";
import JournalPage from "@/pages/Journal";
import PayoutTrackerPage from "@/pages/PayoutTracker";
import EducationPage from "@/pages/Education";
import PBMBrainPage from "@/pages/PBMBrain";
import AITeachingPage from "@/pages/AITeaching";
import HistoryPage from "@/pages/History";
import SettingsPage from "@/pages/Settings";
import MobileNativeBridge from "@/components/MobileNativeBridge";

const withLayout = (node) => (
  <ProtectedRoute>
    <Layout>{node}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MobileNativeBridge />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={withLayout(<Dashboard />)} />
          <Route path="/markets" element={withLayout(<Markets />)} />
          <Route path="/asset/:symbol" element={withLayout(<AssetDetail />)} />
          <Route path="/watchlists" element={withLayout(<Watchlists />)} />
          <Route path="/alerts" element={withLayout(<Alerts />)} />
          <Route path="/social" element={withLayout(<SocialPage />)} />
          <Route path="/journal" element={withLayout(<JournalPage />)} />
          <Route path="/payout-tracker" element={withLayout(<PayoutTrackerPage />)} />
          <Route path="/education" element={withLayout(<EducationPage />)} />
          <Route path="/pbm-brain" element={withLayout(<PBMBrainPage />)} />
          <Route path="/ai-teaching" element={withLayout(<AITeachingPage />)} />
          <Route path="/history" element={withLayout(<HistoryPage />)} />
          <Route path="/settings" element={withLayout(<SettingsPage />)} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
