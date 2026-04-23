import type { HotspotPosition, BikeVisualType } from '@/types'
import type { ComponentStatus } from '@/utils/status'

export type BikeZone =
  | 'drivetrain'
  | 'brakes'
  | 'wheels'
  | 'cockpit'
  | 'suspension'
  | 'service'

export type BikeHotspot =
  | 'chain'
  | 'cassette'
  | 'chainring'
  | 'wheels'
  | 'brakes'
  | 'cockpit'
  | 'suspension'
  | 'service'

const KEYWORDS_BY_ZONE: Record<BikeZone, string[]> = {
  drivetrain: [
    'chaine',
    'chain',
    'cassette',
    'transmission',
    'derailleur',
    'plateau',
    'crank',
    'pedal',
  ],
  brakes: [
    'frein',
    'brake',
    'plaquette',
    'rotor',
    'disque',
    'disc',
    'cable',
    'hose',
  ],
  wheels: [
    'pneu',
    'tire',
    'tyre',
    'roue',
    'wheel',
    'jante',
    'rim',
    'tubeless',
    'chambre',
  ],
  cockpit: [
    'guidon',
    'handlebar',
    'bar',
    'potence',
    'stem',
    'selle',
    'saddle',
    'seat',
    'seatpost',
    'cintre',
  ],
  suspension: [
    'fourche',
    'fork',
    'suspension',
    'amortisseur',
    'shock',
  ],
  service: [
    'revision',
    'service',
    'entretien',
  ],
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const HOTSPOT_PRESETS: Partial<Record<BikeVisualType, Record<string, HotspotPosition>>> = {
  road: {
    chaine: { leftPct: 34.1, topPct: 84 },
    cassette: { leftPct: 20.64, topPct: 60.53 },
    'plaquettes de frein': { leftPct: 73.75, topPct: 63.54 },
    pneus: { leftPct: 90.04, topPct: 44.24 },
    'cables de frein': { leftPct: 73.07, topPct: 48.93 },
    'revision generale': { leftPct: 51.06, topPct: 25.48 },
    'purge des freins': { leftPct: 81.37, topPct: 11.43 },
    plateaux: { leftPct: 45.36, topPct: 65.04 },
    'boitier de pedalier': { leftPct: 44.15, topPct: 74.62 },
    'disques de frein': { leftPct: 81.35, topPct: 63.76 },
    'liquide preventif': { leftPct: 8.02, topPct: 48.46 },
    'roue libre': { leftPct: 21.32, topPct: 67.96 },
    "entretien de la chaine": { leftPct: 34.64, topPct: 64.75 },
  },
  gravel: {
    chaine: { leftPct: 35.32, topPct: 63.97 },
    pneus: { leftPct: 95.36, topPct: 62.24 },
    'cables de frein': { leftPct: 73.35, topPct: 45.22 },
    'purge des freins': { leftPct: 81.5, topPct: 14.14 },
    plateaux: { leftPct: 47.41, topPct: 65.94 },
    'boitier de pedalier': { leftPct: 44.97, topPct: 75.57 },
    'disques de frein': { leftPct: 81.77, topPct: 61.75 },
    'liquide preventif': { leftPct: 6.53, topPct: 53.12 },
    "entretien de la chaine": { leftPct: 32.61, topPct: 82.72 },
  },
  mtb: {
    chaine: { leftPct: 33.15, topPct: 57.96 },
    cassette: { leftPct: 22.15, topPct: 54.1 },
    'plaquettes de frein': { leftPct: 70.91, topPct: 60.23 },
    pneus: { leftPct: 89.79, topPct: 51.6 },
    'cables de frein': { leftPct: 69.14, topPct: 40.03 },
    'purge des freins': { leftPct: 65.07, topPct: 15.28 },
    plateaux: { leftPct: 43.74, topPct: 61.82 },
    'boitier de pedalier': { leftPct: 40.76, topPct: 64.77 },
    'disques de frein': { leftPct: 79.06, topPct: 59.09 },
    'liquide preventif': { leftPct: 8.16, topPct: 52.87 },
    'roue libre': { leftPct: 22.42, topPct: 64.32 },
    "entretien de la chaine": { leftPct: 31.93, topPct: 73.4 },
    'suspension arriere': { leftPct: 44.56, topPct: 44.79 },
    'suspension avant': { leftPct: 66.83, topPct: 33.44 },
  },
}

export function getPresetHotspotPosition(
  visual: BikeVisualType,
  componentName: string
): HotspotPosition | undefined {
  return HOTSPOT_PRESETS[visual]?.[normalize(componentName)]
}

export function inferZonesForComponent(name: string): BikeZone[] {
  const normalizedName = normalize(name)
  const zones = (Object.entries(KEYWORDS_BY_ZONE) as Array<[BikeZone, string[]]>)
    .filter(([, keywords]) => keywords.some((k) => normalizedName.includes(k)))
    .map(([zone]) => zone)

  return zones.length ? zones : ['service']
}

export function inferHotspotsForComponent(name: string): BikeHotspot[] {
  const normalizedName = normalize(name)
  const hotspots = new Set<BikeHotspot>()

  if (normalizedName.includes('chaine') || normalizedName.includes('chain')) hotspots.add('chain')
  if (normalizedName.includes('cassette')) hotspots.add('cassette')
  if (normalizedName.includes('plateau') || normalizedName.includes('crank')) hotspots.add('chainring')

  if (
    normalizedName.includes('pneu') ||
    normalizedName.includes('tire') ||
    normalizedName.includes('tyre') ||
    normalizedName.includes('roue') ||
    normalizedName.includes('wheel') ||
    normalizedName.includes('jante') ||
    normalizedName.includes('rim') ||
    normalizedName.includes('tubeless') ||
    normalizedName.includes('chambre')
  ) hotspots.add('wheels')

  if (
    normalizedName.includes('frein') ||
    normalizedName.includes('brake') ||
    normalizedName.includes('plaquette') ||
    normalizedName.includes('rotor') ||
    normalizedName.includes('disque') ||
    normalizedName.includes('disc') ||
    normalizedName.includes('cable') ||
    normalizedName.includes('hose')
  ) hotspots.add('brakes')

  if (
    normalizedName.includes('guidon') ||
    normalizedName.includes('handlebar') ||
    normalizedName.includes('bar') ||
    normalizedName.includes('potence') ||
    normalizedName.includes('stem') ||
    normalizedName.includes('selle') ||
    normalizedName.includes('saddle') ||
    normalizedName.includes('seat') ||
    normalizedName.includes('seatpost') ||
    normalizedName.includes('cintre')
  ) hotspots.add('cockpit')

  if (
    normalizedName.includes('fourche') ||
    normalizedName.includes('fork') ||
    normalizedName.includes('suspension') ||
    normalizedName.includes('amortisseur') ||
    normalizedName.includes('shock')
  ) hotspots.add('suspension')

  if (
    normalizedName.includes('revision') ||
    normalizedName.includes('service') ||
    normalizedName.includes('entretien')
  ) hotspots.add('service')

  return hotspots.size ? [...hotspots] : ['service']
}

const STATUS_RANK: Record<ComponentStatus, number> = {
  ok: 0,
  watch: 1,
  soon: 2,
  overdue: 3,
}

export function mergeZoneStatus(
  current: ComponentStatus | undefined,
  incoming: ComponentStatus
): ComponentStatus {
  if (!current) return incoming
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current
}
