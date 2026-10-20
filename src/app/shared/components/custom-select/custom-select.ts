import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ElementRef,
  HostListener,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ],
  templateUrl: './custom-select.html',
  styleUrls: ['./custom-select.css']
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() options: any[] = [];
  @Input() valueField: string = '';
  @Input() labelField: string = '';
  @Input() placeholder: string = 'Seleccionar...';
  @Input() disabled: boolean = false;
  @Input() required: boolean = false;
  @Input() name: string = '';
  @Input() id: string = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() searchable: boolean | null = null;
  @Input() minWidth: string = '';
  @Input() maxWidth: string = '';
  @Input() width: string = '100%';
  @Input() allowClear: boolean = false;

  @Output() selectionChange = new EventEmitter<any>();
  @Output() valueChange = new EventEmitter<any>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  value: any = null;
  isOpen: boolean = false;
  openUpwards: boolean = false;
  searchQuery: string = '';

  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  // ControlValueAccessor methods
  writeValue(obj: any): void {
    this.value = obj;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  get isSearchable(): boolean {
    if (this.searchable !== null && this.searchable !== undefined) {
      return this.searchable;
    }
    return (this.options?.length || 0) >= 6;
  }

  get filteredOptions(): any[] {
    if (!this.searchQuery.trim()) {
      return this.options || [];
    }
    const q = this.searchQuery.toLowerCase().trim();
    return (this.options || []).filter(opt => {
      const label = this.getOptionLabel(opt).toLowerCase();
      return label.includes(q);
    });
  }

  get currentDisplayLabel(): string {
    if (this.isEmpty(this.value)) {
      const emptyOpt = this.options?.find(o => this.isEmpty(this.getOptionValue(o)));
      if (emptyOpt) {
        return this.getOptionLabel(emptyOpt);
      }
      return this.placeholder || 'Seleccionar...';
    }

    const found = this.options?.find(o => String(this.getOptionValue(o)) === String(this.value));
    if (found) {
      return this.getOptionLabel(found);
    }
    return this.placeholder || 'Seleccionar...';
  }

  get hasSelection(): boolean {
    if (this.isEmpty(this.value)) {
      const emptyOpt = this.options?.find(o => this.isEmpty(this.getOptionValue(o)));
      return !!emptyOpt;
    }
    return this.options?.some(o => String(this.getOptionValue(o)) === String(this.value)) ?? false;
  }

  toggleDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.disabled) return;

    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    this.checkPlacement();
    this.isOpen = true;
    this.searchQuery = '';
    this.cdr.markForCheck();

    if (this.isSearchable) {
      setTimeout(() => {
        this.searchInputElement?.nativeElement?.focus();
      }, 50);
    }
  }

  closeDropdown(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.searchQuery = '';
    this.onTouched();
    this.cdr.markForCheck();
  }

  selectOption(opt: any, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const optValue = this.getOptionValue(opt);
    this.value = optValue;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.selectionChange.emit(opt);
    this.closeDropdown();
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.value = null;
    this.onChange(null);
    this.valueChange.emit(null);
    this.selectionChange.emit(null);
  }

  isSelected(opt: any): boolean {
    const optVal = this.getOptionValue(opt);
    if (this.isEmpty(this.value)) {
      return this.isEmpty(optVal);
    }
    if (this.isEmpty(optVal)) {
      return false;
    }
    return String(optVal) === String(this.value);
  }

  getOptionValue(opt: any): any {
    if (opt === null || opt === undefined) return null;
    if (typeof opt !== 'object') return opt;
    if (this.valueField && opt[this.valueField] !== undefined) return opt[this.valueField];
    if (opt.value !== undefined) return opt.value;
    if (opt.id !== undefined) return opt.id;
    if (opt.id_rol !== undefined) return opt.id_rol;
    if (opt.id_ingrediente !== undefined) return opt.id_ingrediente;
    if (opt.id_unidad_medida !== undefined) return opt.id_unidad_medida;
    if (opt.id_categoria_inventario !== undefined) return opt.id_categoria_inventario;
    if (opt.id_institucion !== undefined) return opt.id_institucion;
    if (opt.id_jornada !== undefined) return opt.id_jornada;
    if (opt.id_grado !== undefined) return opt.id_grado;
    return opt;
  }

  getOptionLabel(opt: any): string {
    if (opt === null || opt === undefined) return '';
    if (typeof opt !== 'object') return String(opt);
    if (this.labelField && opt[this.labelField] !== undefined) return String(opt[this.labelField]);
    if (opt.label !== undefined) return String(opt.label);
    if (opt.nombre_ingrediente !== undefined) return String(opt.nombre_ingrediente);
    if (opt.nombre_rol !== undefined) return String(opt.nombre_rol);
    if (opt.nombre_categoria !== undefined) return String(opt.nombre_categoria);
    if (opt.nombre_unidad !== undefined) return String(opt.nombre_unidad);
    if (opt.nombre_institucion !== undefined) return String(opt.nombre_institucion);
    if (opt.nombre_jornada !== undefined) return String(opt.nombre_jornada);
    if (opt.nombre_grado !== undefined) return String(opt.nombre_grado);
    if (opt.nombre !== undefined) return String(opt.nombre);
    if (opt.name !== undefined) return String(opt.name);
    if (opt.text !== undefined) return String(opt.text);
    return String(opt);
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  private checkPlacement(): void {
    if (!this.elementRef?.nativeElement) return;
    const rect = this.elementRef.nativeElement.getBoundingClientRect();

    // Comprobar espacio respecto al modal si está dentro de uno
    const modalBody = this.elementRef.nativeElement.closest('.bd-modal-body, .bd-modal, [role="dialog"], .modal-body');
    if (modalBody) {
      const modalRect = modalBody.getBoundingClientRect();
      const spaceBelowInModal = modalRect.bottom - rect.bottom;
      const spaceAboveInModal = rect.top - modalRect.top;
      // Si quedan menos de 210px abajo dentro del cuerpo del modal y hay espacio arriba, abrir hacia arriba
      if (spaceBelowInModal < 210 && spaceAboveInModal > 130) {
        this.openUpwards = true;
        return;
      }
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    this.openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }
}
