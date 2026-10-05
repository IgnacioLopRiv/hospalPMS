import { Injectable, signal } from '@angular/core';
import { FotoHabitacion } from '../domain/foto-habitacion.model';

const STORAGE_KEY = 'hospal_fotos_habitaciones';
const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 960;
const JPEG_QUALITY = 0.7;

function isFotoHabitacion(value: unknown): value is FotoHabitacion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const photo = value as Record<string, unknown>;
  return (typeof photo['id'] === 'number' || typeof photo['id'] === 'string') &&
    (typeof photo['habitacionId'] === 'number' || typeof photo['habitacionId'] === 'string') &&
    typeof photo['url'] === 'string' &&
    typeof photo['fechaSubida'] === 'string' &&
    (photo['titulo'] === undefined || typeof photo['titulo'] === 'string') &&
    (photo['descripcion'] === undefined || typeof photo['descripcion'] === 'string');
}

@Injectable({ providedIn: 'root' })
export class FotoHabitacionService {
  private readonly storedPhotos = signal<FotoHabitacion[]>(this.readStoredPhotos());
  readonly photos = this.storedPhotos.asReadonly();

  forRoom(habitacionId: number | string): FotoHabitacion[] {
    return this.storedPhotos().filter((photo) =>
      String(photo.habitacionId) === String(habitacionId)
    );
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
    const photo: FotoHabitacion = {
      id: this.createId(),
      habitacionId: input.habitacionId,
      url,
      titulo: input.titulo?.trim() || undefined,
      descripcion: input.descripcion?.trim() || undefined,
      fechaSubida: new Date().toISOString(),
    };
    this.persist([...this.storedPhotos(), photo]);
    return photo;
  }

  removePhoto(photoId: FotoHabitacion['id']): void {
    this.persist(this.storedPhotos().filter((photo) => photo.id !== photoId));
  }

  removeRoomPhotos(habitacionId: number | string): void {
    this.persist(this.storedPhotos().filter((photo) =>
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

  private readStoredPhotos(): FotoHabitacion[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isFotoHabitacion)) {
      throw new Error(`Los datos guardados en ${STORAGE_KEY} no tienen un formato válido.`);
    }
    return parsed;
  }

  private persist(photos: FotoHabitacion[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch (error) {
      if (error instanceof DOMException &&
          (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        throw new Error('No hay espacio suficiente en el almacenamiento del navegador. Elimina algunas fotos e inténtalo de nuevo.');
      }
      throw error;
    }
    this.storedPhotos.set(photos);
  }

  private createId(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `foto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
