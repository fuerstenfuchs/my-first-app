export const ARCHETYPE_CATEGORIES = [
  { key: 'hospitality', label: 'Hospitality', emoji: '🍸' },
  { key: 'wohnen',      label: 'Wohnen',       emoji: '🏠' },
  { key: 'business',    label: 'Business',     emoji: '💼' },
  { key: 'freizeit',    label: 'Freizeit',     emoji: '🎉' },
  { key: 'industrie',   label: 'Industrie',    emoji: '🏭' },
  { key: 'sonstiges',   label: 'Sonstiges',    emoji: '📦' },
] as const

export type ArchetypeCategory = typeof ARCHETYPE_CATEGORIES[number]['key']
