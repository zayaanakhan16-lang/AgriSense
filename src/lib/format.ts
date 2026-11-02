import type { LngLat } from '@/types';

const M2_PER_ACRE = 4046.8564224;

export function formatArea(m2: number): string {
  if (!Number.isFinite(m2) || m2 <= 0) return '—';
  const ha = m2 / 10000;
  if (ha >= 100) return `${ha.toFixed(0)} ha`;
  if (ha >= 1) return `${ha.toFixed(2)} ha`;
  return `${m2.toFixed(0)} m²`;
}

export function areaInHectares(m2: number): number {
  return m2 / 10000;
}

export function areaInAcres(m2: number): number {
  return m2 / M2_PER_ACRE;
}

export function formatAcres(m2: number): string {
  const acres = areaInAcres(m2);
  if (!Number.isFinite(acres) || acres <= 0) return '—';
  return `${acres.toFixed(acres >= 100 ? 0 : 2)} ac`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatCoord(coord: LngLat, digits = 5): string {
  const lat = `${Math.abs(coord.lat).toFixed(digits)}° ${coord.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(coord.lng).toFixed(digits)}° ${coord.lng >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

export function toDMS(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}°${String(min).padStart(2, '0')}'${sec.padStart(4, '0')}"${dir}`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'just now';
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function percent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSigned(value: number, digits = 1, unit = ''): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

export function monthLabel(month: number): string {
  return new Date(2000, month, 1).toLocaleString('en-GB', { month: 'short' });
}
