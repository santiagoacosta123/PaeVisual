import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

/* ==========================================================
   ESTILOS Y ANIMACIONES (se inyectan solos en el <head>)
   ========================================================== */
const ALERT_STYLES = `
/* Asegurar que las alertas siempre se posicionen sobre cualquier modal o pantalla */
.swal2-container {
  z-index: 99999 !important;
}

/* Variables de acento */
.bd-alert, .bd-toast { --bd-accent: #fab41f; --bd-shadow: 120, 53, 15; }
.bd-alert--supervisor { --bd-accent: #d97706; }
.bd-alert--danger { --bd-accent: #dc2626; --bd-shadow: 127, 29, 29; }

/* Popup */
.swal2-popup.bd-alert {
  position: relative;
  overflow: hidden;
  width: min(92vw, 28rem);
  padding: 2rem 1.5rem 1.5rem;
  border-radius: 20px;
  box-shadow:
    0 28px 60px -14px rgba(var(--bd-shadow), 0.38),
    0 0 0 1px color-mix(in srgb, var(--bd-accent) 18%, transparent);
}
.swal2-popup.bd-alert::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 5px;
  background: var(--bd-accent);
  transform-origin: left;
  animation: bd-bar-grow 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}
.swal2-popup.bd-alert .swal2-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  animation: bd-text-in 0.4s ease-out 0.18s both;
}
.swal2-popup.bd-alert .swal2-html-container {
  font-size: 0.975rem;
  line-height: 1.5;
  opacity: 0.85;
  animation: bd-text-in 0.4s ease-out 0.26s both;
}
.swal2-popup.bd-alert .swal2-actions {
  gap: 0.6rem;
  margin-top: 1.5rem;
  animation: bd-text-in 0.4s ease-out 0.34s both;
}
.swal2-popup.bd-alert .swal2-timer-progress-bar {
  background: var(--bd-accent);
  opacity: 0.55;
}

/* Iconos: entrada con resorte + gesto propio */
.bd-alert .swal2-icon { margin-top: 0.5rem; }
.bd-alert .swal2-icon.swal2-warning .swal2-icon-content {
  animation:
    bd-icon-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    bd-wiggle 1.2s ease-in-out 0.9s 2;
}
.bd-alert .swal2-icon.swal2-question .swal2-icon-content {
  animation:
    bd-icon-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    bd-hop 1.1s ease-in-out 0.9s 2;
}
.bd-alert .swal2-icon.swal2-info .swal2-icon-content {
  animation:
    bd-icon-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    bd-pulse 1.4s ease-in-out 0.9s 2;
}
.bd-alert .swal2-icon.swal2-icon-show.swal2-success,
.bd-alert .swal2-icon.swal2-icon-show.swal2-warning,
.bd-alert .swal2-icon.swal2-icon-show.swal2-info,
.bd-alert .swal2-icon.swal2-icon-show.swal2-question {
  animation: bd-halo 1.1s ease-out 0.25s 1;
}

/* Botones */
.swal2-styled.bd-btn {
  position: relative;
  overflow: hidden;
  min-width: 7.5rem;
  padding: 0.7rem 1.4rem;
  border-radius: 12px;
  font-weight: 600;
  transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
}
.swal2-styled.bd-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -8px rgba(var(--bd-shadow), 0.55);
}
.swal2-styled.bd-btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}
.swal2-styled.bd-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--bd-accent) 45%, transparent);
  outline-offset: 2px;
  box-shadow: none;
}
.swal2-styled.bd-sweet-confirm::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.35) 50%, transparent 70%);
  transform: translateX(-120%);
}
.swal2-styled.bd-sweet-confirm:hover::after {
  transform: translateX(120%);
  transition: transform 0.6s ease;
}

/* Loading */
.bd-alert--loading .swal2-loader {
  border-color: var(--bd-accent) transparent var(--bd-accent) transparent;
}

/* Toast */
.swal2-popup.bd-toast {
  padding: 0.75rem 1rem;
  border-radius: 14px;
  border-left: 5px solid var(--bd-accent);
  box-shadow:
    0 16px 32px -10px rgba(var(--bd-shadow), 0.4),
    0 0 0 1px color-mix(in srgb, var(--bd-accent) 20%, transparent);
}
.swal2-popup.bd-toast .swal2-title {
  font-size: 0.95rem;
  font-weight: 600;
}
.swal2-popup.bd-toast .swal2-timer-progress-bar {
  background: var(--bd-accent);
  opacity: 0.6;
}

/* Entradas / salidas */
.bd-pop-in { animation: bd-pop-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
.bd-pop-out { animation: bd-pop-out 0.2s ease-in both; }
.bd-pop-shake { animation: bd-pop-shake 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.bd-backdrop-in { animation: bd-fade-in 0.25s ease-out both; }
.bd-backdrop-out { animation: bd-fade-out 0.2s ease-in both; }
.bd-toast-in { animation: bd-toast-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.bd-toast-out { animation: bd-toast-out 0.25s ease-in both; }

/* Keyframes */
@keyframes bd-pop-in {
  0% { opacity: 0; transform: translateY(28px) scale(0.78); }
  60% { opacity: 1; transform: translateY(-4px) scale(1.03); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bd-pop-out {
  to { opacity: 0; transform: translateY(10px) scale(0.92); }
}
@keyframes bd-pop-shake {
  0% { opacity: 0; transform: translateY(20px) scale(0.8); }
  35% { opacity: 1; transform: translateY(0) scale(1.03); }
  45% { transform: translateX(-9px); }
  55% { transform: translateX(8px); }
  65% { transform: translateX(-5px); }
  75% { transform: translateX(4px); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes bd-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bd-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes bd-toast-in {
  0% { opacity: 0; transform: translateX(120%) scale(0.95); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes bd-toast-out {
  to { opacity: 0; transform: translateX(120%); }
}
@keyframes bd-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes bd-text-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bd-icon-pop {
  0% { opacity: 0; transform: scale(0) rotate(-25deg); }
  60% { opacity: 1; transform: scale(1.25) rotate(8deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes bd-wiggle {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-14deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(5deg); }
}
@keyframes bd-hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-9px); }
  60% { transform: translateY(0); }
  75% { transform: translateY(-4px); }
}
@keyframes bd-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
@keyframes bd-halo {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--bd-accent) 45%, transparent); }
  100% { box-shadow: 0 0 0 26px transparent; }
}

/* Accesibilidad: respeta "reducir movimiento" del sistema */
@media (prefers-reduced-motion: reduce) {
  .bd-alert, .bd-alert *, .bd-alert::before, .bd-toast, .bd-toast * {
    animation-duration: 0.01ms !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/* ==========================================================
   TEMAS
   ========================================================== */
interface Theme {
  variant: 'supervisor' | 'danger' | 'default';
  background: string;
  color: string;
  confirm: string;
  cancel: string;
}

const SUPERVISOR: Theme = {
  variant: 'supervisor',
  background: '#FFFBEB',
  color: '#78350F',
  confirm: '#D97706',
  cancel: '#64748B'
};

const SUPERVISOR_DANGER: Theme = {
  variant: 'danger',
  background: '#FFF7F7',
  color: '#7F1D1D',
  confirm: '#DC2626',
  cancel: '#64748B'
};

const DEFAULT: Theme = {
  variant: 'default',
  background: '#FFFFFF',
  color: '#1F2937',
  confirm: '#FAB41F',
  cancel: '#E53935'
};

const DEFAULT_DANGER: Theme = { ...DEFAULT, variant: 'danger', confirm: '#EF4444' };
const DEFAULT_WARNING: Theme = { ...DEFAULT, confirm: '#F59E0B' };

/* ==========================================================
   SERVICIO
   ========================================================== */
@Injectable({ providedIn: 'root' })
export class SweetAlertService {
  private readonly doc = inject(DOCUMENT);

  constructor() {
    this.injectStyles();
  }

  // ───────────────────────── Supervisor ─────────────────────────

  supervisorSuccess(title: string, text?: string) {
    return this.open(SUPERVISOR, {
      icon: 'success',
      title,
      text,
      confirmButtonText: 'Listo',
      timer: 3000,
      timerProgressBar: true
    });
  }

  supervisorWarning(title: string, text?: string, confirmButtonText = 'Entendido') {
    return this.open(SUPERVISOR, { icon: 'warning', title, text, confirmButtonText });
  }

  supervisorError(title: string, text?: string) {
    return this.open(
      SUPERVISOR_DANGER,
      { icon: 'error', title, text, confirmButtonText: 'Entendido' },
      true
    );
  }

  supervisorConfirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return this.open(SUPERVISOR, {
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: false
    });
  }

  // ───────────────────────── Generales ─────────────────────────

  success(title: string, text?: string) {
    return this.open(DEFAULT, {
      icon: 'success',
      title,
      text,
      confirmButtonText: 'Listo',
      timer: 3000,
      timerProgressBar: true
    });
  }

  error(title: string, text?: string) {
    return this.open(
      DEFAULT_DANGER,
      { icon: 'error', title, text, confirmButtonText: 'Entendido' },
      true
    );
  }

  info(title: string, text?: string) {
    return this.open(DEFAULT, { icon: 'info', title, text, confirmButtonText: 'Entendido' });
  }

  warning(title: string, text?: string) {
    return this.open(DEFAULT_WARNING, {
      icon: 'warning',
      title,
      text,
      confirmButtonText: 'Entendido'
    });
  }

  confirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return this.open(DEFAULT, {
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
  }

  // ───────────────────────── Nuevos ─────────────────────────

  /** Notificación pequeña que se desliza desde la esquina y se cierra sola. */
  toast(icon: SweetAlertIcon, title: string, timer = 3500) {
    const theme =
      icon === 'error' ? DEFAULT_DANGER : icon === 'warning' ? DEFAULT_WARNING : DEFAULT;

    return Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
      background: theme.background,
      color: theme.color,
      showClass: { popup: 'bd-toast-in' },
      hideClass: { popup: 'bd-toast-out' },
      customClass: { popup: `bd-toast bd-alert--${theme.variant}` },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  }

  /** Alerta de carga. Ciérrala con `close()` cuando termine el proceso. */
  loading(title = 'Procesando...', text?: string) {
    return Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: DEFAULT.background,
      color: DEFAULT.color,
      showClass: { popup: 'bd-pop-in', backdrop: 'bd-backdrop-in' },
      hideClass: { popup: 'bd-pop-out', backdrop: 'bd-backdrop-out' },
      customClass: { popup: 'bd-alert bd-alert--default bd-alert--loading' },
      didOpen: () => Swal.showLoading()
    });
  }

  close() {
    Swal.close();
  }

  // ───────────────────────── Interno ─────────────────────────

  private open(
    theme: Theme,
    options: SweetAlertOptions,
    shake = false
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      background: theme.background,
      color: theme.color,
      confirmButtonColor: theme.confirm,
      cancelButtonColor: theme.cancel,
      showClass: {
        popup: shake ? 'bd-pop-shake' : 'bd-pop-in',
        backdrop: 'bd-backdrop-in'
      },
      hideClass: {
        popup: 'bd-pop-out',
        backdrop: 'bd-backdrop-out'
      },
      customClass: {
        popup: `bd-alert bd-alert--${theme.variant}${
          theme.variant === 'default' ? '' : ' bd-supervisor-alert'
        }`,
        confirmButton: 'bd-btn bd-sweet-confirm',
        cancelButton: 'bd-btn bd-sweet-cancel'
      },
      ...options
    });
  }

  private injectStyles() {
    const id = 'bd-sweet-alert-styles';
    if (this.doc.getElementById(id)) return;

    const style = this.doc.createElement('style');
    style.id = id;
    style.textContent = ALERT_STYLES;
    this.doc.head.appendChild(style);
  }
}