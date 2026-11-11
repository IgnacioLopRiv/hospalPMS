import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosProviderInfo } from '../../domain/pos.repository';
import { PosProviderPickerComponent } from './pos-provider-picker.component';

const PROVIDERS: PosProviderInfo[] = [
  {
    code: 'MERCADO_PAGO_POINT',
    nombre: 'Mercado Pago Point',
    descripcion: 'Point Smart',
    modo: 'nube',
    disponible: true,
    soportaCobros: true,
    etiquetas: ['mercadolibre'],
    campos: [],
  },
  {
    code: 'TRANSBANK_POS_INTEGRADO',
    nombre: 'Transbank POS Integrado',
    descripcion: 'Terminal por USB',
    modo: 'local',
    disponible: true,
    soportaCobros: true,
    etiquetas: ['redcompra'],
    campos: [],
  },
  {
    code: 'GETNET',
    nombre: 'Getnet (Santander)',
    descripcion: 'Terminales Getnet',
    modo: 'nube',
    disponible: false,
    soportaCobros: false,
    nota: 'Requiere convenio.',
    etiquetas: ['santander'],
    campos: [],
  },
];

describe('PosProviderPickerComponent', () => {
  let fixture: ComponentFixture<PosProviderPickerComponent>;
  let component: PosProviderPickerComponent;
  let chosen: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PosProviderPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(PosProviderPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('providers', PROVIDERS);
    fixture.componentRef.setInput('value', 'MERCADO_PAGO_POINT');
    chosen = [];
    component.selected.subscribe((code) => chosen.push(code));
    fixture.detectChanges();
  });

  const key = (k: string) => component.onKeydown(new KeyboardEvent('keydown', { key: k }));

  it('muestra el proveedor seleccionado', () => {
    expect(fixture.nativeElement.querySelector('.trigger-name').textContent).toContain('Mercado Pago Point');
  });

  it('filtra por nombre, etiquetas y sin importar tildes', () => {
    component.openPanel();
    component.onQuery('mercadolibre');
    expect(component.filtered().map((p) => p.code)).toEqual(['MERCADO_PAGO_POINT']);
    component.onQuery('REDCÓMPRA');
    expect(component.filtered().map((p) => p.code)).toEqual(['TRANSBANK_POS_INTEGRADO']);
    component.onQuery('zzz');
    expect(component.filtered()).toEqual([]);
  });

  it('se navega con teclado y elige con Enter', () => {
    component.openPanel();
    key('ArrowDown');
    key('Enter');
    expect(chosen).toEqual(['TRANSBANK_POS_INTEGRADO']);
    expect(component.open()).toBeFalse();
  });

  it('no permite elegir proveedores no disponibles', () => {
    component.openPanel();
    component.choose(PROVIDERS[2]);
    expect(chosen).toEqual([]);
    expect(component.open()).toBeTrue();

    fixture.detectChanges();
    const note = fixture.nativeElement.querySelector('.option-note');
    expect(note.textContent).toContain('Requiere convenio.');
  });

  it('cierra con Escape sin elegir', () => {
    component.openPanel();
    key('Escape');
    expect(component.open()).toBeFalse();
    expect(chosen).toEqual([]);
  });
});
