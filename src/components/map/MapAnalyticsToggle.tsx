import { BarChart3, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkspaceMode = 'map' | 'analytics';

/**
 * Map / Analytics segmented control shown at the top centre of the workspace.
 * Switching keeps the same application shell and the same Region List.
 */
export function MapAnalyticsToggle({
  mode,
  onChange,
  className,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  className?: string;
}): JSX.Element {
  const options: Array<{ id: WorkspaceMode; label: string; icon: typeof Globe2 }> = [
    { id: 'map', label: 'Map', icon: Globe2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div
      role="tablist"
      aria-label="Workspace mode"
      className={cn(
        'chrome inline-flex items-center gap-0.5 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-cream text-forest-900 shadow-panel' : 'text-cream/65 hover:text-cream',
            )}
          >
            <option.icon className="size-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
