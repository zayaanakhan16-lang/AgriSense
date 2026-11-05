import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingScreen } from '@/components/common/LoadingScreen';

const EarthExplorerPage = lazy(() => import('@/features/earth/EarthExplorerPage'));
const MyFieldsPage = lazy(() => import('@/features/fields/MyFieldsPage'));
const FieldIntelligencePage = lazy(() => import('@/features/intelligence/FieldIntelligencePage'));
const VegetationPage = lazy(() => import('@/features/vegetation/VegetationPage'));
const SoilPage = lazy(() => import('@/features/soil/SoilPage'));
const ClimatePage = lazy(() => import('@/features/climate/ClimatePage'));
const CropPlanningPage = lazy(() => import('@/features/crops/CropPlanningPage'));
const CropStudioPage = lazy(() => import('@/features/studio/CropStudioPage'));
const SeasonalCalendarPage = lazy(() => import('@/features/calendar/SeasonalCalendarPage'));
const DecisionCenterPage = lazy(() => import('@/features/decision/DecisionCenterPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={220}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<EarthExplorerPage />} />
              <Route path="fields" element={<MyFieldsPage />} />
              <Route path="intelligence" element={<FieldIntelligencePage />} />
              <Route path="vegetation" element={<VegetationPage />} />
              <Route path="soil" element={<SoilPage />} />
              <Route path="climate" element={<ClimatePage />} />
              <Route path="crops" element={<CropPlanningPage />} />
              <Route path="studio" element={<CropStudioPage />} />
              <Route path="calendar" element={<SeasonalCalendarPage />} />
              <Route path="decision" element={<DecisionCenterPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
