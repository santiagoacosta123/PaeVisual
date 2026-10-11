import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class SweetAlertService {
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
