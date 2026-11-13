import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, computed, inject, signal, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bedOutline,
  businessOutline,
  checkmarkCircleOutline,
  closeOutline,
  personOutline,
  timeOutline,
  waterOutline,
  refreshOutline,
  createOutline,
  trashOutline,
  cubeOutline,
  cameraOutline,
  imagesOutline,
  copyOutline,
  downloadOutline,
  returnUpBackOutline,
  pricetagsOutline,
  constructOutline,
  documentTextOutline,
} from 'ionicons/icons';
import JSZip from 'jszip';
import { firstValueFrom } from 'rxjs';
import { Habitacion, SedeService, EstadoHabitacion, SedeTipologia } from '../../../application/sede.service';
import { FotoHabitacionService } from '../../../application/foto-habitacion.service';
import { FotoHabitacion } from '../../../domain/foto-habitacion.model';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { useEffect } from '../../../../../shared/presentation/clock/clock.component';
import { getApiErrorMessage } from '../../../../../shared/domain/api-error-message';
import {
  AsignacionInventarioHabitacion,
  InsumoInventario,
  InventarioService,
} from '../../../../inventory/application/inventario.service';
import { EditTipologiasComponent } from '../../edit-tipologias/edit-tipologias.component';
import { MantenimientoHabitacionHttpRepository } from '../../../infraestructure/mantenimiento-habitacion-http.repository';
import {
  MantenimientoHabitacion,
  MOTIVOS_MANTENIMIENTO,
} from '../../../domain/mantenimiento-habitacion.model';
import { ModalPortalDirective } from '../../../../../shared/presentation/modal-portal/modal-portal.directive';

interface ArticuloInventarioHabitacion {
  asignacion: AsignacionInventarioHabitacion;
  insumo: InsumoInventario;
}

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss', './habitaciones-modal.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, CommonModule, FormsModule, IonIcon, EditTipologiasComponent, ModalPortalDirective],
})
export class HabitacionesPage implements OnDestroy {
  private photoNoticeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly sedeService = inject(SedeService);
  private readonly authService = inject(AuthService);
  private readonly fotoHabitacionService = inject(FotoHabitacionService);
  private readonly inventarioService = inject(InventarioService);
  private readonly mantenimientoRepository = inject(MantenimientoHabitacionHttpRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
  readonly tipologias = this.sedeService.tipologias;
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  readonly editTipologiasOpen = signal(false);
  readonly newRoomFormOpen = signal(false);
  readonly newRoomTypologyId = signal<number | null>(null);
  readonly newRoomNumber = signal('');
  readonly newRoomError = signal('');
  readonly editingRoomId = signal<number | null>(null);
  readonly editingRoom = computed(() =>
    this.habitaciones().find((room) => room.id === this.editingRoomId()) ?? null
  );
  /** Fase actual del asistente de nueva habitación (1 datos, 2 fotos, 3 inventario). */
  readonly newRoomStep = signal<1 | 2 | 3>(1);
  /** Habitación ya creada por el asistente (disponible desde la fase 2). */
  readonly wizardRoomId = signal<number | null>(null);
  readonly creatingRoom = signal(false);
  /** Habitación sobre la que operan los paneles de fotos e inventario. */
  readonly targetRoomId = computed(() => this.editingRoomId() ?? this.wizardRoomId());
  readonly targetRoom = computed(() =>
    this.habitaciones().find((room) => room.id === this.targetRoomId()) ?? null
  );
  readonly roomDetailTab = signal<'details' | 'inventory' | 'photos'>('details');
  readonly roomFormError = signal('');
  readonly inventoryFormError = signal('');
  readonly insumosInventario = this.inventarioService.insumos;
  readonly insumosActivos = computed(() => this.insumosInventario().filter((insumo) => insumo.producto_activo));
  readonly roomInventory = computed<ArticuloInventarioHabitacion[]>(() => {
    const roomId = this.targetRoomId();
    if (roomId === null) return [];
    const insumos = new Map(this.insumosInventario().map((insumo) => [insumo.id_insumo, insumo]));
    return this.inventarioService.habitacionesAsignadas()
      .filter((asignacion) => asignacion.id_habitacion === roomId && asignacion.estado === 'ACTIVO')
      .flatMap((asignacion) => {
        const insumo = insumos.get(asignacion.id_insumo);
        return insumo ? [{ asignacion, insumo }] : [];
      });
  });
  readonly selectedInventorySupplyId = signal<number | null>(null);
  readonly inventoryQuantity = signal<number | null>(1);
  readonly confirmRoomDelete = signal(false);
  readonly roomPhotos = computed(() => {
    const roomId = this.targetRoomId();
    return roomId === null ? [] : this.fotoHabitacionService.forRoom(roomId);
  });
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly photoNotice = signal('');
  readonly photoNoticeTitle = signal('');
  readonly photoNoticeIsError = signal(false);
  readonly savingPhoto = signal(false);
  readonly downloadingPhotos = signal(false);
  readonly lightboxPhoto = signal<FotoHabitacion | null>(null);
  selectedPhotoFile: File | null = null;
  photoTitle = '';
  photoDescription = '';
  roomNumber: string | number = '';
  roomTypologyId: number | null = null;
  roomSize: string | number | null = '';
  newRoomSize: string | number | null = '';
  newRoomFurniture = '';
  newRoomDescription = '';
  roomFurniture = '';
  roomDescription = '';

  // Señal de tick en vivo para actualizar tiempos relativos de aseo
  readonly liveTick = signal<number>(Date.now());

  // Botón "Terminar aseo" (disponible para todos los roles)
  readonly finishingCleaningRoomId = signal<number | null>(null);
  readonly cleaningError = signal<{ roomId: number; message: string } | null>(null);

  // Métricas de estado en tiempo real
  readonly totalLibres = computed(() =>
    this.habitaciones().filter((h) => (h.estado || 'libre') === 'libre').length
  );
  readonly totalOcupadas = computed(() =>
    this.habitaciones().filter((h) => h.estado === 'ocupada').length
  );
  readonly totalEnAseo = computed(() =>
    this.habitaciones().filter((h) => h.estado === 'en aseo').length
  );
  readonly totalMantenimiento = computed(() =>
    this.habitaciones().filter((h) => h.estado === 'mantenimiento').length
  );
  readonly updatingMaintenance = signal(false);

  // Formulario "Pasar a mantenimiento"
  readonly motivosMantenimiento = MOTIVOS_MANTENIMIENTO;
  readonly maintenanceFormOpen = signal(false);
  readonly maintenanceMotivo = signal('');
  readonly maintenanceMotivoOtro = signal('');
  readonly maintenanceDescripcion = signal('');
  readonly maintenanceFormError = signal('');

  // Historial de mantenimientos
  readonly maintenanceHistoryOpen = signal(false);
  readonly maintenanceHistory = signal<MantenimientoHabitacion[]>([]);
  readonly maintenanceHistoryLoading = signal(false);
  readonly maintenanceHistoryError = signal('');
  readonly maintenanceHistoryFilter = signal<'todos' | 'en-curso' | 'finalizados'>('todos');
  readonly maintenanceHistoryRoom = signal<string>('');
  readonly filteredMaintenanceHistory = computed(() => {
    const filter = this.maintenanceHistoryFilter();
    const room = this.maintenanceHistoryRoom();
    return this.maintenanceHistory().filter((item) =>
      (filter === 'todos'
        || (filter === 'en-curso' && !item.fechaTermino)
        || (filter === 'finalizados' && !!item.fechaTermino))
      && (!room || item.habitacionNumero === room)
    );
  });
  readonly maintenanceHistoryRooms = computed(() =>
    Array.from(new Set(this.maintenanceHistory().map((item) => item.habitacionNumero)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  );

  constructor() {
    addIcons({
      addOutline,
      bedOutline,
      businessOutline,
      closeOutline,
      checkmarkCircleOutline,
      personOutline,
      timeOutline,
      waterOutline,
      refreshOutline,
      createOutline,
      trashOutline,
      cubeOutline,
      cameraOutline,
      imagesOutline,
      copyOutline,
      downloadOutline,
      returnUpBackOutline,
      pricetagsOutline,
      constructOutline,
      documentTextOutline,
    });

    // Tick en vivo para el tiempo transcurrido de aseo. El aseo solo termina manualmente
    // con el botón "Terminar aseo"; no hay liberación automática.
    useEffect(() => {
      const interval = setInterval(() => this.liveTick.set(Date.now()), 5000);

      return () => {
        clearInterval(interval);
      };
    }, this.destroyRef);
  }

  ngOnDestroy(): void {
    this.discardPhotoPreview();
    this.clearPhotoNoticeTimeout();
  }

  openNewRoomForm(): void {
    if (!this.isAdmin()) {
      return;
    }
    const tipologia = this.tipologias()[0];
    this.newRoomTypologyId.set(tipologia?.id ?? null);
    this.newRoomNumber.set('');
    this.applyNewRoomDefaults(tipologia?.capacidad);
    this.newRoomDescription = '';
    this.newRoomError.set('');
    this.newRoomStep.set(1);
    this.wizardRoomId.set(null);
    this.discardPhotoPreview();
    this.lightboxPhoto.set(null);
    this.inventoryFormError.set('');
    this.selectedInventorySupplyId.set(this.insumosActivos()[0]?.id_insumo ?? null);
    this.inventoryQuantity.set(1);
    this.newRoomFormOpen.set(true);
  }

  closeNewRoomForm(): void {
    this.discardPhotoPreview();
    this.lightboxPhoto.set(null);
    this.newRoomFormOpen.set(false);
    this.wizardRoomId.set(null);
    this.newRoomStep.set(1);
  }

  goToNewRoomStep(step: 2 | 3): void {
    if (this.wizardRoomId() === null) {
      return;
    }
    this.discardPhotoPreview();
    this.lightboxPhoto.set(null);
    this.newRoomStep.set(step);
  }

  openEditTipologias(): void {
    if (this.isAdmin()) {
      this.editTipologiasOpen.set(true);
    }
  }

  closeEditTipologias(): void {
    this.editTipologiasOpen.set(false);
  }

  openRoomEditor(room: Habitacion): void {
    if (!this.isAdmin()) {
      return;
    }
    this.discardPhotoPreview();
    this.editingRoomId.set(room.id);
    this.roomDetailTab.set('details');
    this.roomFormError.set('');
    this.inventoryFormError.set('');
    this.confirmRoomDelete.set(false);
    this.lightboxPhoto.set(null);
    this.roomNumber = room.numero;
    this.roomTypologyId = room.tipologiaId ??
      this.tipologias().find((typology) =>
        typology.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase()
      )?.id ?? null;
    this.roomSize = room.tamanoM2 === null ? '' : String(room.tamanoM2);
    this.roomFurniture = room.disposicionMuebles;
    this.roomDescription = room.descripcion ?? '';
    this.selectedInventorySupplyId.set(this.insumosActivos()[0]?.id_insumo ?? null);
    this.inventoryQuantity.set(1);
  }

  closeRoomEditor(): void {
    this.discardPhotoPreview();
    this.editingRoomId.set(null);
    this.confirmRoomDelete.set(false);
  }

  selectRoomPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.setPhotoNotice('Selecciona un archivo de imagen válido.', true);
      return;
    }
    this.discardPhotoPreview();
    this.selectedPhotoFile = file;
    this.photoPreviewUrl.set(URL.createObjectURL(file));
    this.photoTitle = file.name.replace(/\.[^.]+$/, '');
    this.photoDescription = '';
    this.setPhotoNotice('');
  }

  async saveRoomPhoto(): Promise<void> {
    const room = this.targetRoom();
    if (!this.isAdmin() || !room || !this.selectedPhotoFile || this.savingPhoto()) {
      return;
    }
    this.savingPhoto.set(true);
    this.setPhotoNotice('');
    try {
      await this.fotoHabitacionService.addPhoto({
        habitacionId: room.id,
        file: this.selectedPhotoFile,
        titulo: this.photoTitle,
        descripcion: this.photoDescription,
      });
      this.discardPhotoPreview();
      this.setPhotoNotice('Foto guardada correctamente.');
    } catch (error) {
      this.setPhotoNotice(
        error instanceof Error ? error.message : 'No se pudo guardar la foto.',
        true
      );
    } finally {
      this.savingPhoto.set(false);
    }
  }

  discardPhotoPreview(): void {
    const previewUrl = this.photoPreviewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    this.photoPreviewUrl.set(null);
    this.selectedPhotoFile = null;
    this.photoTitle = '';
    this.photoDescription = '';
  }

  removeRoomPhoto(photo: FotoHabitacion): void {
    if (!this.isAdmin()) {
      return;
    }
    try {
      this.fotoHabitacionService.removePhoto(photo.id);
      this.setPhotoNotice('Foto eliminada.');
    } catch (error) {
      this.setPhotoNotice(
        error instanceof Error ? error.message : 'No se pudo eliminar la foto.',
        true
      );
    }
  }

  async downloadAllRoomPhotos(): Promise<void> {
    const photos = this.roomPhotos();
    if (photos.length === 0) {
      this.setPhotoNotice('Esta habitación todavía no tiene fotos para descargar.', true);
      return;
    }
    if (this.downloadingPhotos()) {
      return;
    }

    this.downloadingPhotos.set(true);
    try {
      const room = this.targetRoom();
      const zip = new JSZip();
      const folder = zip.folder(`habitacion-${this.sanitizeFileName(room?.numero ?? 'habitacion')}`);
      if (!folder) {
        throw new Error('No se pudo preparar la carpeta de descarga.');
      }

      const imageBlobs = await Promise.all(photos.map(async (photo) => {
        const response = await fetch(photo.url);
        if (!response.ok) {
          throw new Error(`No se pudo descargar la foto "${photo.titulo || 'Foto de habitación'}".`);
        }
        return response.blob();
      }));
      imageBlobs.forEach((blob, index) => {
        folder.file(this.createPhotoFileName(photos[index], index, blob.type), blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      try {
        link.href = downloadUrl;
        link.download = `fotos-habitacion-${this.sanitizeFileName(room?.numero ?? 'habitacion')}.zip`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      this.setPhotoNotice(
        'Abre la carpeta comprimida para encontrar las imágenes.',
        false,
        'Imágenes descargadas'
      );
    } catch (error) {
      this.setPhotoNotice(
        error instanceof Error
          ? `No se pudieron descargar todas las fotos: ${error.message}`
          : 'No se pudo generar el archivo ZIP de fotos.',
        true
      );
    } finally {
      this.downloadingPhotos.set(false);
    }
  }

  async copyRoomPhoto(photo: FotoHabitacion): Promise<void> {
    try {
      await this.writeImageToClipboard(photo);
      this.setPhotoNotice('Imagen copiada al portapapeles; ya puedes pegarla.');
    } catch (error) {
      this.setPhotoNotice(
        error instanceof Error ? error.message : 'No se pudo copiar la imagen al portapapeles.',
        true
      );
    }
  }

  openPhotoLightbox(photo: FotoHabitacion): void {
    this.lightboxPhoto.set(photo);
  }

  closePhotoLightbox(): void {
    this.lightboxPhoto.set(null);
  }

  async copyLightboxPhoto(): Promise<void> {
    const photo = this.lightboxPhoto();
    if (!photo) {
      return;
    }
    try {
      await this.writeImageToClipboard(photo);
      this.setPhotoNotice('Imagen copiada al portapapeles; ya puedes pegarla.');
    } catch (error) {
      this.setPhotoNotice(
        error instanceof Error ? error.message : 'No se pudo copiar la imagen al portapapeles.',
        true
      );
    }
  }

  private async writeImageToClipboard(photo: FotoHabitacion): Promise<void> {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Este navegador no permite copiar imágenes al portapapeles. Prueba en un contexto HTTPS actualizado.');
    }

    const png = await this.loadPngBlob(photo.url);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }

  private createPhotoFileName(photo: FotoHabitacion, index: number, mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/gif': 'gif',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
    };
    const title = this.sanitizeFileName(photo.titulo || `foto-${index + 1}`);
    const extension = extensions[mimeType.toLowerCase()] ?? 'jpg';
    return `${String(index + 1).padStart(2, '0')}-${title}.${extension}`;
  }

  private sanitizeFileName(value: string): string {
    return value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'habitacion';
  }

  private async loadPngBlob(imageUrl: string): Promise<Blob> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('No se pudo cargar una de las imágenes para copiarla.');
    }
    const sourceBlob = await response.blob();
    const sourceUrl = URL.createObjectURL(sourceBlob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imageElement = new Image();
        imageElement.onload = () => resolve(imageElement);
        imageElement.onerror = () => reject(new Error('No se pudo leer una de las imágenes para copiarla.'));
        imageElement.src = sourceUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No se pudo preparar la imagen para copiarla.');
      }
      context.drawImage(image, 0, 0);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('No se pudo convertir la imagen a PNG.'));
          }
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  private setPhotoNotice(message: string, isError = false, title = isError ? 'Atención' : 'Listo'): void {
    this.clearPhotoNoticeTimeout();
    this.photoNotice.set(message);
    this.photoNoticeTitle.set(title);
    this.photoNoticeIsError.set(isError);
    if (message) {
      this.photoNoticeTimeout = setTimeout(() => this.dismissPhotoNotice(), 5000);
    }
  }

  dismissPhotoNotice(): void {
    this.clearPhotoNoticeTimeout();
    this.photoNotice.set('');
    this.photoNoticeTitle.set('');
    this.photoNoticeIsError.set(false);
  }

  private clearPhotoNoticeTimeout(): void {
    if (this.photoNoticeTimeout !== null) {
      clearTimeout(this.photoNoticeTimeout);
      this.photoNoticeTimeout = null;
    }
  }

  setRoomTypology(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.roomTypologyId = Number.isFinite(id) ? id : null;
    this.roomFormError.set('');
  }

  async saveRoomChanges(): Promise<void> {
    const room = this.editingRoom();
    const sedeActual = this.sede();
    if (!this.isAdmin() || !room || !sedeActual) {
      return;
    }

    const numeroTexto = String(this.roomNumber ?? '').trim();
    const numero = Number(numeroTexto);
    if (!Number.isInteger(numero) || numero < 1) {
      this.roomFormError.set('Ingresa un número de habitación entero mayor que cero.');
      return;
    }
    if (this.habitaciones().some((item) =>
      item.id !== room.id && Number(item.numero) === numero
    )) {
      this.roomFormError.set(`Ya existe una habitación con el número ${numero}.`);
      return;
    }

    const tipologia = this.tipologias().find((item) => item.id === this.roomTypologyId);
    if (!tipologia) {
      this.roomFormError.set('Selecciona una tipología para la habitación.');
      return;
    }

    const sizeTexto = String(this.roomSize ?? '').trim();
    const size = sizeTexto === '' ? null : Number(sizeTexto);
    if (size !== null && (!Number.isFinite(size) || size <= 0)) {
      this.roomFormError.set('El tamaño debe ser un número mayor que cero.');
      return;
    }

    const updatedRoom: Habitacion = {
      ...room,
      numero: String(numero),
      tipo: tipologia.nombre,
      tipologiaId: tipologia.id,
      tamanoM2: size,
      disposicionMuebles: this.roomFurniture.trim(),
      descripcion: this.roomDescription.trim(),
    };
    await this.sedeService.updateSelectedSede({
      nombre: sedeActual.nombre,
      habitaciones: this.habitaciones().map((item) =>
        item.id === room.id ? updatedRoom : item
      ),
    });
    this.closeRoomEditor();
  }

  roomInventoryCount(roomId: number): number {
    return new Set(this.inventarioService.habitacionesAsignadas()
      .filter((item) => item.id_habitacion === roomId && item.estado === 'ACTIVO')
      .map((item) => item.id_insumo)).size;
  }

  availableInventoryStock(idInsumo: number): number {
    const insumo = this.insumosInventario().find((item) => item.id_insumo === idInsumo);
    if (!insumo) return 0;
    const assigned = this.inventarioService.habitacionesAsignadas()
      .filter((item) => item.id_insumo === idInsumo && item.estado === 'ACTIVO')
      .reduce((total, item) => total + item.cantidad, 0);
    return insumo.stock_actual - assigned;
  }

  selectedInventoryAvailableStock(): number {
    const insumoId = this.selectedInventorySupplyId();
    return insumoId === null ? 0 : this.availableInventoryStock(insumoId);
  }

  async assignInventoryToRoom(): Promise<void> {
    const roomId = this.targetRoomId();
    const insumoId = this.selectedInventorySupplyId();
    const cantidad = this.inventoryQuantity();
    if (roomId === null || insumoId === null || cantidad === null) {
      this.inventoryFormError.set('Selecciona un insumo y una cantidad.');
      return;
    }
    try {
      await this.inventarioService.assignToRoom(insumoId, roomId, cantidad);
      this.inventoryQuantity.set(1);
      this.inventoryFormError.set('');
    } catch (error) {
      this.inventoryFormError.set(
        error instanceof Error ? error.message : 'No se pudo asignar el insumo a la habitación.',
      );
    }
  }

  async releaseInventoryFromRoom(assignmentId: number): Promise<void> {
    try {
      await this.inventarioService.releaseRoomAssignment(assignmentId);
      this.inventoryFormError.set('');
    } catch (error) {
      this.inventoryFormError.set(
        error instanceof Error ? error.message : 'No se pudo devolver el insumo a bodega.',
      );
    }
  }

  /**
   * Botón del editor: si la habitación está en mantenimiento lo finaliza; si no,
   * abre el formulario para indicar el motivo.
   */
  async toggleMaintenance(): Promise<void> {
    const room = this.editingRoom();
    if (!this.isAdmin() || !room || this.updatingMaintenance()) {
      return;
    }
    this.roomFormError.set('');
    if (room.estado === 'mantenimiento') {
      await this.finishMaintenance(room.id);
      return;
    }
    if (room.estado === 'ocupada') {
      this.roomFormError.set('No se puede pasar a mantenimiento una habitación ocupada.');
      return;
    }
    this.maintenanceMotivo.set('');
    this.maintenanceMotivoOtro.set('');
    this.maintenanceDescripcion.set('');
    this.maintenanceFormError.set('');
    this.maintenanceFormOpen.set(true);
  }

  closeMaintenanceForm(): void {
    if (!this.updatingMaintenance()) {
      this.maintenanceFormOpen.set(false);
    }
  }

  async submitMaintenance(): Promise<void> {
    const room = this.editingRoom();
    if (!room || this.updatingMaintenance()) return;
    const motivo = (this.maintenanceMotivo() === 'Otro'
      ? this.maintenanceMotivoOtro()
      : this.maintenanceMotivo()).trim();
    if (!motivo) {
      this.maintenanceFormError.set('Selecciona o escribe el motivo del mantenimiento.');
      return;
    }
    this.maintenanceFormError.set('');
    this.updatingMaintenance.set(true);
    try {
      const registro = await firstValueFrom(this.mantenimientoRepository.iniciar(room.id, {
        motivo,
        descripcion: this.maintenanceDescripcion().trim() || undefined,
      }));
      this.sedeService.applyHabitacionEstadoLocal(room.id, 'mantenimiento');
      this.maintenanceHistory.update((items) => [registro, ...items]);
      this.maintenanceFormOpen.set(false);
    } catch (error) {
      this.maintenanceFormError.set(getApiErrorMessage(error, 'No se pudo iniciar el mantenimiento.'));
    } finally {
      this.updatingMaintenance.set(false);
    }
  }

  private async finishMaintenance(habitacionId: number): Promise<void> {
    this.updatingMaintenance.set(true);
    try {
      const registro = await firstValueFrom(this.mantenimientoRepository.finalizar(habitacionId));
      this.sedeService.applyHabitacionEstadoLocal(habitacionId, 'libre');
      if (registro) {
        this.maintenanceHistory.update((items) =>
          items.map((item) => item.id === registro.id ? registro : item));
      }
    } catch (error) {
      this.roomFormError.set(getApiErrorMessage(error, 'No se pudo finalizar el mantenimiento.'));
    } finally {
      this.updatingMaintenance.set(false);
    }
  }

  async openMaintenanceHistory(): Promise<void> {
    const sede = this.sede();
    if (!sede) return;
    this.maintenanceHistoryFilter.set('todos');
    this.maintenanceHistoryRoom.set('');
    this.maintenanceHistoryError.set('');
    this.maintenanceHistoryOpen.set(true);
    this.maintenanceHistoryLoading.set(true);
    try {
      this.maintenanceHistory.set(await firstValueFrom(this.mantenimientoRepository.listBySede(sede.id)));
    } catch (error) {
      this.maintenanceHistoryError.set(getApiErrorMessage(error, 'No se pudo cargar el historial de mantenimientos.'));
    } finally {
      this.maintenanceHistoryLoading.set(false);
    }
  }

  closeMaintenanceHistory(): void {
    this.maintenanceHistoryOpen.set(false);
  }

  getMaintenanceDuration(item: MantenimientoHabitacion): string {
    const end = item.fechaTermino ? new Date(item.fechaTermino).getTime() : Date.now();
    const minutes = Math.max(0, Math.floor((end - new Date(item.fechaInicio).getTime()) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return `${days} d ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes % 60} min`;
    return `${minutes} min`;
  }

  requestRoomDelete(): void {
    if (this.isAdmin() && this.editingRoom()) {
      this.confirmRoomDelete.set(true);
    }
  }

  async deleteRoom(): Promise<void> {
    const room = this.editingRoom();
    const sedeActual = this.sede();
    if (!this.isAdmin() || !room || !sedeActual || !this.confirmRoomDelete()) {
      return;
    }

    // La habitación queda inactiva en el backend (soft delete), así que se
    // conservan sus fotos e historial.
    try {
      await this.sedeService.updateSelectedSede({
        nombre: sedeActual.nombre,
        habitaciones: this.habitaciones().filter((item) => item.id !== room.id),
      });
    } catch (error) {
      this.confirmRoomDelete.set(false);
      this.roomFormError.set(this.extractErrorMessage(error, 'No se pudo eliminar la habitación.'));
      return;
    }
    this.closeRoomEditor();
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiMessage = (error as { error?: { message?: unknown } })?.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    if (Array.isArray(apiMessage) && apiMessage.length > 0) {
      return String(apiMessage[0]);
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  onRoomCardKeydown(event: KeyboardEvent, room: Habitacion): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openRoomEditor(room);
    }
  }

  setNewRoomNumber(event: Event): void {
    this.newRoomNumber.set((event.target as HTMLInputElement).value);
    this.newRoomError.set('');
  }

  selectNewRoomTypology(event: Event): void {
    const selectedId = Number((event.target as HTMLSelectElement).value);
    this.newRoomTypologyId.set(Number.isFinite(selectedId) ? selectedId : null);
    this.applyNewRoomDefaults(this.tipologias().find((item) => item.id === selectedId)?.capacidad);
    this.newRoomError.set('');
  }

  async createHabitacion(): Promise<void> {
    if (!this.isAdmin() || this.creatingRoom()) {
      return;
    }
    if (this.wizardRoomId() !== null) {
      this.goToNewRoomStep(2);
      return;
    }

    const sedeActual = this.sede();
    const tipologia = this.tipologias().find((item) => item.id === this.newRoomTypologyId());
    if (!sedeActual || !tipologia) {
      this.newRoomError.set('Selecciona una tipología para crear la habitación.');
      return;
    }

    const numerosActuales = this.habitaciones()
      .map((habitacion) => Number(habitacion.numero))
      .filter((numero) => Number.isFinite(numero));
    const numeroIngresado = this.newRoomNumber().trim();
    const numero = numeroIngresado === ''
      ? this.getNextRoomNumber(numerosActuales)
      : Number(numeroIngresado);
    if (!Number.isInteger(numero) || numero < 1) {
      this.newRoomError.set('Ingresa un número de habitación entero mayor que cero.');
      return;
    }
    if (numerosActuales.includes(numero)) {
      this.newRoomError.set(`Ya existe una habitación con el número ${numero}.`);
      return;
    }

    const sizeTexto = String(this.newRoomSize ?? '').trim();
    const tamanoM2 = sizeTexto === '' ? null : Number(sizeTexto);
    if (tamanoM2 !== null && (!Number.isFinite(tamanoM2) || tamanoM2 <= 0)) {
      this.newRoomError.set('El tamaño debe ser un número mayor que cero.');
      return;
    }

    const nuevaHabitacion: Habitacion = {
      id: this.sedeService.createHabitacionId(),
      numero: String(numero),
      tipo: tipologia.nombre,
      tipologiaId: tipologia.id,
      tamanoM2,
      disposicionMuebles: this.newRoomFurniture.trim(),
      descripcion: this.newRoomDescription.trim(),
      estado: 'libre',
    };

    this.creatingRoom.set(true);
    try {
      await this.sedeService.updateSelectedSede({
        nombre: sedeActual.nombre,
        habitaciones: [...this.habitaciones(), nuevaHabitacion],
      });
    } catch (error) {
      this.newRoomError.set(getApiErrorMessage(error, 'No se pudo crear la habitación.'));
      return;
    } finally {
      this.creatingRoom.set(false);
    }

    const creada = this.habitaciones().find((habitacion) => habitacion.numero === String(numero));
    if (!creada) {
      this.closeNewRoomForm();
      return;
    }
    this.wizardRoomId.set(creada.id);
    this.newRoomError.set('');
    this.newRoomStep.set(2);
  }

  private applyNewRoomDefaults(capacidad: number | undefined): void {
    if (capacidad === undefined) {
      this.newRoomSize = '';
      this.newRoomFurniture = '';
      return;
    }
    const { tamanoM2, disposicionMuebles } = this.getRoomDefaults(capacidad);
    this.newRoomSize = tamanoM2;
    this.newRoomFurniture = disposicionMuebles;
  }

  private getNextRoomNumber(currentNumbers: number[]): number {
    const usedNumbers = new Set(currentNumbers);
    let nextNumber = currentNumbers.length > 0 ? Math.max(...currentNumbers) + 1 : 101;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }
    return nextNumber;
  }

  private getRoomDefaults(capacidad: number): Pick<Habitacion, 'tamanoM2' | 'disposicionMuebles'> {
    if (capacidad === 1) {
      return { tamanoM2: 14, disposicionMuebles: '1 Cama 1 Plaza' };
    }
    if (capacidad === 3) {
      return { tamanoM2: 28, disposicionMuebles: '3 Camas 1 Plaza' };
    }
    if (capacidad >= 4) {
      return { tamanoM2: 36, disposicionMuebles: '1 Cama Matrimonial + 2 Camas 1 Plaza' };
    }
    return { tamanoM2: 22, disposicionMuebles: '1 Cama Matrimonial' };
  }

  getManagedTypology(room: Habitacion): SedeTipologia | undefined {
    return this.tipologias().find((typology) =>
      typology.id === room.tipologiaId ||
      typology.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase()
    );
  }

  getManagedTypologyName(room: Habitacion): string {
    return this.getManagedTypology(room)?.nombre ?? 'Tipología no gestionada';
  }

  getEstadoLabel(estado?: EstadoHabitacion): string {
    switch (estado) {
      case 'ocupada':
        return 'Ocupada';
      case 'en aseo':
        return 'En Aseo';
      case 'mantenimiento':
        return 'Mantenimiento';
      case 'libre':
      default:
        return 'Libre';
    }
  }

  /** Libera una habitación en aseo. No abre el editor de la tarjeta (el clic no se propaga). */
  async terminarAseo(habitacion: Habitacion, event: Event): Promise<void> {
    event.stopPropagation();
    if (habitacion.estado !== 'en aseo' || this.finishingCleaningRoomId() !== null) {
      return;
    }
    this.cleaningError.set(null);
    this.finishingCleaningRoomId.set(habitacion.id);
    try {
      await this.sedeService.terminarAseo(habitacion.id);
    } catch (error) {
      this.cleaningError.set({
        roomId: habitacion.id,
        message: getApiErrorMessage(error, 'No se pudo terminar el aseo. Inténtalo nuevamente.'),
      });
    } finally {
      this.finishingCleaningRoomId.set(null);
    }
  }

  getTiempoEnAseo(habitacion: Habitacion): string {
    this.liveTick(); // Suscripción reactiva al tick en vivo
    if (!habitacion.aseoIniciado) {
      return 'En curso';
    }
    const diffMin = Math.floor((Date.now() - habitacion.aseoIniciado) / (60 * 1000));
    return diffMin <= 0 ? 'Recién iniciado' : `Hace ${diffMin} min`;
  }
}