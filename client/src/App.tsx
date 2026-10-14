import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import AppIndex from './pages/AppIndex'
import Dashboard from './pages/Dashboard'
import NewGroup from './pages/NewGroup'
import NotFound from './pages/NotFound'
import SignIn from './pages/SignIn'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      <Route path="/signin" element={<SignIn />} />

      {/* Organizer, signed in. There is no payer page: people just transfer to the group's account number. */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<AppIndex />} />
        <Route path="groups/new" element={<NewGroup />} />
        <Route path="groups/:id" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
