import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertPosition, SweetAlertResult } from 'sweetalert2';

/* ==========================================================
   POSICIÓN
   NOTAS (success, error, info, warning, toast): salen en una esquina.
   'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

   ALERTAS (confirm, loading): ventana con fondo oscurecido.
   'center' | 'bottom' | 'top'
   ========================================================== */
type PosicionNota = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
const POSICION_NOTAS: PosicionNota = 'bottom-end';
const POSICION_ALERTAS: SweetAlertPosition = 'bottom';

/* ==========================================================
   TIEMPOS (en milisegundos)
   Sube estos valores si quieres que las notas duren más.
   ========================================================== */
const TIEMPO_SUCCESS = 5000;
const TIEMPO_INFO = 7000;
const TIEMPO_WARNING = 8000;
const TIEMPO_ERROR = 9000;
const TIEMPO_TOAST = 5000;

/** Máximo de notas visibles a la vez (al pasar el límite se cierra la más antigua). */
const MAX_NOTAS = 4;

/* ==========================================================
   ESTILOS Y ANIMACIONES (se inyectan solos en el <head>)
   Variables de cada tipo:
     --bd-bg      fondo de la tarjeta (blanco)
     --bd-accent  franja de color a la izquierda
     --bd-title   color del título
     --bd-text    color del mensaje
     --bd-btn     fondo del botón principal (confirm)
     --bd-btn-ink letra del botón principal
     --bd-close   color de la X
     --bd-bar     color de la barra de tiempo
     --bd-glow    sombra (r, g, b)
   ========================================================== */
const ALERT_STYLES = `
/* ---------- Paletas (compartidas por notas y alertas) ---------- */
.bd-note--info, .bd-alert--info {
  --bd-bg: #ffffff; --bd-title: #7a5a0b; --bd-text: #475569; --bd-accent: #F5B81F;
  --bd-btn: #F5B81F; --bd-btn-ink: #ffffff;
  --bd-close: rgba(15, 23, 42, 0.4); --bd-bar: #F5B81F; --bd-glow: 15, 23, 42;
}
.bd-note--question, .bd-alert--question {
  --bd-bg: #ffffff; --bd-title: #7a5a0b; --bd-text: #475569; --bd-accent: #F5B81F;
  --bd-btn: #F5B81F; --bd-btn-ink: #ffffff;
  --bd-close: rgba(15, 23, 42, 0.4); --bd-bar: #F5B81F; --bd-glow: 15, 23, 42;
}
.bd-note--warning, .bd-alert--warning {
  --bd-bg: #ffffff; --bd-title: #e11d48; --bd-text: #475569; --bd-accent: #ee4a72;
  --bd-btn: #ee4a72; --bd-btn-ink: #ffffff;
  --bd-close: rgba(15, 23, 42, 0.4); --bd-bar: #ee4a72; --bd-glow: 15, 23, 42;
}
.bd-note--success, .bd-alert--success {
  --bd-bg: #ffffff; --bd-title: #2B5424; --bd-text: #475569; --bd-accent: #2B5424;
  --bd-btn: #2B5424; --bd-btn-ink: #ffffff;
  --bd-close: rgba(15, 23, 42, 0.4); --bd-bar: #2B5424; --bd-glow: 15, 23, 42;
}
.bd-note--danger, .bd-alert--danger {
  --bd-bg: #ffffff; --bd-title: #e72d5a; --bd-text: #475569; --bd-accent: #e72d5a;
  --bd-btn: #e72d5a; --bd-btn-ink: #ffffff;
  --bd-close: rgba(15, 23, 42, 0.4); --bd-bar: #e72d5a; --bd-glow: 15, 23, 42;
}

/* ==========================================================
   NOTAS EN LA ESQUINA
   ========================================================== */
.bd-notes {
  position: fixed;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(calc(100vw - 2rem), 26rem);
  pointer-events: none;
  font-family: 'Roboto', system-ui, sans-serif;
}
.bd-notes--bottom-end   { right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); --bd-enter-x: 70px; }
.bd-notes--bottom-start { left: max(1rem, env(safe-area-inset-left));  bottom: max(1rem, env(safe-area-inset-bottom)); --bd-enter-x: -70px; }
.bd-notes--top-end      { right: max(1rem, env(safe-area-inset-right)); top: max(1rem, env(safe-area-inset-top)); --bd-enter-x: 70px; }
.bd-notes--top-start    { left: max(1rem, env(safe-area-inset-left));  top: max(1rem, env(safe-area-inset-top)); --bd-enter-x: -70px; }

.bd-note {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 1rem;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
  padding: 1.05rem 2.9rem 1.05rem 1.3rem;
  border-radius: 18px;
  background: var(--bd-bg);
  color: var(--bd-text);
  box-shadow:
    inset 5px 0 0 var(--bd-accent),
    inset 0 0 0 1px #e2e8f0,
    0 16px 30px -12px rgba(var(--bd-glow), 0.3);
  animation: bd-note-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.bd-note--danger { animation-name: bd-note-in-shake; animation-duration: 1s; }
.bd-note--out { animation: bd-note-out 0.35s ease-in forwards; pointer-events: none; }

.bd-note__icon {
  display: flex;
  width: 3rem;
  height: 3rem;
  animation: bd-icon-pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}
.bd-note__icon svg { display: block; width: 100%; height: 100%; }

.bd-note__body { min-width: 0; }
.bd-note__title {
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--bd-title);
  overflow-wrap: anywhere;
}
.bd-note__text {
  margin-top: 0.25rem;
  font-size: 0.93rem;
  font-weight: 400;
  line-height: 1.4;
  color: var(--bd-text);
  overflow-wrap: anywhere;
}

.bd-note__close {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--bd-close);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s ease;
}
.bd-note__close svg { display: block; width: 1rem; height: 1rem; }
.bd-note__close:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; transform: rotate(90deg); }
.bd-note__close:focus-visible { outline: 2px solid var(--bd-title); outline-offset: 2px; }

.bd-note__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--bd-bar);
  opacity: 0.85;
  transform-origin: left center;
  animation: bd-note-bar linear forwards;
}

@keyframes bd-note-in {
  0%   { opacity: 0; transform: translateX(var(--bd-enter-x, 70px)) scale(0.96); }
  60%  { opacity: 1; transform: translateX(calc(var(--bd-enter-x, 70px) * -0.09)) scale(1.01); }
  100% { opacity: 1; transform: none; }
}
@keyframes bd-note-in-shake {
  0%   { opacity: 0; transform: translateX(var(--bd-enter-x, 70px)) scale(0.96); }
  35%  { opacity: 1; transform: translateX(0) scale(1.01); }
  45%  { transform: translateX(-9px); }
  55%  { transform: translateX(8px); }
  65%  { transform: translateX(-5px); }
  75%  { transform: translateX(3px); }
  100% { opacity: 1; transform: none; }
}
@keyframes bd-note-out {
  to { opacity: 0; transform: translateX(var(--bd-enter-x, 70px)) scale(0.96); }
}
@keyframes bd-note-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }

@media (max-width: 480px) {
  .bd-note { column-gap: 0.85rem; padding: 0.95rem 2.7rem 0.95rem 1.2rem; }
  .bd-note__icon { width: 2.6rem; height: 2.6rem; }
  .bd-note__title { font-size: 1rem; }
  .bd-note__text { font-size: 0.88rem; }
}

/* ==========================================================
   ALERTAS CON FONDO OSCURECIDO (confirm y loading)
   ========================================================== */
.swal2-container { z-index: 99999 !important; }

.swal2-container.swal2-backdrop-show {
  background: rgba(8, 8, 12, 0.62) !important;
  backdrop-filter: blur(4px);
}
.swal2-container.swal2-bottom {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
}

.bd-alert { font-family: 'Roboto', sans-serif; }

.swal2-popup.bd-alert {
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    "icon title"
    "icon text"
    "icon actions";
  align-items: center;
  column-gap: 1.1rem;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  width: min(92vw, 30rem);
  padding: 1.3rem 3.1rem 1.3rem 1.55rem;
  border: 0;
  border-radius: 18px;
  background: var(--bd-bg);
  color: var(--bd-text);
  box-shadow:
    inset 5px 0 0 var(--bd-accent),
    inset 0 0 0 1px #e2e8f0,
    0 28px 50px -18px rgba(var(--bd-glow), 0.45);
}
.swal2-popup.bd-alert > *:not(.swal2-close) { position: relative; z-index: 1; }

.swal2-popup.bd-alert .swal2-title {
  grid-area: title;
  margin: 0;
  padding: 0;
  text-align: left;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--bd-title);
  overflow-wrap: anywhere;
  animation: bd-text-in 0.6s ease-out 0.3s both;
}
.swal2-popup.bd-alert .swal2-html-container {
  grid-area: text;
  margin: 0.3rem 0 0;
  padding: 0;
  justify-content: flex-start;
  text-align: left;
  font-size: 0.95rem;
  line-height: 1.45;
  font-weight: 400;
  color: var(--bd-text);
  overflow-wrap: anywhere;
  animation: bd-text-in 0.6s ease-out 0.45s both;
}
.swal2-popup.bd-alert .swal2-actions {
  grid-area: actions;
  justify-content: flex-start;
  gap: 0.55rem;
  width: auto;
  margin: 0.95rem 0 0;
  animation: bd-text-in 0.6s ease-out 0.6s both;
}

/* Ícono */
.swal2-popup.bd-alert .swal2-icon,
.swal2-popup.bd-alert .swal2-icon.swal2-icon-show {
  grid-area: icon;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-size: 1rem;
  color: inherit;
  animation: bd-icon-pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}
.swal2-popup.bd-alert .swal2-icon .swal2-icon-content {
  display: flex;
  font-size: 1rem;
  line-height: 1;
  animation: none !important;
}
.swal2-popup.bd-alert .swal2-icon svg { display: block; width: 100%; height: 100%; }
.swal2-popup.bd-alert .swal2-icon.swal2-question svg { animation: bd-hop 1.5s ease-in-out 1s 2; }
.swal2-popup.bd-alert .swal2-icon svg.bd-spinner { animation: bd-spin 0.9s linear infinite !important; }

/* Botón cerrar (X) */
.swal2-popup.bd-alert .swal2-close {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  z-index: 3;
  grid-area: auto;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--bd-close);
  font-size: 1rem;
  box-shadow: none;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s ease;
}
.swal2-popup.bd-alert .swal2-close svg { display: block; width: 1.05rem; height: 1.05rem; }
.swal2-popup.bd-alert .swal2-close:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; transform: rotate(90deg); }
.swal2-popup.bd-alert .swal2-close:focus { box-shadow: none; }
.swal2-popup.bd-alert .swal2-close:focus-visible { outline: 2px solid var(--bd-title); outline-offset: 2px; }

/* Botones */
.swal2-popup.bd-alert .swal2-styled.bd-btn {
  position: relative;
  overflow: hidden;
  min-width: 5.5rem;
  margin: 0;
  padding: 0.5rem 1.3rem;
  border-radius: 9999px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  transition: transform 0.15s ease, filter 0.2s ease, background 0.2s ease;
}
.swal2-popup.bd-alert .swal2-styled.bd-btn,
.swal2-popup.bd-alert .swal2-styled.bd-btn:focus { outline: 0; }
.swal2-popup.bd-alert .swal2-styled.bd-btn:focus-visible { outline: 2px solid var(--bd-title); outline-offset: 3px; }
.swal2-popup.bd-alert .swal2-styled.bd-btn:hover { transform: translateY(-2px); }
.swal2-popup.bd-alert .swal2-styled.bd-btn:active { transform: translateY(0) scale(0.96); }

.swal2-popup.bd-alert .swal2-styled.bd-btn--confirm {
  background: var(--bd-btn) !important;
  color: var(--bd-btn-ink) !important;
  border: 0 !important;
  box-shadow: 0 10px 20px -10px rgba(var(--bd-glow), 0.9) !important;
}
.swal2-popup.bd-alert .swal2-styled.bd-btn--confirm:hover { filter: brightness(1.1); }

.swal2-popup.bd-alert .swal2-styled.bd-btn--cancel {
  background: #f1f5f9 !important;
  color: #334155 !important;
  border: 1px solid #cbd5e1 !important;
  box-shadow: none !important;
}
.swal2-popup.bd-alert .swal2-styled.bd-btn--cancel:hover { background: #e2e8f0 !important; }

/* Entradas / salidas de la ventana */
.bd-pop-in { animation: bd-rise-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
.bd-pop-out { animation: bd-rise-out 0.35s ease-in both; }
.bd-backdrop-in { animation: bd-fade-in 0.4s ease-out both; }
.bd-backdrop-out { animation: bd-fade-out 0.3s ease-in both; }

@keyframes bd-rise-in {
  0%   { opacity: 0; transform: translateY(100px) scale(0.92); }
  60%  { opacity: 1; transform: translateY(-9px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bd-rise-out { to { opacity: 0; transform: translateY(60px) scale(0.94); } }
@keyframes bd-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bd-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes bd-text-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes bd-hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
  60% { transform: translateY(0); }
  75% { transform: translateY(-3px); }
}
@keyframes bd-spin { to { transform: rotate(360deg); } }

@media (max-width: 480px) {
  .swal2-popup.bd-alert { column-gap: 0.9rem; padding: 1.15rem 2.8rem 1.15rem 1.1rem; }
  .swal2-popup.bd-alert .swal2-icon,
  .swal2-popup.bd-alert .swal2-icon.swal2-icon-show { width: 2.9rem; height: 2.9rem; }
  .swal2-popup.bd-alert .swal2-title { font-size: 1.08rem; }
  .swal2-popup.bd-alert .swal2-html-container { font-size: 0.9rem; }
}

/* ---------- Compartido ---------- */
@keyframes bd-icon-pop {
  0%   { opacity: 0; transform: scale(0) rotate(-35deg); }
  60%  { opacity: 1; transform: scale(1.18) rotate(6deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}

/* Accesibilidad: respeta "reducir movimiento" del sistema */
@media (prefers-reduced-motion: reduce) {
  .bd-note, .bd-note *, .bd-alert, .bd-alert * {
    animation-duration: 0.01ms !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/* ==========================================================
   ÍCONOS (SVG propios, con los colores de la imagen de referencia)
   ========================================================== */
const SVG = (contenido: string, clase = '') =>
  `<svg viewBox="0 0 48 48" ${clase ? `class="${clase}" ` : ''}aria-hidden="true">${contenido}</svg>`;

const ICONOS = {
  /** Triángulo rosado con signo de exclamación */
  warning: SVG(
    '<path d="M24 9 7 38.5h34L24 9Z" fill="#ee4a72" stroke="#ee4a72" stroke-width="5" stroke-linejoin="round"/>' +
    '<rect x="21.9" y="18.5" width="4.2" height="11" rx="2.1" fill="#fff"/>' +
    '<circle cx="24" cy="34" r="2.5" fill="#fff"/>'
  ),
  /** Círculo blanco con X roja */
  error: SVG(
    '<circle cx="24" cy="24" r="20" fill="#e72d5a"/>' +
    '<path d="m16.5 16.5 15 15m0-15-15 15" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
  ),
  /** Camión de entrega (blanco y rojo, para errores de entregas) */
  entrega: SVG(
    '<circle cx="24" cy="24" r="20" fill="#e72d5a"/>' +
    '<g transform="translate(11.5 11.5) scale(1.05)" fill="#fff"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4ZM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5Zm13.5-9 1.96 2.5H17V9.5h2.5Zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5Z"/></g>'
  ),
  /** Burbuja de información (amarillo institucional con "i") */
  info: SVG(
    '<circle cx="24" cy="23" r="19" fill="#F5B81F"/>' +
    '<path d="M8 44l2.5-10 8 5L8 44Z" fill="#F5B81F"/>' +
    '<circle cx="24" cy="14.5" r="2.7" fill="#fff"/>' +
    '<path d="M20 20.5h6.5v13H29v3h-9.5v-3H22v-10h-2Z" fill="#fff"/>'
  ),
  /** Signo de pregunta en círculo amarillo (confirmaciones) */
  question: SVG(
    '<circle cx="24" cy="24" r="20" fill="#F5B81F"/>' +
    '<path d="M17.5 19c0-3.6 2.9-6 6.5-6s6.5 2.3 6.5 5.6c0 2.4-1.5 3.6-3 4.6-1.4.9-2.3 1.7-2.3 3.3" fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="25" cy="34" r="2.5" fill="#ffffff"/>'
  ),
  /** Círculo verde con check */
  success: SVG(
    '<circle cx="24" cy="24" r="20" fill="#2B5424"/>' +
    '<path d="m15 24.5 6.5 6.5L33.5 18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  /** Anillo que gira (cargando) */
  loading: SVG(
    '<circle cx="24" cy="24" r="18" fill="none" stroke="rgba(15,23,42,.1)" stroke-width="5"/>' +
    '<path d="M24 6a18 18 0 0 1 18 18" fill="none" stroke="#F5B81F" stroke-width="5" stroke-linecap="round"/>',
    'bd-spinner'
  )
} as const;

/** X del botón de cerrar */
const CERRAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

type Tipo = 'success' | 'warning' | 'error' | 'info' | 'question';
type IconoError = 'x' | 'entrega';

/** Qué paleta de color usa cada tipo. */
const PALETA: Record<Tipo, 'success' | 'warning' | 'danger' | 'info' | 'question'> = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
  question: 'question'
};

/* ==========================================================
   SERVICIO
   ========================================================== */
@Injectable({ providedIn: 'root' })
export class SweetAlertService {
  private readonly doc = inject(DOCUMENT);

  constructor() {
    this.injectStyles();
  }

  // ───────────────────────── Notas en la esquina ─────────────────────────
  // No bloquean la pantalla. La promesa se resuelve cuando la nota se cierra
  // (sola o con la X), igual que antes.

  /** Nota verde con check. Se cierra sola (ver TIEMPO_SUCCESS). Se pausa al pasar el mouse. */
  success(title: string, text?: string) {
    return this.nota('success', title, text, TIEMPO_SUCCESS);
  }

  /** Nota roja. Entra con una pequeña sacudida. Usa `'entrega'` para el ícono del camión. */
  error(title: string, text?: string, icono: IconoError = 'x') {
    return this.nota('error', title, text, TIEMPO_ERROR, icono === 'entrega' ? ICONOS.entrega : undefined);
  }

  /** Nota oscura con burbuja de información. */
  info(title: string, text?: string) {
    return this.nota('info', title, text, TIEMPO_INFO);
  }

  /** Nota oscura con triángulo de advertencia. */
  warning(title: string, text?: string) {
    return this.nota('warning', title, text, TIEMPO_WARNING);
  }

  /** Nota corta (solo título). Mismo estilo que las demás. */
  toast(icon: SweetAlertIcon, title: string, timer = TIEMPO_TOAST) {
    return this.nota(icon as Tipo, title, undefined, timer);
  }

  // ───────────────────────── Supervisor ─────────────────────────
  // Mismos nombres de antes, para no romper el código existente.

  supervisorSuccess(title: string, text?: string) {
    return this.success(title, text);
  }

  supervisorWarning(title: string, text?: string, _confirmButtonText = 'Entendido') {
    return this.warning(title, text);
  }

  supervisorError(title: string, text?: string) {
    return this.error(title, text);
  }

  supervisorConfirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return this.confirm(title, text, confirmButtonText);
  }

  // ───────────────────────── Ventanas (con fondo oscurecido) ─────────────────────────

  /** Pregunta con dos botones. Devuelve `isConfirmed` en true si acepta. */
  confirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return Swal.fire({
      position: POSICION_ALERTAS,
      icon: 'question',
      iconHtml: ICONOS.question,
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      showCloseButton: true,
      closeButtonHtml: CERRAR_SVG,
      closeButtonAriaLabel: 'Cerrar',
      // Sin foco automático en el botón: evita el aro doble. Enter sigue confirmando.
      focusConfirm: false,
      showClass: { popup: 'bd-pop-in', backdrop: 'bd-backdrop-in' },
      hideClass: { popup: 'bd-pop-out', backdrop: 'bd-backdrop-out' },
      customClass: {
        popup: 'bd-alert bd-alert--question',
        confirmButton: 'bd-btn bd-btn--confirm',
        cancelButton: 'bd-btn bd-btn--cancel'
      }
    });
  }

  /** Alerta de carga. Ciérrala con `close()` cuando termine el proceso. */
  loading(title = 'Procesando...', text?: string) {
    return Swal.fire({
      title,
      text,
      position: POSICION_ALERTAS,
      icon: 'info',
      iconHtml: ICONOS.loading,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      showClass: { popup: 'bd-pop-in', backdrop: 'bd-backdrop-in' },
      hideClass: { popup: 'bd-pop-out', backdrop: 'bd-backdrop-out' },
      customClass: { popup: 'bd-alert bd-alert--info' }
    });
  }

  close() {
    Swal.close();
  }

  // ───────────────────────── Interno ─────────────────────────

  private nota(
    tipo: Tipo,
    title: string,
    text: string | undefined,
    duracion: number,
    iconoPropio?: string
  ): Promise<SweetAlertResult> {
    return new Promise((resolve) => {
      const contenedor = this.contenedorNotas();

      // Si ya hay demasiadas, se cierra la más antigua
      const activas = contenedor.querySelectorAll<HTMLElement>('.bd-note:not(.bd-note--out)');
      if (activas.length >= MAX_NOTAS) {
        activas[0].querySelector<HTMLElement>('.bd-note__close')?.click();
      }

      // Título y mensaje se insertan como texto (nunca como HTML)
      const nota = this.crear('div', `bd-note bd-note--${PALETA[tipo] ?? 'info'}`);
      nota.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

      const icono = this.crear('div', 'bd-note__icon');
      icono.innerHTML = iconoPropio ?? ICONOS[tipo] ?? ICONOS.info;

      const cuerpo = this.crear('div', 'bd-note__body');
      cuerpo.appendChild(this.crear('div', 'bd-note__title', title));
      if (text) cuerpo.appendChild(this.crear('div', 'bd-note__text', text));

      const cerrar = this.crear('button', 'bd-note__close') as HTMLButtonElement;
      cerrar.type = 'button';
      cerrar.setAttribute('aria-label', 'Cerrar');
      cerrar.innerHTML = CERRAR_SVG;

      const barra = this.crear('div', 'bd-note__bar');
      barra.style.animationDuration = `${duracion}ms`;

      nota.append(icono, cuerpo, cerrar, barra);

      // Temporizador con pausa al pasar el mouse
      let cerrada = false;
      let restante = duracion;
      let inicio = Date.now();
      let temporizador: ReturnType<typeof setTimeout> | undefined;

      const terminar = (motivo: 'close' | 'timer') => {
        if (cerrada) return;
        cerrada = true;
        clearTimeout(temporizador);
        nota.classList.add('bd-note--out');
        setTimeout(() => nota.remove(), 400);
        resolve({
          isConfirmed: false,
          isDenied: false,
          isDismissed: true,
          dismiss: motivo
        } as unknown as SweetAlertResult);
      };

      const arrancar = () => {
        if (cerrada) return;
        inicio = Date.now();
        barra.style.animationPlayState = 'running';
        temporizador = setTimeout(() => terminar('timer'), Math.max(restante, 0));
      };

      const pausar = () => {
        if (cerrada) return;
        clearTimeout(temporizador);
        restante -= Date.now() - inicio;
        barra.style.animationPlayState = 'paused';
      };

      nota.addEventListener('mouseenter', pausar);
      nota.addEventListener('mouseleave', arrancar);
      cerrar.addEventListener('click', () => terminar('close'));

      contenedor.appendChild(nota);
      arrancar();
    });
  }

  private contenedorNotas(): HTMLElement {
    const id = 'bd-notes';
    let contenedor = this.doc.getElementById(id);
    if (!contenedor) {
      contenedor = this.crear('div', `bd-notes bd-notes--${POSICION_NOTAS}`);
      contenedor.id = id;
      contenedor.setAttribute('aria-live', 'polite');
      this.doc.body.appendChild(contenedor);
    }
    return contenedor;
  }

  private crear(etiqueta: string, clase: string, texto?: string): HTMLElement {
    const elemento = this.doc.createElement(etiqueta);
    elemento.className = clase;
    if (texto) elemento.textContent = texto;
    return elemento;
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