import { api } from './api';

export type GeocodingResult = {
  place_id?: number | string;
  lat?: string | number;
  lon?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  lng?: string | number;
  x?: string | number;
  y?: string | number;
  display_name?: string;
  name?: string;
  address?: Record<string, unknown>;
};

type GeocodingSearchResponse =
  | GeocodingResult[]
  | { data?: GeocodingResult[]; results?: GeocodingResult[] };

function unwrapResults(raw: GeocodingSearchResponse): GeocodingResult[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

export const geocodingService = {
  async search(query: string): Promise<GeocodingResult[]> {
    const raw = await api.get<GeocodingSearchResponse>(
      `/geocoding/search?query=${encodeURIComponent(query)}`,
      { skipAuth: true }
    );

    return unwrapResults(raw);
  },

  async reverse(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    const raw = await api.get<GeocodingResult | { result?: GeocodingResult; data?: GeocodingResult }>(
      `/geocoding/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
      { skipAuth: true }
    );

    if (!raw) return null;
    if ('result' in raw && raw.result) return raw.result;
    if ('data' in raw && raw.data) return raw.data;
    return raw as GeocodingResult;
  },
};
