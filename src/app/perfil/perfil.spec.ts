import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';
import { PerfilComponent } from './perfil';
import { AuthService, AuthenticatedUser } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { environment } from '../../environments/environment';

describe('PerfilComponent - Módulo de Edición de Datos Propios del Perfil (Autogestión)', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let authService: AuthService;
  let sweetAlertService: SweetAlertService;
  let httpMock: HttpTestingController;

  const mockUsuario: AuthenticatedUser = {
    id_usuario: 15,
    nombre: 'Carlos',
    apellido: 'Ruiz',
    correo: 'carlos.ruiz@sirae.edu.co',
    numero_documento: '1098765432',
    rol: 'Supervisor',
    is_active: true,
    institucion_nombre: 'Colegio Técnico Central',
    sede_nombre: 'Sede A',
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore(),
        AuthService,
        SweetAlertService,
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    sweetAlertService = TestBed.inject(SweetAlertService);
    httpMock = TestBed.inject(HttpTestingController);

    vi.spyOn(sweetAlertService, 'success').mockResolvedValue({ isConfirmed: true } as any);
    vi.spyOn(sweetAlertService, 'error').mockResolvedValue({ isConfirmed: true } as any);
    vi.spyOn(sweetAlertService, 'warning').mockResolvedValue({ isConfirmed: true } as any);

    // Mock inicial del usuario autenticado en AuthService
    vi.spyOn(authService, 'obtenerUsuario').mockReturnValue(mockUsuario);
    vi.spyOn(authService, 'obtenerPerfil').mockReturnValue(of(mockUsuario));

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('Criterio 1: Visualización de Datos Actuales del usuario autenticado (/api/usuarios/me/)', () => {
    expect(component.usuario).toBeDefined();
    expect(component.usuario?.nombre).toBe('Carlos');
    expect(component.usuario?.apellido).toBe('Ruiz');
    expect(component.usuario?.correo).toBe('carlos.ruiz@sirae.edu.co');
    expect(component.usuario?.rol).toBe('Supervisor');
    expect(component.usuario?.institucion_nombre).toBe('Colegio Técnico Central');
    expect(component.usuario?.is_active).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('carlos.ruiz@sirae.edu.co');
    expect(compiled.textContent).toContain('Supervisor');
    expect(compiled.textContent).toContain('Colegio Técnico Central');
  });

  it('Criterio 2: Activación del Formulario al presionar "Editar información personal"', () => {
    expect(component.modoEdicion).toBe(false);

    const botonEditar = fixture.nativeElement.querySelector('.btn-editar-personal') as HTMLButtonElement;
    expect(botonEditar).not.toBeNull();
    botonEditar.click();
    fixture.detectChanges();

    expect(component.modoEdicion).toBe(true);
    expect(component.perfilForm).toBeDefined();
  });

  it('Criterio 3: Precarga automática de la información actual en los campos del formulario reactivo', () => {
    component.activarEdicion();

    expect(component.perfilForm.get('nombre')?.value).toBe('Carlos');
    expect(component.perfilForm.get('apellido')?.value).toBe('Ruiz');
    expect(component.perfilForm.pristine).toBe(true);
    expect(component.perfilForm.untouched).toBe(true);
  });

  it('Criterio 4: Validación Previa al Guardado (ReactiveForms)', () => {
    component.activarEdicion();

    // Caso inválido: campos vacíos
    component.perfilForm.patchValue({ nombre: '', apellido: '' });
    expect(component.perfilForm.invalid).toBe(true);
    expect(component.nombreControl?.errors?.['required']).toBe(true);
    expect(component.apellidoControl?.errors?.['required']).toBe(true);

    // Caso inválido: nombre muy corto (< 2 caracteres)
    component.perfilForm.patchValue({ nombre: 'A', apellido: 'B' });
    expect(component.perfilForm.invalid).toBe(true);
    expect(component.nombreControl?.errors?.['minlength']).toBeDefined();

    // Caso inválido: caracteres no permitidos (números y símbolos)
    component.perfilForm.patchValue({ nombre: 'Carlos123', apellido: 'Ruiz$$' });
    expect(component.perfilForm.invalid).toBe(true);
    expect(component.nombreControl?.errors?.['pattern']).toBeDefined();

    // Caso válido
    component.perfilForm.patchValue({ nombre: 'Carlos Andrés', apellido: 'Ruiz Morales' });
    expect(component.perfilForm.valid).toBe(true);
  });

  it('Criterio 5: Restricción Estricta de Campos Protegidos en el formulario y petición', () => {
    component.activarEdicion();

    // Verificar que el formulario reactivo NO contiene campos para rol, estado ni correo
    expect(component.perfilForm.contains('rol')).toBe(false);
    expect(component.perfilForm.contains('is_active')).toBe(false);
    expect(component.perfilForm.contains('estado')).toBe(false);
    expect(component.perfilForm.contains('correo')).toBe(false);
    expect(component.perfilForm.contains('id_institucion')).toBe(false);
    expect(component.perfilForm.contains('id_sede')).toBe(false);

    // Espiar actualizarPerfil para garantizar que solo se envíen campos autorizados
    const actualizarSpy = vi.spyOn(authService, 'actualizarPerfil').mockReturnValue(of({
      ...mockUsuario,
      nombre: 'Carlos Modificado',
      apellido: 'Ruiz Modificado',
    }));

    component.perfilForm.patchValue({
      nombre: 'Carlos Modificado',
      apellido: 'Ruiz Modificado',
    });

    component.guardarCambios();

    expect(actualizarSpy).toHaveBeenCalledWith({
      nombre: 'Carlos Modificado',
      apellido: 'Ruiz Modificado',
    });
  });

  it('Criterio 6: Retroalimentación exitosa con SweetAlert y actualización de estado', () => {
    const successSpy = vi.spyOn(sweetAlertService, 'success');
    vi.spyOn(authService, 'actualizarPerfil').mockReturnValue(of({
      ...mockUsuario,
      nombre: 'Carlos Alberto',
      apellido: 'Ruiz Peña',
    }));

    component.activarEdicion();
    component.perfilForm.patchValue({
      nombre: 'Carlos Alberto',
      apellido: 'Ruiz Peña',
    });

    component.guardarCambios();

    expect(component.guardando).toBe(false);
    expect(component.modoEdicion).toBe(false);
    expect(component.usuario?.nombre).toBe('Carlos Alberto');
    expect(component.usuario?.apellido).toBe('Ruiz Peña');
    expect(component.mensajeExito).toContain('Perfil actualizado exitosamente');
    expect(successSpy).toHaveBeenCalledWith(
      'Perfil actualizado',
      'Tus datos se guardaron correctamente.'
    );
  });

  it('Criterio 6: Retroalimentación clara de error ante fallos del servidor o red', () => {
    const errorSpy = vi.spyOn(sweetAlertService, 'error');
    vi.spyOn(authService, 'actualizarPerfil').mockReturnValue(
      throwError(() => ({
        error: { detail: 'El servidor no pudo procesar los cambios en este momento.' },
      }))
    );

    component.activarEdicion();
    component.perfilForm.patchValue({
      nombre: 'Carlos Alberto',
      apellido: 'Ruiz Peña',
    });

    component.guardarCambios();

    expect(component.guardando).toBe(false);
    expect(component.modoEdicion).toBe(true); // Permanece en modo edición para corregir
    expect(component.mensajeError).toContain('El servidor no pudo procesar los cambios');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('Permite cancelar la edición y restaurar la vista original', () => {
    component.activarEdicion();
    component.perfilForm.patchValue({ nombre: 'ModificacionNoGuardada' });

    component.cancelarEdicion();

    expect(component.modoEdicion).toBe(false);
    expect(component.mensajeError).toBe('');
    expect(component.mensajeExito).toBe('');
  });
});
