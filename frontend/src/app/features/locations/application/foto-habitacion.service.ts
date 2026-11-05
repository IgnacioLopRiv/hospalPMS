import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FotoHabitacionRepository } from '../domain/foto-habitacion.repository';
import { FotoHabitacion } from '../domain/foto-habitacion.model';

const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 960;
const JPEG_QUALITY = 0.7;

@Injectable({ providedIn: 'root' })
export class FotoHabitacionService {
  private readonly repository = inject(FotoHabitacionRepository);
  private readonly storedPhotos = signal<FotoHabitacion[]>([]);
  readonly photos = this.storedPhotos.asReadonly();
  private readonly loadedRooms = new Set<string>();
  private readonly loadingRooms = new Map<string, Promise<FotoHabitacion[]>>();

  forRoom(habitacionId: number | string): FotoHabitacion[] {
    const key = String(habitacionId);
    if (!this.loadedRooms.has(key) && !this.loadingRooms.has(key)) {
      void this.loadRoomPhotos(habitacionId).catch(() => undefined);
    }
    return this.storedPhotos().filter((photo) =>
      String(photo.habitacionId) === String(habitacionId)
    );
  }

  async loadRoomPhotos(habitacionId: number | string): Promise<FotoHabitacion[]> {
    const key = String(habitacionId);
    if (this.loadedRooms.has(key)) {
      return this.forRoom(habitacionId);
    }
    const active = this.loadingRooms.get(key);
    if (active) return active;

    const promise = firstValueFrom(this.repository.listPhotos(Number(habitacionId)))
      .then((photos) => {
        if (this.loadedRooms.has(key)) return this.forRoom(habitacionId);
        const others = this.storedPhotos().filter(
          (photo) => String(photo.habitacionId) !== key,
        );
        this.storedPhotos.set([...others, ...photos]);
        this.loadedRooms.add(key);
        return photos;
      })
      .finally(() => {
        this.loadingRooms.delete(key);
      });
    this.loadingRooms.set(key, promise);
    return promise;
  }

  async addPhoto(input: {
    habitacionId: number | string;
    file: File;
    titulo?: string;
    descripcion?: string;
  }): Promise<FotoHabitacion> {
    if (!input.file.type.startsWith('image/')) {
      throw new Error('Selecciona un archivo de imagen válido.');
    }

    const url = await this.compressImage(input.file);
    const photo = await firstValueFrom(this.repository.createPhoto(Number(input.habitacionId), {
      url,
      titulo: input.titulo?.trim() || undefined,
      descripcion: input.descripcion?.trim() || undefined,
    }));
    this.storedPhotos.set([...this.storedPhotos(), photo]);
    this.loadedRooms.add(String(input.habitacionId));
    return photo;
  }

  async removePhoto(photoId: FotoHabitacion['id']): Promise<void> {
    await firstValueFrom(this.repository.deletePhoto(Number(photoId)));
    this.storedPhotos.set(this.storedPhotos().filter((photo) => photo.id !== photoId));
  }

  async removeRoomPhotos(habitacionId: number | string): Promise<void> {
    const photos = this.forRoom(habitacionId);
    for (const photo of photos) {
      await firstValueFrom(this.repository.deletePhoto(Number(photo.id)));
    }
    this.storedPhotos.set(this.storedPhotos().filter((photo) =>
      String(photo.habitacionId) !== String(habitacionId)
    ));
  }

  private async compressImage(file: File): Promise<string> {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await this.loadImage(sourceUrl);
      const scale = Math.min(
        1,
        MAX_IMAGE_WIDTH / image.naturalWidth,
        MAX_IMAGE_HEIGHT / image.naturalHeight
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No se pudo preparar la imagen para guardarla.');
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('No se pudo comprimir la imagen.'));
          }
        }, 'image/jpeg', JPEG_QUALITY);
      });
      return await this.blobToDataUrl(blob);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  private loadImage(sourceUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      image.src = sourceUrl;
    });
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('No se pudo preparar la imagen para guardarla.'));
        }
      };
      reader.onerror = () => reject(new Error('No se pudo leer la imagen comprimida.'));
      reader.readAsDataURL(blob);
    });
  }
}
