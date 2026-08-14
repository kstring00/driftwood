# Driftwood

A browser-based top-down survival prototype built around gathering, fortification, night raids, disease, and supernatural class powers.

## Current playable loop

- Gather **wood**, **herbs**, and **arcane crystals** during the day.
- Build **barricades**, **campfires**, and **wards**.
- Survive increasingly dangerous enemy waves at night.
- Manage an **infection** system. Rotters spread disease; campfires and Holy Warden abilities can suppress it.
- Choose one of two starting archetypes:
  - **Holy Warden** — Smite + Cleanse
  - **Arcane Mage** — Arcane Bolt + Frost Nova
- Enemy roster grows as the days pass: Drowned, Rotters, and Wraiths.

## Controls

| Control | Action |
|---|---|
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Left click | Attack / place selected building |
| E | Harvest nearby resource |
| Q | Class attack |
| R | Class utility power |
| 1 | Barricade |
| 2 | Campfire |
| 3 | Ward |
| Esc | Cancel build mode |

## Run locally

This prototype has no build step. Serve the directory with any static server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Roadmap

The prototype is intentionally small enough to iterate quickly. Strong next systems include procedural islands, inventory/crafting UI, shelter interiors, disease types with unique cures, skill trees, bosses, saving, loot, multiplayer, and deeper Holy/Mage specializations.
