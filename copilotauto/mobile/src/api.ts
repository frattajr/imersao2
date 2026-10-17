import { accessToken } from './supabase';
import type { AnalysisResult, Inspection, Report, Vehicle } from './types';

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createInspection: (vehicle: Vehicle, termsVersion: string, acceptedAt: Date) =>
    call<Inspection>('/v1/inspections', {
      method: 'POST',
      body: JSON.stringify({
        vehicle,
        terms_version: termsVersion,
        terms_accepted_at: acceptedAt.toISOString(),
      }),
    }),

  analyze: (
    inspectionId: string,
    body: {
      component_id: string;
      position?: string;
      image_base64?: string;
      ocr_text?: string;
      client_blur_score?: number;
      client_brightness?: number;
    },
  ) =>
    call<AnalysisResult>(`/v1/inspections/${inspectionId}/analyses`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  report: (inspectionId: string) => call<Report>(`/v1/inspections/${inspectionId}/report`),
};
