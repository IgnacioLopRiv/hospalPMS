import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HabitacionesPage } from './habitaciones.page';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { SedeService } from '../../../application/sede.service';
import { FotoHabitacionService } from '../../../application/foto-habitacion.service';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import { InventarioRepository } from '../../../../inventory/domain/inventario.repository';
import { LocationsRepository } from '../../../domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../domain/testing/locations.repository.stub';
import { FotoHabitacionRepository } from '../../../domain/foto-habitacion.repository';
import { of } from 'rxjs';
import JSZip from 'jszip';

describe('HabitacionesPage', () => {
  let component: HabitacionesPage;
  let fixture: ComponentFixture<HabitacionesPage>;
  let authService: AuthService;
  let sedeService: SedeService;
  let inventarioService: InventarioService;

  beforeEach(async () => {
    const supplies: { id: number; sedeId: number; nombre: string; descripcion: string | null; costoCompra: number; stockActual: number; stockMinimo: number; activo: boolean }[] = [];
    const assignments: { id: number; insumoId: number; habitacionId: number; cantidad: number; estado: string; fechaAsignacion: string }[] = [];
    const inventarioRepository = {
      listSupplies: () => of(supplies),
      listRoomAssignments: () => of(assignments),
      createSupply: (data: typeof supplies[number]) => {
        const saved = { ...data, id: supplies.length + 1 };
        supplies.push(saved);
        return of(saved);
      },
      updateSupply: (id: number, data: Partial<typeof supplies[number]>) => {
        const index = supplies.findIndex((item) => item.id === id);
        supplies[index] = { ...supplies[index], ...data };
        return of(supplies[index]);
      },
      deleteSupply: (id: number) => {
        const index = supplies.findIndex((item) => item.id === id);
        supplies.splice(index, 1);
        return of(undefined);
      },
      createRoomAssignment: (data: Omit<typeof assignments[number], 'id' | 'fechaAsignacion'>) => {
        const saved = { ...data, id: assignments.length + 1, fechaAsignacion: new Date().toISOString() };
        assignments.push(saved);
        return of(saved);
      },
      updateRoomAssignment: (id: number, data: Partial<Pick<typeof assignments[number], 'cantidad' | 'estado'>>) => {
        const index = assignments.findIndex((item) => item.id === id);
        assignments[index] = { ...assignments[index], ...data };
        return of(assignments[index]);
      },
    };
    localStorage.removeItem('hospal.inventario.insumos');
    localStorage.removeItem('hospal.inventario.habitaciones');
    await TestBed.configureTestingModule({
      imports: [HabitacionesPage],
      providers: [
        provideHttpClient(),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
        { provide: InventarioRepository, useValue: inventarioRepository },
        {
          provide: FotoHabitacionRepository,
          useValue: {
            listPhotos: () => of([]),
            createPhoto: (_habitacionId: number, data: { url: string; titulo?: string; descripcion?: string }) => of({
              id: 1,
              habitacionId: 1,
              url: data.url,
              titulo: data.titulo,
              descripcion: data.descripcion,
              fechaSubida: new Date().toISOString(),
            }),
            deletePhoto: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    sedeService = TestBed.inject(SedeService);
    await sedeService.ready;
    inventarioService = TestBed.inject(InventarioService);
    sedeService.selectedSede.set({
      id: 1,
      nombre: 'Hostal Playa',
      ciudad: 'Viña del Mar',
      tipologias: [],
      habitaciones: [{
        id: 10,
        numero: '105',
        tipo: 'Doble',
        tamanoM2: 22,
        disposicionMuebles: '1 Cama Matrimonial',
        estado: 'libre',
      }],
    });
    fixture = TestBed.createComponent(HabitacionesPage);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
    localStorage.removeItem('hospal_fotos_habitaciones');
    localStorage.removeItem('hospal.inventario.insumos');
    localStorage.removeItem('hospal.inventario.habitaciones');
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the room typology color and the corresponding guest capacity on its card', () => {
    sedeService.selectedSede.update((sede) => ({
      ...sede!,
      tipologias: [{
        id: 1,
        nombre: 'Doble',
        capacidad: 2,
        color: '#aa3366',
      }],
      habitaciones: [{
        ...sede!.habitaciones[0],
        tipologiaId: 1,
      }],
    }));
    fixture.detectChanges();

    const capacity = fixture.nativeElement.querySelector('.room-header-capacity') as HTMLElement;
    const typology = fixture.nativeElement.querySelector('.badge-tipo') as HTMLElement;
    const labels = [...fixture.nativeElement.querySelectorAll('dt')].map((label: HTMLElement) => label.textContent.trim());
    const titleLine = fixture.nativeElement.querySelector('.room-title-line') as HTMLElement;

    expect(typology.textContent.trim()).toBe('Doble');
    expect(typology.style.getPropertyValue('--typology-color')).toBe('#aa3366');
    expect(labels).toContain('Tipología');
    expect(labels).not.toContain('Personas');
    expect(capacity.textContent).toContain('2 personas');
    expect(capacity.querySelector('ion-icon[name="person-outline"]')).not.toBeNull();
    expect(titleLine.contains(capacity)).toBeTrue();
  });

  it('displays room status without manual state change action buttons', () => {
    const card = fixture.nativeElement.querySelector('.room-summary') as HTMLElement;
    expect(card).not.toBeNull();
    const statusTab = card.querySelector('.room-status-tab') as HTMLElement;
    expect(statusTab).not.toBeNull();
    expect(statusTab.querySelector('.status-name')?.textContent?.trim()).toBe('Libre');
    expect(card.querySelector('.status-tab-actions')).toBeNull();
    expect(card.querySelector('.btn-tab-action')).toBeNull();
  });

  it('should not open the new room modal when user is not admin', () => {
    authService.currentUser.set({
      id: 2,
      name: 'Recepcionista',
      email: 'recepcion@hostal.cl',
      role: 'staff',
    });

    component.openNewRoomForm();
    expect(component.newRoomFormOpen()).toBeFalse();
  });

  it('should open the new room modal when user is admin', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });

    component.openNewRoomForm();
    expect(component.newRoomFormOpen()).toBeTrue();
  });

  it('opens the typology manager from the rooms page for administrators', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });

    component.openEditTipologias();

    expect(component.editTipologiasOpen()).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn-manage-typologies')).not.toBeNull();
  });

  it('does not open the typology manager for non-admin users', () => {
    authService.currentUser.set({
      id: 2,
      name: 'Recepcionista',
      email: 'recepcion@hostal.cl',
      role: 'staff',
    });

    component.openEditTipologias();

    expect(component.editTipologiasOpen()).toBeFalse();
  });

  it('keeps the new room modal open when clicking outside it', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openNewRoomForm();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.new-room-modal-backdrop') as HTMLElement).click();
    fixture.detectChanges();

    expect(component.newRoomFormOpen()).toBeTrue();
  });

  it('keeps the room editor open when clicking outside it', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openRoomEditor(sedeService.habitaciones()[0]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.room-detail-modal-backdrop') as HTMLElement).click();
    fixture.detectChanges();

    expect(component.editingRoomId()).toBe(10);
  });

  it('creates one room with the selected typology and automatically assigns the next number when blank', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = await sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    await component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(2);
    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '106',
      tipo: 'Doble',
      tipologiaId: typology.id,
      estado: 'libre',
    }));
    expect(component.newRoomFormOpen()).toBeFalse();
  });

  it('creates one room with a manually entered number', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = await sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('208');
    await component.createHabitacion();

    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '208',
      tipo: 'Doble',
      tipologiaId: typology.id,
    }));
    expect(component.newRoomError()).toBe('');
  });

  it('does not create a room with a duplicate number', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    await sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('105');
    await component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(1);
    expect(component.newRoomError()).toBe('Ya existe una habitación con el número 105.');
    expect(component.newRoomFormOpen()).toBeTrue();
  });

  it('opens a room editor and assigns a registered supply to the room', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = await sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });
    const room = sedeService.habitaciones()[0];
    const insumo = await inventarioService.addInsumo({
      nombre_insumo: 'Lámpara',
      descripcion: '',
      costo_compra: 5000,
      stock_actual: 4,
      stock_minimo: 1,
      producto_activo: true,
    });

    component.openRoomEditor(room);
    component.roomNumber = '107';
    component.roomTypologyId = typology.id;
    component.roomSize = '24';
    component.roomFurniture = 'Dos camas individuales';
    component.roomDescription = 'Habitación con vista al mar';
    component.selectedInventorySupplyId.set(insumo.id_insumo);
    component.inventoryQuantity.set(2);
    await component.assignInventoryToRoom();
    await component.saveRoomChanges();

    expect(sedeService.habitaciones()[0]).toEqual(jasmine.objectContaining({
      numero: '107',
      tamanoM2: 24,
      disposicionMuebles: 'Dos camas individuales',
      descripcion: 'Habitación con vista al mar',
    }));
    expect(inventarioService.habitacionesAsignadas()[0]).toEqual(jasmine.objectContaining({
      id_insumo: insumo.id_insumo,
      id_habitacion: room.id,
      cantidad: 2,
    }));
    expect(component.editingRoomId()).toBeNull();
  });

  it('keeps the editor open when the edited room number is already in use', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = await sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });
    await sedeService.updateSelectedSede({
      nombre: 'Hostal Playa',
      habitaciones: [...sedeService.habitaciones(), {
        id: 11,
        numero: '106',
        tipo: 'Doble',
        tipologiaId: typology.id,
        tamanoM2: 22,
        disposicionMuebles: '1 Cama Matrimonial',
      }],
    });

    component.openRoomEditor(sedeService.habitaciones()[0]);
    component.roomNumber = '106';
    component.roomTypologyId = typology.id;
    await component.saveRoomChanges();

    expect(component.roomFormError()).toBe('Ya existe una habitación con el número 106.');
    expect(component.editingRoomId()).toBe(10);
  });

  it('deletes a room only after confirming the action', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const room = sedeService.habitaciones()[0];

    component.openRoomEditor(room);
    await component.deleteRoom();
    expect(sedeService.habitaciones()).toHaveSize(1);

    component.requestRoomDelete();
    await component.deleteRoom();
    expect(sedeService.habitaciones()).toHaveSize(0);
  });

  it('shows the selected room photo gallery from the room editor', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openRoomEditor(sedeService.habitaciones()[0]);
    fixture.detectChanges();

    const photosTab = fixture.nativeElement.querySelector('.room-detail-tabs button:last-child') as HTMLButtonElement;
    photosTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no hay fotos');
    expect(fixture.nativeElement.querySelector('input[type="file"][accept="image/*"]')).toBeTruthy();
    const uploadButton = fixture.nativeElement.querySelector('.btn-photo-action') as HTMLElement;
    const fileInput = fixture.nativeElement.querySelector('.room-photo-file-input') as HTMLInputElement;
    expect(getComputedStyle(uploadButton).backgroundColor).toBe('rgb(30, 80, 216)');
    expect(getComputedStyle(uploadButton).color).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(fileInput).display).toBe('none');
    const emptyState = fixture.nativeElement.querySelector('.room-photos-empty') as HTMLElement;
    expect(getComputedStyle(emptyState).display).toBe('grid');
    expect(getComputedStyle(emptyState).gap).toBe('8.8px');
  });

  it('keeps a selected photo as a temporary preview until explicitly saved', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const previewUrl = 'blob:temporary-room-photo';
    spyOn(URL, 'createObjectURL').and.returnValue(previewUrl);
    spyOn(URL, 'revokeObjectURL');
    component.openRoomEditor(sedeService.habitaciones()[0]);
    component.roomDetailTab.set('photos');
    const file = new File(['image'], 'habitacion.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.selectRoomPhoto({ target: input } as unknown as Event);
    fixture.detectChanges();

    expect(component.photoPreviewUrl()).toBe(previewUrl);
    expect(localStorage.getItem('hospal_fotos_habitaciones')).toBeNull();
    const dismissButton = fixture.nativeElement.querySelector('.room-photo-preview-actions .btn-photo-discard') as HTMLButtonElement;
    const uploadButton = fixture.nativeElement.querySelector('.room-photo-preview-actions .btn-photo-save') as HTMLButtonElement;
    expect(getComputedStyle(dismissButton).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(dismissButton).color).toBe('rgb(51, 65, 85)');
    expect(getComputedStyle(dismissButton).borderRadius).toBe('8px');
    expect(getComputedStyle(uploadButton).backgroundColor).toBe('rgb(30, 80, 216)');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.room-photo-preview-actions')).gap).toBe('12px');
    component.discardPhotoPreview();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUrl);
  });

  it('opens and closes the selected photo in the lightbox', () => {
    const photo = {
      id: 'photo-1',
      habitacionId: 10,
      url: 'data:image/jpeg;base64,abc',
      titulo: 'Vista al mar',
      fechaSubida: '2026-10-05T00:00:00.000Z',
    };

    component.openPhotoLightbox(photo);
    expect(component.lightboxPhoto()).toEqual(photo);

    component.closePhotoLightbox();
    expect(component.lightboxPhoto()).toBeNull();
  });

  it('renders uploaded room photos as compact grid cards with styled delete actions', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openRoomEditor(sedeService.habitaciones()[0]);
    component.roomDetailTab.set('photos');
    const photoService = TestBed.inject(FotoHabitacionService);
    spyOn(photoService, 'forRoom').and.returnValue([{
      id: 'photo-1',
      habitacionId: 10,
      url: 'data:image/jpeg;base64,abc',
      titulo: 'Dormitorio',
      descripcion: 'Cama y ventana',
      fechaSubida: '2026-10-05T00:00:00.000Z',
    }]);
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.room-photo-grid') as HTMLElement;
    const image = fixture.nativeElement.querySelector('.room-photo-image-button img') as HTMLImageElement;
    const deleteButton = fixture.nativeElement.querySelector('.btn-remove-room-photo') as HTMLButtonElement;

    expect(getComputedStyle(grid).display).toBe('grid');
    const columnWidths = getComputedStyle(grid).gridTemplateColumns
      .split(' ')
      .map((width) => Number.parseFloat(width));
    expect(columnWidths.length).toBeGreaterThan(1);
    expect(columnWidths.every((width) => width >= 140)).toBeTrue();
    expect(getComputedStyle(image).height).toBe('112px');
    expect(getComputedStyle(deleteButton).backgroundColor).toBe('rgba(239, 68, 68, 0.1)');
    expect(getComputedStyle(deleteButton).color).toBe('rgb(239, 68, 68)');
    expect(getComputedStyle(deleteButton).borderRadius).toBe('999px');
  });

  it('downloads all room photos in a ZIP and offers styled individual copy buttons', async () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openRoomEditor(sedeService.habitaciones()[0]);
    component.roomDetailTab.set('photos');
    const photos = [
      {
        id: 'photo-1',
        habitacionId: 10,
        url: 'data:image/jpeg;base64,one',
        titulo: 'Dormitorio',
        descripcion: 'Cama y ventana',
        fechaSubida: '2026-10-05T00:00:00.000Z',
      },
      {
        id: 'photo-2',
        habitacionId: 10,
        url: 'data:image/jpeg;base64,two',
        titulo: 'Baño',
        descripcion: 'Ducha',
        fechaSubida: '2026-10-05T00:00:00.000Z',
      },
    ];
    spyOn(TestBed.inject(FotoHabitacionService), 'forRoom').and.returnValue(photos);
    spyOn(window, 'fetch').and.callFake(async (input) =>
      new Response(new Blob([String(input)], { type: 'image/jpeg' }), { status: 200 })
    );
    let generatedZip: Blob | undefined;
    spyOn(URL, 'createObjectURL').and.callFake((blob) => {
      generatedZip = blob as Blob;
      return 'blob:photos.zip';
    });
    const downloadClick = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('fotos-habitacion-105.zip');
    });
    fixture.detectChanges();

    await component.downloadAllRoomPhotos();

    expect(downloadClick).toHaveBeenCalledTimes(1);
    expect(generatedZip).toBeTruthy();
    expect(component.photoNoticeTitle()).toBe('Imágenes descargadas');
    expect(component.photoNotice()).toBe('Abre la carpeta comprimida para encontrar las imágenes.');
    fixture.detectChanges();
    const downloadNotice = fixture.nativeElement.querySelector('.room-photo-notice') as HTMLElement;
    expect(downloadNotice.querySelector('strong')?.textContent).toBe('Imágenes descargadas');
    expect(downloadNotice.textContent).toContain('Abre la carpeta comprimida para encontrar las imágenes.');
    expect(getComputedStyle(downloadNotice).backgroundColor).toBe('rgb(243, 251, 243)');
    expect(getComputedStyle(downloadNotice).borderTopColor).toBe('rgb(76, 175, 80)');
    expect(getComputedStyle(downloadNotice).position).toBe('fixed');
    expect(Number(getComputedStyle(downloadNotice).zIndex)).toBeGreaterThan(10001);
    expect(getComputedStyle(downloadNotice).boxShadow).not.toBe('none');
    expect(getComputedStyle(downloadNotice.querySelector('.room-photo-notice-icon') as HTMLElement).color)
      .toBe('rgb(46, 125, 50)');
    expect(downloadNotice.querySelector('button[aria-label="Cerrar aviso"]')).toBeTruthy();
    const zip = await JSZip.loadAsync(generatedZip as Blob);
    const zipFiles = Object.keys(zip.files).filter((fileName) => !zip.files[fileName].dir);
    expect(zipFiles).toEqual([
      'habitacion-105/01-Dormitorio.jpg',
      'habitacion-105/02-Bano.jpg',
    ]);
    expect(await zip.file(zipFiles[0])?.async('string')).toBe('data:image/jpeg;base64,one');
    expect(await zip.file(zipFiles[1])?.async('string')).toBe('data:image/jpeg;base64,two');

    const downloadButton = fixture.nativeElement.querySelector('.btn-download-room-photos') as HTMLButtonElement;
    expect(downloadButton.textContent).toContain('Descargar todas (ZIP)');
    expect(getComputedStyle(downloadButton).backgroundColor).toBe('rgb(30, 80, 216)');
    expect(getComputedStyle(downloadButton).color).toBe('rgb(255, 255, 255)');
    const copyButton = fixture.nativeElement.querySelector('.btn-copy-room-photo') as HTMLButtonElement;
    expect(getComputedStyle(copyButton).backgroundColor).toBe('rgb(30, 80, 216)');
    expect(getComputedStyle(copyButton).color).toBe('rgb(255, 255, 255)');
    const copyPhoto = spyOn(component, 'copyRoomPhoto').and.resolveTo();
    copyButton.click();
    expect(copyPhoto).toHaveBeenCalledOnceWith(photos[0]);
    expect(component.lightboxPhoto()).toBeNull();
  });

  it('closes the photo notification after five seconds', fakeAsync(() => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    component.openRoomEditor(sedeService.habitaciones()[0]);
    component.roomDetailTab.set('photos');
    component['setPhotoNotice']('Prueba de notificación', false, 'Imágenes descargadas');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-photo-notice')).toBeTruthy();

    tick(4999);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-photo-notice')).toBeTruthy();

    component.closeRoomEditor();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-photo-notice')).toBeTruthy();

    tick(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-photo-notice')).toBeNull();
  }));
});
