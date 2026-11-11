import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LocationsRepository } from '../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../locations/domain/testing/locations.repository.stub';
import { PosConfig, PosProviderInfo, PosRepository } from '../../domain/pos.repository';
import { PosLocalDriver, POS_LOCAL_DRIVERS } from '../../domain/pos-local-driver';
import { PosConfigModalComponent } from './pos-config-modal.component';

const PROVIDERS: PosProviderInfo[] = [
  {
    code: 'MERCADO_PAGO_POINT',
    nombre: 'Mercado Pago Point',
    descripcion: '',
    modo: 'nube',
    disponible: true,
    soportaCobros: true,
    etiquetas: [],
    campos: [
      { key: 'accessToken', label: 'Access Token', type: 'secret', required: true },
      { key: 'deviceId', label: 'Terminal', type: 'device', required: true },
    ],
  },
  {
    code: 'TRANSBANK_POS_INTEGRADO',
    nombre: 'Transbank POS Integrado',
    descripcion: '',
    modo: 'local',
    disponible: true,
    soportaCobros: true,
    etiquetas: [],
    campos: [{ key: 'puerto', label: 'Puerto', type: 'device', required: false }],
  },
  { code: 'MANUAL', nombre: 'Manual', descripcion: '', modo: 'nube', disponible: true, soportaCobros: false, etiquetas: [], campos: [] },
];

const SAVED: PosConfig = {
  sedeId: 1,
  configurado: true,
  proveedor: 'MERCADO_PAGO_POINT',
  activo: true,
  parametros: { deviceId: 'DEV-1' },
  credenciales: { accessToken: '••••••••1234' },
  actualizadoAt: null,
};

describe('PosConfigModalComponent', () => {
  let fixture: ComponentFixture<PosConfigModalComponent>;
  let component: PosConfigModalComponent;
  let repo: jasmine.SpyObj<PosRepository>;
  let driver: jasmine.SpyObj<PosLocalDriver>;

  beforeEach(async () => {
    repo = jasmine.createSpyObj<PosRepository>('PosRepository', [
      'listProviders',
      'getConfig',
      'saveConfig',
      'testConnection',
      'listDevices',
    ]);
    driver = jasmine.createSpyObj<PosLocalDriver>('PosLocalDriver', ['testConnection', 'listDevices', 'cobrar'], {
      code: 'TRANSBANK_POS_INTEGRADO',
    });
    repo.listProviders.and.returnValue(of(PROVIDERS));
    repo.getConfig.and.returnValue(of(SAVED));
    repo.saveConfig.and.callFake((_id, input) => of({ ...SAVED, activo: input.activo ?? false }));

    await TestBed.configureTestingModule({
      imports: [PosConfigModalComponent],
      providers: [
        { provide: PosRepository, useValue: repo },
        { provide: POS_LOCAL_DRIVERS, useValue: [driver] },
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PosConfigModalComponent);
    component = fixture.componentInstance;
    component.sedeId.set(1);
  });

  async function open(): Promise<void> {
    await component.onWillPresent();
    component.sedeId.set(1);
    await component.changeSede('1');
  }

  it('carga la configuración guardada sin exponer el secreto', async () => {
    await open();
    expect(component.proveedor()).toBe('MERCADO_PAGO_POINT');
    expect(component.stringValue('deviceId')).toBe('DEV-1');
    expect(component.stringValue('accessToken')).toBe('');
    expect(component.secretPlaceholder(PROVIDERS[0].campos[0])).toContain('1234');
  });

  it('no envía el token si el campo quedó vacío', async () => {
    await open();
    await component.save();
    expect(repo.saveConfig).toHaveBeenCalledWith(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      activo: true,
      credenciales: {},
      parametros: { deviceId: 'DEV-1' },
    });
    expect(component.successMessage()).toContain('activo');
  });

  it('envía el token nuevo y limpia campos al cambiar de proveedor', async () => {
    await open();
    component.setValue('accessToken', '  APP_USR-nuevo ');
    await component.save();
    expect(repo.saveConfig.calls.mostRecent().args[1].credenciales).toEqual({ accessToken: 'APP_USR-nuevo' });

    component.selectProvider('MANUAL');
    expect(component.fields()).toEqual([]);
    expect(component.secretPlaceholder(PROVIDERS[0].campos[0])).toBe('');
  });

  it('muestra el mensaje de error del backend', async () => {
    await open();
    repo.saveConfig.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Para activar el POS completa: Terminal.' } })),
    );
    await component.save();
    expect(component.errorMessage()).toBe('Para activar el POS completa: Terminal.');
  });

  it('avisa cuando no hay terminales', async () => {
    await open();
    repo.listDevices.and.returnValue(of([]));
    await component.loadDevices();
    expect(component.devicesError()).toContain('No se encontraron');
  });

  it('prueba y busca puertos con el conector local, sin llamar al backend', async () => {
    await open();
    component.selectProvider('TRANSBANK_POS_INTEGRADO');
    component.setValue('puerto', 'COM3');
    driver.testConnection.and.resolveTo({ ok: true, mensaje: 'Terminal Transbank conectado.' });
    driver.listDevices.and.resolveTo([{ id: 'COM3', nombre: 'COM3', disponible: true }]);

    await component.testConnection();
    await component.loadDevices();

    expect(component.isLocal()).toBeTrue();
    expect(driver.testConnection).toHaveBeenCalledWith({ puerto: 'COM3' });
    expect(repo.testConnection).not.toHaveBeenCalled();
    expect(repo.listDevices).not.toHaveBeenCalled();
    expect(component.testResult()?.ok).toBeTrue();
    expect(component.devices()?.length).toBe(1);
  });

  it('muestra el error del agente local al buscar puertos', async () => {
    await open();
    component.selectProvider('TRANSBANK_POS_INTEGRADO');
    driver.listDevices.and.rejectWith(new Error('No se pudo conectar con el Agente POS'));

    await component.loadDevices();

    expect(component.devicesError()).toContain('Agente POS');
  });
});
