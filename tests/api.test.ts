import { describe, expect, it, vi } from 'vitest';
import { NetworkError, TimeoutError, call, createApi, httpTransport, type Transport } from '../src/api';
import { createMockBackend, sampleVotes } from '../src/mock';

const vote = {
  nombre: 'Ana',
  correo: 'ana@esen.edu.sv',
  carrera: 'ISND',
  fondo: 'negro',
  logo: 'siglas',
  tipografia: 'archivo',
  comentario: '',
  website: '',
};

describe('httpTransport', () => {
  it('manda POST text/plain con el body JSON (sin preflight CORS)', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, open: true, version: 'v1' })));
    const t = httpTransport({ url: 'https://example.test/exec', fetchImpl: fetchImpl as unknown as typeof fetch });
    await t({ action: 'status' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/exec');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(init.body).toBe('{"action":"status"}');
    expect(init.redirect).toBe('follow');
  });

  it('convierte una respuesta no JSON en respuesta_invalida', async () => {
    const fetchImpl = async () => new Response('<html>login</html>');
    const t = httpTransport({ url: 'x', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await t({ action: 'status' })).toEqual({ ok: false, error: 'respuesta_invalida' });
  });

  it('aborta a los timeoutMs con TimeoutError', async () => {
    const fetchImpl = (_: unknown, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
    const t = httpTransport({ url: 'x', fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 });
    await expect(t({ action: 'status' })).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('call', () => {
  it('reintenta una sola vez ante falla de red', async () => {
    const t = vi.fn<Transport>().mockRejectedValueOnce(new NetworkError('x')).mockResolvedValueOnce({ ok: true, open: true });
    const r = await call(t, { action: 'status' });
    expect(r.ok).toBe(true);
    expect(t).toHaveBeenCalledTimes(2);
  });

  it('no reintenta más de una vez', async () => {
    const t = vi.fn<Transport>().mockRejectedValue(new NetworkError('x'));
    expect(await call(t, { action: 'status' })).toEqual({ ok: false, error: 'red' });
    expect(t).toHaveBeenCalledTimes(2);
  });

  it('nunca reintenta errores de negocio', async () => {
    const t = vi.fn<Transport>().mockResolvedValue({ ok: false, error: 'correo_no_en_padron' });
    expect(await call(t, { action: 'vote', data: vote })).toEqual({ ok: false, error: 'correo_no_en_padron' });
    expect(t).toHaveBeenCalledTimes(1);
  });

  it('no reintenta tras un timeout', async () => {
    const t = vi.fn<Transport>().mockRejectedValue(new TimeoutError('t'));
    expect(await call(t, { action: 'status' })).toEqual({ ok: false, error: 'timeout' });
    expect(t).toHaveBeenCalledTimes(1);
  });

  it('rechaza respuestas sin ok booleano', async () => {
    const t = vi.fn<Transport>().mockResolvedValue({ foo: 1 });
    expect(await call(t, { action: 'status' })).toEqual({ ok: false, error: 'respuesta_invalida' });
  });
});

describe('api.vote', () => {
  it('un throttle tras reintento de red cuenta como voto registrado', async () => {
    const t = vi
      .fn<Transport>()
      .mockRejectedValueOnce(new NetworkError('x'))
      .mockResolvedValueOnce({ ok: false, error: 'espera_unos_segundos' });
    expect(await createApi(t).vote(vote)).toEqual({ ok: true, updated: false });
  });

  it('un throttle sin reintento es un error normal', async () => {
    const t = vi.fn<Transport>().mockResolvedValue({ ok: false, error: 'espera_unos_segundos' });
    expect(await createApi(t).vote(vote)).toEqual({ ok: false, error: 'espera_unos_segundos' });
  });
});

describe('mock', () => {
  it('registra y luego actualiza el voto del mismo correo', async () => {
    vi.useFakeTimers();
    const api = createApi(createMockBackend({ latencyMs: 0 }), true);
    const first = api.vote(vote);
    await vi.runAllTimersAsync();
    expect(await first).toEqual({ ok: true, updated: false });
    vi.setSystemTime(Date.now() + 11_000);
    const second = api.vote({ ...vote, correo: 'ANA@esen.edu.sv' });
    await vi.runAllTimersAsync();
    expect(await second).toEqual({ ok: true, updated: true });
    vi.useRealTimers();
  });

  it('valida como el servidor y respeta votación cerrada', async () => {
    const api = createApi(createMockBackend({ latencyMs: 0 }), true);
    expect(await api.vote({ ...vote, correo: 'ana@gmail.com' })).toEqual({ ok: false, error: 'correo_no_institucional' });
    const closed = createApi(createMockBackend({ latencyMs: 0, open: false }), true);
    expect(await closed.status()).toMatchObject({ ok: true, open: false });
    expect(await closed.vote(vote)).toEqual({ ok: false, error: 'votacion_cerrada' });
  });

  it('results pide un token y devuelve datos deterministas', async () => {
    const api = createApi(createMockBackend({ latencyMs: 0 }), true);
    expect(await api.results('')).toEqual({ ok: false, error: 'no_autorizado' });
    const r = await api.results('token-de-prueba');
    expect(r.ok).toBe(true);
    expect(sampleVotes()).toEqual(sampleVotes());
  });
});
