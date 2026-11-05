import { Suspense, lazy } from 'react';
import { SkeletonPanel } from '@/components/layout/PageScaffold';

const CropProfiles = lazy(() =>
  import('@/features/crop-profiles/CropProfilesPage').then((module) => ({ default: module.CropProfiles })),
);
const CropSuitability = lazy(() =>
  import('@/features/crops/CropPlanningPage').then((module) => ({ default: module.CropSuitability })),
);
const CropPlan = lazy(() =>
  import('@/features/crop-plan/CropPlanPage').then((module) => ({ default: module.CropPlan })),
);

/**
 * The crop workspace.
 *
 * Profiles, rules-engine suitability and the rotation plan were three separate
 * top-level tabs, but they describe the same crop decision. They now stack on one
 * continuously scrolling page, matching how the Overview section reads.
 */
export default function CropsSection(): JSX.Element {
  return (
    <div className="space-y-4">
      <Suspense fallback={<SectionSkeleton />}>
        <CropProfiles embedded />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <CropSuitability embedded />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <CropPlan embedded />
      </Suspense>
    </div>
  );
}

function SectionSkeleton(): JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <SkeletonPanel rows={5} />
    </div>
  );
}
