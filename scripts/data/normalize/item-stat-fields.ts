/** DDragon/CDragon item stat field name → engine stat key, stripped of the
 * `Flat`/`Percent`/`m` prefixes and `Mod` suffix noise both sources use.
 * Unmapped fields are preserved under their own (stripped) name rather than
 * dropped — see item.ts normalizer. */
export const ITEM_STAT_FIELD_MAP: Readonly<Record<string, string>> = {
  FlatHPPoolMod: "health",
  FlatMPPoolMod: "mana",
  FlatArmorMod: "armor",
  FlatPhysicalDamageMod: "attackDamage",
  FlatMagicDamageMod: "abilityPower",
  FlatCritChanceMod: "criticalStrikeChance",
  FlatCritDamageMod: "criticalStrikeDamageBonus",
  FlatSpellBlockMod: "magicResist",
  FlatHPRegenMod: "hpRegen",
  FlatMPRegenMod: "manaRegen",
  PercentAttackSpeedMod: "attackSpeedPercent",
  FlatAttackSpeedMod: "attackSpeedFlat",
  FlatMovementSpeedMod: "moveSpeedFlat",
  PercentMovementSpeedMod: "moveSpeedPercent",
  PercentLifeStealMod: "lifeSteal",
  PercentSpellVampMod: "spellVamp",
  PercentOmnivampMod: "omnivamp",
  AbilityHasteMod: "abilityHaste",
  FlatMagicPenetrationMod: "magicPenetrationFlat",
  PercentMagicPenetrationMod: "magicPenetrationPercent",
  FlatArmorPenetrationMod: "armorPenetrationFlat",
  PercentArmorPenetrationMod: "armorPenetrationPercent",
  FlatEnergyRegenMod: "energyRegen",
  FlatEnergyPoolMod: "energy",
}

export function normalizeStatFieldName(rawField: string): string {
  const stripped = rawField.startsWith("m") ? rawField.slice(1) : rawField
  return ITEM_STAT_FIELD_MAP[stripped] ?? stripped
}
