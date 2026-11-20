export type MeasurementUnit = 'kg' | 'g' | 'L' | 'ml' | 'pieces';

export const MEASUREMENT_UNITS: { label: string; value: MeasurementUnit; family: 'weight' | 'volume' | 'count' }[] = [
  { label: 'Kilograms (kg)', value: 'kg', family: 'weight' },
  { label: 'Grams (g)', value: 'g', family: 'weight' },
  { label: 'Liters (L)', value: 'L', family: 'volume' },
  { label: 'Milliliters (ml)', value: 'ml', family: 'volume' },
  { label: 'Pieces (pcs)', value: 'pieces', family: 'count' },
];

export function normalizeUnit(u: string): string {
  const s = String(u || '').trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms'].includes(s)) return 'kg';
  if (['g', 'gram', 'grams'].includes(s)) return 'g';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(s)) return 'L';
  if (['ml', 'milliliter', 'milliliters'].includes(s)) return 'ml';
  if (['piece', 'pieces', 'pcs', 'pc'].includes(s)) return 'pieces';
  return s;
}

export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const u1 = normalizeUnit(unit1);
  const u2 = normalizeUnit(unit2);
  if (u1 === u2) return true;
  if (['kg', 'g'].includes(u1) && ['kg', 'g'].includes(u2)) return true;
  if (['L', 'ml'].includes(u1) && ['L', 'ml'].includes(u2)) return true;
  if (['pieces'].includes(u1) && ['pieces'].includes(u2)) return true;
  return false;
}

export function getCompatibleUnits(unit: string): MeasurementUnit[] {
  const u = normalizeUnit(unit);
  if (['kg', 'g'].includes(u)) return ['kg', 'g'];
  if (['L', 'ml'].includes(u)) return ['L', 'ml'];
  return ['pieces'];
}

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return quantity;

  // Weight
  if (from === 'kg' && to === 'g') return quantity * 1000;
  if (from === 'g' && to === 'kg') return quantity / 1000;

  // Volume
  if (from === 'L' && to === 'ml') return quantity * 1000;
  if (from === 'ml' && to === 'L') return quantity / 1000;

  throw new Error(`Incompatible units: cannot convert from "${fromUnit}" to "${toUnit}".`);
}

/**
 * Calculates how much a recipe ingredient costs based on inventory item cost_per_unit
 */
export function calculateIngredientCost(
  quantityRequired: number,
  recipeUnit: string,
  costPerUnit: number,
  inventoryUnit: string
): number {
  try {
    const qtyInInvUnit = convertQuantity(quantityRequired, recipeUnit, inventoryUnit);
    return Number((qtyInInvUnit * costPerUnit).toFixed(2));
  } catch {
    return 0;
  }
}
