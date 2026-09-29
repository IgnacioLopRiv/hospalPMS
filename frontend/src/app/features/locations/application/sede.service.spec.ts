import { SedeService } from './sede.service';

describe('SedeService typology colors', () => {
  let service: SedeService;

  beforeEach(() => {
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
    service = new SedeService();
  });

  afterEach(() => {
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
  });

  it('starts new sedes without unmanaged default typologies', () => {
    const typologies = service.selectedSede()?.tipologias ?? [];

    expect(typologies).toEqual([]);

    const savedSedes = JSON.parse(localStorage.getItem('hospal.sedes') || '[]');
    expect(savedSedes[0].tipologias).toEqual([]);
  });

  it('creates new sedes without assigning default typologies', () => {
    const created = service.createSede({ nombre: 'Nueva sede', ciudad: 'Valparaíso' });

    expect(created.tipologias).toEqual([]);
    expect(service.sedes().find((sede) => sede.id === created.id)?.tipologias).toEqual([]);
  });

  it('does not repopulate a saved sede that has no managed typologies', () => {
    localStorage.setItem('hospal.sedes', JSON.stringify([{
      id: 1,
      nombre: 'Sede sin tipologías',
      ciudad: 'Santiago',
      tipologias: [],
      habitaciones: []
    }]));
    service = new SedeService();

    expect(service.selectedSede()?.tipologias).toEqual([]);
  });

  it('gives new typologies a unique persistent color and preserves it on edits', () => {
    const added = service.addTipologia({
      nombre: 'Suite nueva',
      capacidad: 3,
      descripcion: 'Nueva categoría'
    });
    const existingColors = service.selectedSede()?.tipologias
      ?.filter((typology) => typology.id !== added.id)
      .map((typology) => typology.color) ?? [];

    expect(added.color).toMatch(/^#[0-9A-F]{6}$/);
    expect(existingColors).not.toContain(added.color);

    service.updateTipologia(added.id, { nombre: 'Suite actualizada' });
    expect(service.selectedSede()?.tipologias?.find((typology) => typology.id === added.id)?.color)
      .toBe(added.color);
  });

  it('assigns unique colors to legacy typologies without colors', () => {
    localStorage.setItem('hospal.sedes', JSON.stringify([{
      id: 1,
      nombre: 'Hotel anterior',
      ciudad: 'Santiago',
      tipologias: [
        { id: 1, nombre: 'Doble', capacidad: 2 },
        { id: 2, nombre: 'Suite', capacidad: 2 }
      ],
      habitaciones: []
    }]));

    service = new SedeService();
    const colors = service.selectedSede()?.tipologias?.map((typology) => typology.color) ?? [];

    expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color ?? ''))).toBeTrue();
    expect(new Set(colors).size).toBe(colors.length);
    expect(JSON.parse(localStorage.getItem('hospal.sedes') || '[]')[0].tipologias[0].color)
      .toBe(colors[0]);
  });
});
