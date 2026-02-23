import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './apps/Dashboard'
import CalendarApp from './apps/CalendarApp'
import WaitlistApp from './apps/WaitlistApp'
import HandbookApp from './apps/HandbookApp'
import UsersApp from './apps/UsersApp'
import FoodPricingApp from './apps/FoodPricingApp'
import CompetitiveApp from './apps/CompetitiveApp'
import ComplianceApp from './apps/ComplianceApp'
import TimeOffApp from './apps/TimeOffApp'
import StaffingApp from './apps/StaffingApp'
import FinancialsApp from './apps/FinancialsApp'
import EmployeeDirectoryApp from './apps/EmployeeDirectoryApp'
import StaffPointsApp from './apps/StaffPointsApp'
import StaffReviewsApp from './apps/StaffReviewsApp'
import ComingSoon from './apps/ComingSoon'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/waitlist" element={<WaitlistApp />} />
        <Route path="/calendar" element={<CalendarApp />} />
        <Route path="/handbook" element={<HandbookApp />} />
        <Route path="/compliance" element={<ComplianceApp />} />
        <Route path="/food-pricing" element={<FoodPricingApp />} />
        <Route path="/competitive" element={<CompetitiveApp />} />
        <Route path="/time-off" element={<TimeOffApp />} />
        <Route path="/financials" element={user?.role === 'admin' ? <FinancialsApp /> : <Navigate to="/" />} />
        <Route path="/staffing" element={<StaffingApp />} />
        <Route path="/directory" element={<EmployeeDirectoryApp />} />
        <Route path="/staff-points" element={(user?.role === 'admin' || user?.role === 'director') ? <StaffPointsApp /> : <Navigate to="/" />} />
        <Route path="/staff-reviews" element={(user?.role === 'admin' || user?.role === 'director') ? <StaffReviewsApp /> : <Navigate to="/" />} />
        <Route path="/users" element={user.role === 'admin' ? <UsersApp /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
