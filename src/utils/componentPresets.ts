import type { BikeComponent } from '@/types'

export interface ComponentPreset {
  key: string
  name: string
  intervalKm?: number
  intervalDays?: number
}

export const COMPONENT_PRESETS: ComponentPreset[] = [
  { key: 'chain', name: 'Chaine', intervalKm: 3000 },
  { key: 'cassette', name: 'Cassette', intervalKm: 9000 },
  { key: 'brakePads', name: 'Plaquettes de frein', intervalKm: 1500 },
  { key: 'tires', name: 'Pneus', intervalKm: 5000 },
  { key: 'brakeCables', name: 'Cables de frein', intervalDays: 365 },
  { key: 'fullService', name: 'Revision generale', intervalDays: 180 },
  { key: 'brakeBleed', name: 'Purge des freins', intervalDays: 180 },
  { key: 'chainrings', name: 'Plateaux', intervalKm: 12000 },
  { key: 'bottomBracket', name: 'Boitier de pedalier', intervalKm: 12000, intervalDays: 730 },
  { key: 'brakeRotors', name: 'Disques de frein', intervalKm: 8000 },
  { key: 'sealant', name: 'Liquide preventif', intervalDays: 180 },
  { key: 'freehub', name: 'Roue libre', intervalKm: 10000 },
  { key: 'chainService', name: 'Entretien de la chaine', intervalKm: 500 },
  { key: 'rearSuspension', name: 'Suspension arriere', intervalDays: 180 },
  { key: 'frontSuspension', name: 'Suspension avant', intervalDays: 180 },
]

const PRESET_KEY_BY_NAME = new Map(
  COMPONENT_PRESETS.map((preset) => [normalizeComponentName(preset.name), preset.key]),
)

function normalizeComponentName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getComponentTranslationKey(name: string): string | null {
  const key = PRESET_KEY_BY_NAME.get(normalizeComponentName(name))
  return key ? `components.names.${key}` : null
}

export function getComponentLabel(name: string, translate: (key: string) => string): string {
  const translationKey = getComponentTranslationKey(name)
  return translationKey ? translate(translationKey) : name
}

export function findComponentPreset(name: string): ComponentPreset | undefined {
  return COMPONENT_PRESETS.find((preset) => preset.name === name)
}

export function buildComponentFromPreset(
  preset: ComponentPreset,
  overrides: Pick<BikeComponent, 'dateStarted' | 'kmAtStart'>,
): Omit<BikeComponent, 'id'> {
  return {
    name: preset.name,
    intervalKm: preset.intervalKm,
    intervalDays: preset.intervalDays,
    dateStarted: overrides.dateStarted,
    kmAtStart: overrides.kmAtStart,
  }
}
