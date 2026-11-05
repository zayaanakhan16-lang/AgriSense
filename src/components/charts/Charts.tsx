import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

const AXIS = {
  stroke: 'rgba(247,247,239,0.35)',
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const;

const GRID_STROKE = 'rgba(247,247,239,0.08)';

interface TooltipPayloadItem {
  name?: string;
  value?: number | string | null;
  color?: string;
  unit?: string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number, name: string) => string;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-forest-950/95 px-3 py-2 text-2xs shadow-float backdrop-blur">
      {label !== undefined ? (
        <p className="mb-1 font-medium text-cream/90">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((item, index) => {
          const numeric = typeof item.value === 'number' ? item.value : Number(item.value);
          if (!Number.isFinite(numeric)) return null;
          return (
            <li key={index} className="flex items-center gap-2">
              <span className="size-2 rounded-sm" style={{ background: item.color }} aria-hidden />
              <span className="text-cream/65">{item.name}</span>
              <span className="ml-auto font-mono tabular-nums text-cream">
                {valueFormatter ? valueFormatter(numeric, item.name ?? '') : numeric.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface SeriesSpec {
  key: string;
  name: string;
  color: string;
  unit?: string;
}

/* ---------------------------------------------------------------- time series */

export function TimeSeriesChart({
  data,
  series,
  xKey = 'date',
  height = 200,
  formatX,
  formatValue,
  area = false,
  referenceY,
  referenceLabel,
  className,
}: {
  data: Array<Record<string, unknown>>;
  series: SeriesSpec[];
  xKey?: string;
  height?: number;
  formatX?: (value: string) => string;
  formatValue?: (value: number, name: string) => string;
  area?: boolean;
  referenceY?: number;
  referenceLabel?: string;
  className?: string;
}): JSX.Element {
  const tickFormatter = useMemo(
    () =>
      formatX ??
      ((value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
          ? value
          : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      }),
    [formatX],
  );

  const valueFormatter = formatValue ?? ((value: number) => value.toFixed(1));

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <defs>
              {series.map((spec) => (
                <linearGradient key={spec.key} id={`grad-${spec.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={spec.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={spec.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={xKey} {...AXIS} tickFormatter={tickFormatter} minTickGap={28} />
            <YAxis {...AXIS} width={46} tickFormatter={(v: number) => v.toFixed(0)} />
            <RechartsTooltip
              content={<ChartTooltip labelFormatter={(l) => tickFormatter(String(l))} valueFormatter={valueFormatter} />}
            />
            {referenceY !== undefined ? (
              <ReferenceLine
                y={referenceY}
                stroke="rgba(168,230,0,0.45)"
                strokeDasharray="4 4"
                label={{ value: referenceLabel, position: 'insideTopRight', fill: 'rgba(215,255,84,0.8)', fontSize: 10 }}
              />
            ) : null}
            {series.map((spec) => (
              <Area
                key={spec.key}
                type="monotone"
                dataKey={spec.key}
                name={spec.name}
                stroke={spec.color}
                strokeWidth={1.8}
                fill={`url(#grad-${spec.key})`}
                connectNulls
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={xKey} {...AXIS} tickFormatter={tickFormatter} minTickGap={28} />
            <YAxis {...AXIS} width={46} tickFormatter={(v: number) => v.toFixed(0)} />
            <RechartsTooltip
              content={<ChartTooltip labelFormatter={(l) => tickFormatter(String(l))} valueFormatter={valueFormatter} />}
            />
            {referenceY !== undefined ? (
              <ReferenceLine y={referenceY} stroke="rgba(168,230,0,0.45)" strokeDasharray="4 4" />
            ) : null}
            {series.map((spec) => (
              <Line
                key={spec.key}
                type="monotone"
                dataKey={spec.key}
                name={spec.name}
                stroke={spec.color}
                strokeWidth={1.8}
                connectNulls
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------- bars */

export function BarSeriesChart({
  data,
  xKey,
  series,
  height = 190,
  formatValue,
  stacked = false,
  className,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: SeriesSpec[];
  height?: number;
  formatValue?: (value: number, name: string) => string;
  stacked?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis {...AXIS} width={46} tickFormatter={(v: number) => v.toFixed(0)} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(247,247,239,0.05)' }}
            content={<ChartTooltip valueFormatter={formatValue ?? ((v) => v.toFixed(1))} />}
          />
          {series.map((spec) => (
            <Bar
              key={spec.key}
              dataKey={spec.key}
              name={spec.name}
              stackId={stacked ? 'a' : undefined}
              fill={spec.color}
              radius={stacked ? 0 : [3, 3, 0, 0]}
              maxBarSize={38}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ radar */

export function FactorRadar({
  data,
  height = 220,
  className,
}: {
  data: Array<{ factor: string; score: number }>;
  height?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID_STROKE} />
          <PolarAngleAxis dataKey="factor" tick={{ fill: 'rgba(247,247,239,0.6)', fontSize: 10 }} />
          <Radar dataKey="score" stroke="#9edb02" fill="#9edb02" fillOpacity={0.28} strokeWidth={1.8} />
          <RechartsTooltip content={<ChartTooltip valueFormatter={(v) => `${Math.round(v * 100)}%`} />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------- donut */

export function AllocationDonut({
  data,
  height = 200,
  className,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="84%"
            paddingAngle={2}
            stroke="rgba(0,31,25,0.9)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip content={<ChartTooltip valueFormatter={(v) => `${(v * 100).toFixed(1)}%`} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------ sparkline */

export function Sparkline({
  values,
  color = '#9edb02',
  height = 34,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}): JSX.Element {
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { ChartTooltip };
