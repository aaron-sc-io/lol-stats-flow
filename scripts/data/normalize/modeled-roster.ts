/** Phase 1 modeled roster (plan §1 "Chosen defaults"), keyed by the stable
 * identifier each data source uses. `modeled: true` on these entities only;
 * the Phase 2 engine flips/confirms per the plan. */
export const MODELED_CHAMPION_KEYS: ReadonlySet<number> = new Set([157, 63, 67, 122, 86])
// Yasuo, Brand, Vayne, Darius, Garen

export const MODELED_ITEM_IDS: ReadonlySet<number> = new Set([
  3031, // Infinity Edge
  6673, // Immortal Shieldbow
  6653, // Liandry's Torment
  3153, // Blade of the Ruined King
  3036, // Lord Dominik's Regards
  3071, // Black Cleaver
  3078, // Trinity Force
  3057, // Sheen
  6672, // Kraken Slayer
  3089, // Rabadon's Deathcap
  3135, // Void Staff
  3152, // Hextech Rocketbelt
  4633, // Riftmaker
])
