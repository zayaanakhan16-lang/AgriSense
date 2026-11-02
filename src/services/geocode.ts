import type { LngLat, SearchResult } from '@/types';
import { fetchJson } from '@/services/http';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  boundingbox?: [string, string, string, string];
  address?: Record<string, string>;
}

/** Sample farm locations referenced by the AgriSense walkthrough — clearly labelled as examples. */
export const SAMPLE_LOCATIONS: SearchResult[] = [
  {
    id: 'sample-lahore',
    name: '9.1-acre wheat farm (sample walkthrough)',
    subtitle: 'Sample demonstration field · Lahore, Punjab, Pakistan',
    center: { lng: 74.3587, lat: 31.5204 },
    bbox: [74.3237, 31.4754, 74.3937, 31.5654],
    kind: 'sample',
    zoom: 15,
  },
  {
    id: 'sample-indus',
    name: 'Indus basin cotton block (sample)',
    subtitle: 'Sample demonstration field · Multan, Punjab, Pakistan',
    center: { lng: 71.5249, lat: 30.1575 },
    kind: 'sample',
    zoom: 14,
  },
  {
    id: 'sample-po-valley',
    name: 'Po Valley maize block (sample)',
    subtitle: 'Sample demonstration field · Emilia-Romagna, Italy',
    center: { lng: 10.9, lat: 45.05 },
    kind: 'sample',
    zoom: 14,
  },
  {
    id: 'sample-iowa',
    name: 'Iowa soybean field (sample)',
    subtitle: 'Sample demonstration field · Iowa, United States',
    center: { lng: -93.62, lat: 42.03 },
    kind: 'sample',
    zoom: 14,
  },
  {
    id: 'sample-nile',
    name: 'Nile delta irrigated block (sample)',
    subtitle: 'Sample demonstration field · Kafr El Sheikh, Egypt',
    center: { lng: 30.94, lat: 31.11 },
    kind: 'sample',
    zoom: 14,
  },
];

export function bboxFromNominatim(place: NominatimPlace): [number, number, number, number] | undefined {
  if (!place.boundingbox) return undefined;
  const [south, north, west, east] = place.boundingbox.map(Number);
  return [west, south, east, north];
}

/**
 * Forward geocoding through the OpenStreetMap Nominatim API.
 * Sends an identifying Referer/User-Agent per the Nominatim usage policy.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    limit: '6',
    addressdetails: '1',
  });
  const results = await fetchJson<NominatimPlace[]>(`${NOMINATIM}/search?${params.toString()}`, {
    timeoutMs: 15000,
    signal,
    headers: { Accept: 'application/json' },
  });

  return results.map((place) => {
    const center: LngLat = { lng: Number(place.lon), lat: Number(place.lat) };
    const country = place.address?.country ?? '';
    const region = place.address?.state ?? place.address?.county ?? '';
    return {
      id: `osm-${place.place_id}`,
      name: place.display_name.split(',').slice(0, 2).join(',').trim(),
      subtitle: [region, country].filter(Boolean).join(' · ') || place.display_name,
      center,
      bbox: bboxFromNominatim(place),
      kind: 'place' as const,
    };
  });
}

export async function reverseGeocode(coord: LngLat, signal?: AbortSignal): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: coord.lat.toFixed(5),
      lon: coord.lng.toFixed(5),
      format: 'jsonv2',
      zoom: '12',
    });
    const place = await fetchJson<NominatimPlace>(`${NOMINATIM}/reverse?${params.toString()}`, {
      timeoutMs: 12000,
      signal,
    });
    const address = place.address ?? {};
    const parts = [
      address.village ?? address.town ?? address.city ?? address.county,
      address.state,
      address.country,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : place.display_name?.split(',').slice(0, 3).join(',').trim() ?? null;
  } catch {
    return null;
  }
}
