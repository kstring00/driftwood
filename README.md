# Driftwood

A dark browser survival RPG built in playable stages.

## Stage I — The Wanderer

The current build combines the original survival loop with the first RPG progression layer:

- Customize character name, skin, hair, hair style, and outfit
- Choose Holy Warden or Arcane Mage
- Gather wood, herbs, and arcane crystal during the day
- Build barricades, campfires, and wards before night
- Survive Drowned, Rotters, and Wraiths
- Manage infection
- Use health and class-power potions
- Collect enemy gear drops and equip upgrades
- Equipment slots: weapon, head, chest, boots, charm
- Loot rarities: Common, Enchanted, Rare, Relic
- Gear modifies damage, armor, max life, max power, regen, and movement

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| Mouse | Aim |
| Left click | Attack / place selected building |
| `E` | Harvest nearby resource or pick up nearby loot |
| `1` | Barricade |
| `2` | Campfire |
| `3` | Ward |
| `4` | Health potion |
| `5` | Faith/Mana potion |
| `Q` | Class attack |
| `R` | Class utility ability |
| `I` | Character + inventory |
| `Esc` | Cancel build / close inventory |

## Development rule

Driftwood is intentionally built as vertical slices rather than adding every system at once. See `ROADMAP.md` for the staged plan.

## Deployment

The repository is linked to Vercel. Updates to `main` deploy automatically.
