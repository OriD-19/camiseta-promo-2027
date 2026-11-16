import type { CareerId } from './config';
import type { VoteData } from './validate';
import { createMockBackend } from './mock';

export interface VoteRow {
  carrera: string;
  fondo: string;
  logo: string;
  tipografia: string;
  version: string;
}

export interface Comentario {
  carrera: string;
  texto: string;
}

export type Inscritos = Record<CareerId, number>;

export interface ResultsData {
  version: string;
  open: boolean;
  votes: VoteRow[];
  inscritos: Inscritos;
  comentarios: Comentario[];
}

export type Fail = { ok: false; error: string };
export type ApiResult<T> = ({ ok: true } & T) | Fail;

export type Payload =
  | { action: 'status' }
  | { action: 'vote'; data: VoteData }
  | { action: 'results'; key: string };

export type Transport = (payload: Payload) => Promise<unknown>;

export const TIMEOUT_MS = 15_000;

/** Error de red: no llegó respuesta (sin conexión, DNS, CORS, etc.). Es el único que se reintenta. */
export class NetworkError extends Error {}
/** Se agotaron los 15 s. No se reintenta: el servidor pudo haber procesado el envío. */
export class TimeoutError extends Error {}

export interface HttpOptions {
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Transporte real: POST con text/plain (NO application/json, para evitar el preflight CORS). */
export function httpTransport({ url, fetchImpl = fetch, timeoutMs = TIMEOUT_MS }: HttpOptions): Transport {
  return async (payload) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: ctrl.signal,
      });
    } catch (err) {
      if (ctrl.signal.aborted) throw new TimeoutError('timeout');
      throw new NetworkError(err instanceof Error ? err.message : 'network');
    } finally {
      clearTimeout(timer);
    }
    try {
      return await res.json();
    } catch {
      // P. ej. una página HTML de login porque el despliegue no está en "Cualquier usuario".
      return { ok: false, error: 'respuesta_invalida' };
    }
  };
}

/** Llama al transporte con un solo reintento ante fallas de red. Nunca reintenta errores de negocio. */
export async function call<T>(transport: Transport, payload: Payload): Promise<ApiResult<T> & { retried?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await transport(payload);
      if (!data || typeof data !== 'object' || typeof (data as { ok?: unknown }).ok !== 'boolean') {
        return { ok: false, error: 'respuesta_invalida' };
      }
      const out = data as ApiResult<T>;
      return attempt > 0 ? { ...out, retried: true } : out;
    } catch (err) {
      if (err instanceof NetworkError && attempt === 0) continue;
      if (err instanceof TimeoutError) return { ok: false, error: 'timeout' };
      return { ok: false, error: 'red' };
    }
  }
  return { ok: false, error: 'red' };
}

export interface Api {
  readonly isMock: boolean;
  status(): Promise<ApiResult<{ open: boolean; version: string }>>;
  vote(data: VoteData): Promise<ApiResult<{ updated: boolean }>>;
  results(key: string): Promise<ApiResult<ResultsData>>;
}

export function createApi(transport: Transport, isMock = false): Api {
  return {
    isMock,
    status: () => call(transport, { action: 'status' }),
    async vote(data) {
      const r = await call<{ updated: boolean }>(transport, { action: 'vote', data });
      // Si el primer intento sí llegó al servidor pero se perdió la respuesta, el reintento
      // choca con el throttle de 10 s: ese voto ya quedó registrado.
      if (!r.ok && r.error === 'espera_unos_segundos' && r.retried) return { ok: true, updated: false };
      return r;
    },
    results: (key) => call(transport, { action: 'results', key }),
  };
}

const URL_ = (import.meta.env?.VITE_APPS_SCRIPT_URL ?? '').trim();

/** Cliente por defecto: usa la URL de .env o, si está vacía, el mock determinista. */
export const api: Api = URL_ ? createApi(httpTransport({ url: URL_ })) : createApi(createMockBackend(), true);
