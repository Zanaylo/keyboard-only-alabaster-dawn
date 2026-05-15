import { terra } from '@project-selene/api';
import { g_playerTargets, COMBATANT_STATE } from '@project-selene/api/terra';
import { getPlayerEntity } from '../../utils/player.js';
import { readVec3, Vec3Like } from '../../utils/vec.js';

export type Enemy = { [key: string]: any };
export type Entity = { [key: string]: any };

//Maybe decrease a bit, needs test
const MAX_LOCK_DISTANCE = 30;

function findEntityWorldPos(ent: Entity | null): Vec3Like | null {
    if (!ent) return null;
    return readVec3(ent.core?.pos) ?? readVec3(ent.pos);
}

export function getEntityWorldPos(ent: Entity | null): Vec3Like | null {
    return findEntityWorldPos(ent);
}

export function getPlayerPos(): Vec3Like | null {
    return findEntityWorldPos(getPlayerEntity());
}

export function getEntity(entry: Enemy | null): Entity | null {
    return entry?.target?.entity ?? null;
}

export function isAliveEnemyLike(ent: Entity | null): boolean {
    if (!ent?.core) return false;
    if (ent.core.disposed) return false;
    if (ent === getPlayerEntity()) return false;
    if (ent.player || ent.party) return false;
    if (ent.combatant?.state !== undefined && ent.combatant.state !== COMBATANT_STATE.ALIVE) return false;
    return !!(ent.enemy || ent.combatant);
}

export function isOnScreen(ent: Entity | null): boolean {
    if (!ent) return false;
    try {
        if (typeof ent.view?.isFrustumVisible === 'function') return ent.view.isFrustumVisible() === true;
    } catch { }
    const vb = (terra as any).g_gState?.viewBounds;
    try {
        if (typeof vb?.isEntityVisible === 'function') return vb.isEntityVisible(ent) === true;
    } catch { }
    return false;
}

export interface EnemyHit {
    ent: Entity;
    entry: Enemy;
    distSq: number;
}

//Melhorar dps
export function buildEnemyList(requireOnScreen = true): EnemyHit[] {
    const pTarget: any = g_playerTargets;
    const entries: Enemy[] = pTarget?.entries ?? [];
    const ppos = getPlayerPos();
    if (!ppos || !entries.length) return [];

    const items: EnemyHit[] = [];
    const seen = new Set<Entity>();
    for (const entry of entries) {
        if (!entry || entry.extra === 8) continue;
        const ent: Entity | undefined = entry.target?.entity;
        if (!ent || !isAliveEnemyLike(ent) || seen.has(ent)) continue;
        const pos = findEntityWorldPos(ent);
        if (!pos) continue;
        const dx = pos.x - ppos.x, dy = pos.y - ppos.y;
        if (Math.hypot(dx, dy) > MAX_LOCK_DISTANCE) continue;
        if (requireOnScreen && !isOnScreen(ent)) continue;
        seen.add(ent);
        const dz = pos.z - ppos.z;
        items.push({ ent, entry, distSq: dx * dx + dy * dy + dz * dz });
    }
    items.sort((a, b) => a.distSq - b.distSq);
    return items;
}

export function findEntryForEntity(ent: Entity | null): Enemy | null {
    if (!ent) return null;
    const entries: Enemy[] = (g_playerTargets as any)?.entries ?? [];
    for (const enemy of entries) {
        if (enemy?.target?.entity === ent) return enemy;
    }
    return null;
}

export function debugDump(): unknown {
    const entries: Enemy[] = (g_playerTargets as any)?.entries ?? [];
    return {
        playerPos: getPlayerPos(),
        playerExists: !!getPlayerEntity(),
        entriesCount: entries.length,
        enemies: buildEnemyList(true).map(enemy => ({
            keys: Object.keys(enemy.ent).slice(0, 20),
            pos: findEntityWorldPos(enemy.ent),
            distSq: enemy.distSq,
            state: enemy.ent.combatant?.state,
            inEntries: entries.indexOf(enemy.entry),
        })),
    };
}

export function inspectEntry(entry: Enemy | null): unknown {
    if (!entry) return { hasEntry: false };
    const ent = getEntity(entry);
    const entries: Enemy[] = (g_playerTargets as any)?.entries ?? [];
    return {
        hasEntry: true,
        extra: entry.extra,
        indexInEntries: entries.indexOf(entry),
        hasEntity: !!ent,
        disposed: ent?.core?.disposed,
        combatantState: ent?.combatant?.state,
        worldPos: findEntityWorldPos(ent),
        isAliveEnemyLike: isAliveEnemyLike(ent),
        isOnScreen: isOnScreen(ent),
    };
}
