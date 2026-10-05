import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HabitacionesPage } from './habitaciones.page';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { SedeService } from '../../../application/sede.service';
import { FotoHabitacionService } from '../../../application/foto-habitacion.service';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import JSZip from 'jszip';

describe('HabitacionesPage', () => {
  let component: HabitacionesPage;
  let fixture: ComponentFixture<HabitacionesPage>;
  let authService: AuthService;
  let sedeService: SedeService;
  let inventarioService: InventarioService;

  beforeEach(async () => {
    localStorage.removeItem('hospal.inventario.insumos');
    localStorage.removeItem('hospal.inventario.habitaciones');
    await TestBed.configureTestingModule({
      imports: [HabitacionesPage],
      providers: [provideHttpClient()],
    }).compileComponents();

    sedeService = TestBed.inject(SedeService);
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

  it('creates one room with the selected typology and automatically assigns the next number when blank', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(2);
    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '106',
      tipo: 'Doble',
      tipologiaId: typology.id,
      estado: 'libre',
    }));
    expect(component.newRoomFormOpen()).toBeFalse();
  });

  it('creates one room with a manually entered number', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('208');
    component.createHabitacion();

    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '208',
      tipo: 'Doble',
      tipologiaId: typology.id,
    }));
    expect(component.newRoomError()).toBe('');
  });

  it('does not create a room with a duplicate number', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('105');
    component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(1);
    expect(component.newRoomError()).toBe('Ya existe una habitación con el número 105.');
    expect(component.newRoomFormOpen()).toBeTrue();
  });

  it('opens a room editor and assigns a registered supply to the room', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });
    const room = sedeService.habitaciones()[0];
    const insumo = inventarioService.addInsumo({
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
    component.assignInventoryToRoom();
    component.saveRoomChanges();

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

  it('keeps the editor open when the edited room number is already in use', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });
    sedeService.updateSelectedSede({
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
    component.saveRoomChanges();

    expect(component.roomFormError()).toBe('Ya existe una habitación con el número 106.');
    expect(component.editingRoomId()).toBe(10);
  });

  it('deletes a room only after confirming the action', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const room = sedeService.habitaciones()[0];

    component.openRoomEditor(room);
    component.deleteRoom();
    expect(sedeService.habitaciones()).toHaveSize(1);

    component.requestRoomDelete();
    component.deleteRoom();
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
