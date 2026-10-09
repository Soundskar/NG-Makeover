import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/auth';
import { devMode, devPaused, devRole, devSignIn } from './auth/devMode';
import { BootErrorPage, InactivePage, LoginPage, NotConfiguredPage } from './auth/LoginPage';
import { BottomNav } from './components/BottomNav';
import { DevBar } from './components/DevBar';
import { Splash } from './components/ErrorBoundary';
import { OfflineBanner, PullToRefresh, Skeleton } from './components/ui';
import { configured } from './lib/supabase';
import type { Profile } from './lib/types';

// Each area loads on first visit so the app opens fast on older phones.
const HomePage = lazy(() => import('./features/dashboard/HomePage'));
const LogVisitPage = lazy(() => import('./features/salon/LogVisitPage'));
const MyDayPage = lazy(() => import('./features/salon/MyDayPage'));
const SalonDayPage = lazy(() => import('./features/salon/SalonDayPage'));
const CloseDayPage = lazy(() => import('./features/salon/CloseDayPage'));
const UdhaarPage = lazy(() => import('./features/salon/UdhaarPage'));
const StaffWorkPage = lazy(() => import('./features/salon/StaffWorkPage'));
const CallbackPage = lazy(() => import('./features/salon/CallbackPage'));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage'));
const BookingsPage = lazy(() => import('./features/bookings/BookingsPage'));
const BookingFormPage = lazy(() => import('./features/bookings/BookingFormPage'));
const ClientsPage = lazy(() => import('./features/clients/ClientsPage'));
const ClientPage = lazy(() => import('./features/clients/ClientPage'));
const StudioPage = lazy(() => import('./features/settings/StudioPage'));
const StudentsPage = lazy(() => import('./features/students/StudentsPage'));
const StudentPage = lazy(() => import('./features/students/StudentPage'));
const AdmissionPage = lazy(() => import('./features/students/AdmissionPage'));
const FollowUpPage = lazy(() => import('./features/students/FollowUpPage'));
const ClassesPage = lazy(() => import('./features/classes/ClassesPage'));
const MorePage = lazy(() => import('./features/settings/MorePage'));
const AccountPage = lazy(() => import('./features/settings/AccountPage'));
const CatalogPage = lazy(() => import('./features/settings/CatalogPage'));
const CoursesPage = lazy(() => import('./features/settings/CoursesPage'));
const TeamPage = lazy(() => import('./features/settings/TeamPage'));
const SlotsPage = lazy(() => import('./features/settings/SlotsPage'));
const BackupPage = lazy(() => import('./features/settings/BackupPage'));
const HistoryPage = lazy(() => import('./features/settings/HistoryPage'));

function Shell() {
  return (
    <div className="shell">
      {devMode && !devPaused() && <DevBar />}
      <OfflineBanner />
      <PullToRefresh />
      <Suspense fallback={<div className="page"><Skeleton variant="cards" rows={3} /></div>}>
        <Outlet />
      </Suspense>
      <BottomNav />
    </div>
  );
}

function homeFor(p: Profile): string {
  if (p.is_owner) return '/';
  if (p.is_staff) return '/salon/new';
  if (p.is_trainer) return '/classes';
  return '/account';
}

export function App() {
  const { status, profile } = useAuth();

  // Test mode: no login screen, sign straight in as the last-used test account.
  useEffect(() => {
    if (devMode && !devPaused() && status === 'signed_out') void devSignIn(devRole());
  }, [status]);

  if (!configured) return <NotConfiguredPage />;
  if (status === 'loading') return <Splash />;
  if (status === 'error') return <BootErrorPage />;
  if (status === 'signed_out') return devMode && !devPaused() ? <Splash /> : <LoginPage />;
  if (status === 'inactive' || !profile) return <InactivePage />;

  const owner = profile.is_owner;
  const staff = owner || profile.is_staff;
  const trainer = owner || profile.is_trainer;
  const home = homeFor(profile);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={owner ? <HomePage /> : <Navigate to={home} replace />} />
        <Route path="account" element={<AccountPage />} />

        {staff && <Route path="salon/new" element={<LogVisitPage />} />}
        {staff && <Route path="my-day" element={<MyDayPage />} />}
        {owner && <Route path="salon" element={<SalonDayPage />} />}
        {owner && <Route path="salon/close" element={<CloseDayPage />} />}
        {owner && <Route path="salon/udhaar" element={<UdhaarPage />} />}
        {owner && <Route path="salon/work" element={<StaffWorkPage />} />}
        {owner && <Route path="salon/callback" element={<CallbackPage />} />}
        {staff && <Route path="bookings" element={<BookingsPage />} />}
        {staff && <Route path="bookings/new" element={<BookingFormPage />} />}
        {owner && <Route path="clients" element={<ClientsPage />} />}
        {owner && <Route path="clients/:phone" element={<ClientPage />} />}
        {owner && <Route path="more/studio" element={<StudioPage />} />}
        {owner && <Route path="reports" element={<ReportsPage />} />}

        {trainer && <Route path="classes" element={<ClassesPage />} />}
        {trainer && <Route path="students" element={<StudentsPage />} />}
        {trainer && <Route path="students/:id" element={<StudentPage />} />}
        {owner && <Route path="students/new" element={<AdmissionPage />} />}
        {owner && <Route path="fees" element={<FollowUpPage />} />}

        {owner && <Route path="more" element={<MorePage />} />}
        {owner && <Route path="more/catalog" element={<CatalogPage />} />}
        {owner && <Route path="more/courses" element={<CoursesPage />} />}
        {owner && <Route path="more/team" element={<TeamPage />} />}
        {owner && <Route path="more/slots" element={<SlotsPage />} />}
        {owner && <Route path="more/backup" element={<BackupPage />} />}
        {owner && <Route path="more/history" element={<HistoryPage />} />}

        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
