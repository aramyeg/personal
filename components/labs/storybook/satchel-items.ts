import { skills } from '@/data'
import type { Skill } from '@/types'

export type SatchelItem = {
  assetId: string
  itemName: string
  skillName: string
  blurb: string
}

export const SATCHEL_ITEMS: readonly SatchelItem[] = [
  { assetId: 'item-sword', itemName: 'The Ever-Sharp Sword', skillName: 'React', blurb: 'Eight years at his side; it has never once dulled.' },
  { assetId: 'item-spellbook', itemName: 'The Book of True Names', skillName: 'TypeScript', blurb: 'Names every thing precisely, and errors flee before it.' },
  { assetId: 'item-scroll', itemName: 'The Router’s Scroll', skillName: 'Next.js', blurb: 'Unrolls a new road wherever the hero means to walk.' },
  { assetId: 'item-potion', itemName: 'The Bear’s Draught', skillName: 'Zustand', blurb: 'A small bottle. It carries the whole kingdom’s state.' },
  { assetId: 'item-compass', itemName: 'The Wayfarer’s Compass', skillName: 'React Native', blurb: 'Points true on any device a traveler may carry.' },
  { assetId: 'item-shield', itemName: 'The Tester’s Shield', skillName: 'Jest', blurb: 'Dents from a thousand regressions; none got through.' },
]

export const satchelSkill = (item: SatchelItem): Skill => {
  const skill = skills.find((s) => s.name === item.skillName)
  if (!skill) throw new Error(`storybook: unknown skill ${item.skillName}`)
  return skill
}
