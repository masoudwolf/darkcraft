import type * as THREE from 'three'
import type { blockMaterials } from './textures'

/* ==================================================
   GAMEWORLD — the shared physics/render contract.
   WorldV3 (the Ember Vale) and CastleZone (Manorloth)
   both satisfy it, so the Game can swap entire worlds
   at runtime: the roc carries the player over the
   cloud sea and the world changes under their feet.
   ================================================== */

export interface GameWorld {
  /** every block/light/sky of this zone — swapped in/out of the scene */
  group: THREE.Group
  /** the shared block material atlas */
  mats: ReturnType<typeof blockMaterials>
  /** terrain column height (top block y) */
  getH(x: number, z: number): number
  /** walking surface y (top face of the top block) */
  surfaceAt(x: number, z: number): number
  /** surface material code (QA/probe/minimap) */
  surfAt(x: number, z: number): number
  /** is there a BUILT block in this cell? */
  solidStruct(x: number, y: number, z: number): boolean
  /** does this column block a body whose feet are at feetY? */
  wallAt(x: number, z: number, feetY: number): boolean
  /** highest standable surface near fromY (auto-steps one block) */
  supportAt(x: number, z: number, fromY: number): number
  /** molten ground underfoot? */
  isLava(x: number, z: number): boolean
  /** mark/unmark a built block cell (illusion walls, secret doors) */
  markSolid(x: number, y: number, z: number, on: boolean): void
  /** vale-only: show/hide the two boss fog gates (castle: no-op) */
  setFogGatesVisible(a: boolean, b: boolean): void
  /** vale-only: open/close the pit rockfall (castle: no-op) */
  setPitOpen(open: boolean): void
  /** per-frame ambience (motes, drifting clouds, ...) */
  update(dt: number): void
}
