/**
 * Carga mínima de Google Identity Services ("Acceder con Google").
 * Documentación: https://developers.google.com/identity/gsi/web/reference/js-reference
 */

interface CredentialResponse {
  credential: string;
}

interface GsiButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

interface GoogleId {
  initialize(cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    auto_select?: boolean;
    ux_mode?: 'popup' | 'redirect';
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, opts: GsiButtonOptions): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleId> | null = null;

/** Carga el script una sola vez. Rechaza si no carga en 15 s (sin red, bloqueador, etc.). */
export function loadGis(timeoutMs = 15_000): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    const fail = () => {
      clearTimeout(timer);
      s.remove();
      loading = null; // permite reintentar
      reject(new Error('gis'));
    };
    const timer = setTimeout(fail, timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else fail();
    };
    s.onerror = fail;
    document.head.append(s);
  });
  return loading;
}

/** Para "Salir": que Google no vuelva a entrar solo con la misma cuenta. */
export function gisSignOut(): void {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* sin GIS: nada que hacer */
  }
}
