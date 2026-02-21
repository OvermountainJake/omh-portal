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
        <Route path="/compliance" element={<ComingSoon title="Teacher Compliance" desc="Track teacher certifications, training, and regulatory compliance." icon="ShieldCheck" />} />
        <Route path="/food-pricing" element={<FoodPricingApp />} />
        <Route path="/competitive" element={<CompetitiveApp />} />
        <Route path="/time-off" element={<ComingSoon title="Time Off Tracker" desc="Monitor teacher vacation, sick, and personal hours via iSolved." icon="Clock" />} />
        <Route path="/financials" element={<ComingSoon title="Financial Performance" desc="Financial dashboards powered by Intuit Enterprise Suite." icon="DollarSign" />} />
        <Route path="/staffing" element={<ComingSoon title="Staffing Schedule" desc="Manage and view your center's staffing schedule." icon="Users" />} />
        <Route path="/directory" element={<ComingSoon title="Employee Directory" desc="All staff in one place." icon="UserSquare2" />} />
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
