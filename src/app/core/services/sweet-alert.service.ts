import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class SweetAlertService {
  supervisorSuccess(title: string, text?: string) {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonColor: '#D97706',
      background: '#FFFBEB',
      color: '#78350F',
      customClass: {
        popup: 'bd-supervisor-alert',
        confirmButton: 'bd-sweet-confirm'
      }
    });
  }

  supervisorWarning(title: string, text?: string, confirmButtonText = 'Entendido') {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonColor: '#D97706',
      confirmButtonText,
      background: '#FFFBEB',
      color: '#78350F',
      customClass: {
        popup: 'bd-supervisor-alert',
        confirmButton: 'bd-sweet-confirm'
      }
    });
  }

  supervisorError(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonColor: '#DC2626',
      confirmButtonText: 'Entendido',
      background: '#FFF7F7',
      color: '#7F1D1D',
      customClass: {
        popup: 'bd-supervisor-alert',
        confirmButton: 'bd-sweet-confirm'
      }
    });
  }

  supervisorConfirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return Swal.fire({
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonColor: '#D97706',
      cancelButtonColor: '#64748B',
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      background: '#FFFBEB',
      color: '#78350F',
      reverseButtons: true,
      customClass: {
        popup: 'bd-supervisor-alert',
        confirmButton: 'bd-sweet-confirm'
      }
    });
  }

  success(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      confirmButtonColor: '#FAB41F',
      background: '#fff',
      color: '#1f2937',
      customClass: {
        confirmButton: 'bd-sweet-confirm'
      }
    });
  }

  error(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      confirmButtonColor: '#ef4444',
      background: '#fff',
      color: '#1f2937'
    });
  }

  info(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      confirmButtonColor: '#FAB41F',
      background: '#fff',
      color: '#1f2937'
    });
  }

  warning(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      confirmButtonColor: '#F59E0B',
      background: '#fff',
      color: '#1f2937'
    });
  }

  confirm(title: string, text?: string, confirmButtonText = 'Sí, continuar') {
    return Swal.fire({
      title,
      text,
      showCancelButton: true,
      confirmButtonColor: '#FAB41F',
      cancelButtonColor: '#334155',
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      background: '#fff',
      color: '#1f2937',
      reverseButtons: true
    });
  }
}
