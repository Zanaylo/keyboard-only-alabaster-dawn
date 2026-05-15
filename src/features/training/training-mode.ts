import {
    TerraActor,
    EnemySpawn,
    Vec3,
    g_enemies,
    g_options,
    g_party,
    PartyMember,
} from '@project-selene/api/terra';
import { getPlayer, getPlayerEntity } from '../../utils/player.js';

//SCRIPT SEM NADA E MAL FEITO NÃO TENTE VOCÊ PODE FUDER O SAVE

//THIS SCRIPT doesn't work properly and I don't even know If I gonna remove it or not,
//It can be use for testing window.__keyboardOnly.train() BUT SAVE BEFORE DOING IT!!!!!!

const ENEMY_PASSIVE_STILL = 2;
const DEFAULT_DUMMY = 'start-ball';

const PARTY_KEYS = ['eshrin', 'filia', 'juno2', 'nima-past', 'nima'];

const SKILL_DEBUG_FLAGS = [
    'unlock-all-gems-slots',
    'unlock-all-active-skills',
    'unlock-all-art-slots',
    'infinite-skill-points',
];


export interface TrainingResult {
    cores: boolean;
    items: boolean;
    skillFlags: number;
    partyMembers: number;
    dummies: number;
}

interface DummyPosition {
    offsetX: number;
    offsetY: number;
}

// corrigir depois
function toFoeKey(dbKey: string): string {
    if (dbKey.startsWith('FOE:')) return dbKey;
    const [main, alt] = dbKey.split('#');
    const dashIdx = main.indexOf('-');
    const converted = dashIdx === -1
        ? main
        : `${main.substring(0, dashIdx)}.${main.substring(dashIdx + 1)}`;
    return alt ? `FOE:${converted}#${alt}` : `FOE:${converted}`;
}

function clonePos(source: any, offsetX: number, offsetY: number): any {
    const px = source.x ?? source.v?.[0] ?? 0;
    const py = source.y ?? source.v?.[1] ?? 0;
    const pz = source.z ?? source.v?.[2] ?? 0;
    const vec: any = new (Vec3 as any)();
    if (typeof vec.setC === 'function') vec.setC(px + offsetX, py + offsetY, pz);
    return vec;
}

function spawnDummy(offset: DummyPosition, enemyKey: string): boolean {
    const playerEnt = getPlayerEntity();
    if (!playerEnt?.core?.pos || !playerEnt.core.gState) {
        //console.error('[keyboard-only] training: player entity not ready');
        return false;
    }

    const dbEntry = (g_enemies as any)?.get?.(enemyKey);
    if (!dbEntry) {
        //console.error(`[keyboard-only] training: enemy "${enemyKey}" not found`);
        return false;
    }

    const spawn = new (EnemySpawn as any)({
        enemyType: toFoeKey(enemyKey),
        face: 'SOUTH',
        autoAggro: 'DISABLED',
    });

    const enemyEnt: any = new (TerraActor as any)();
    enemyEnt.core.setPos(clonePos(playerEnt.core.pos, offset.offsetX, offset.offsetY));
    enemyEnt.setEnemySpawn(spawn, 0, 0, false);
    enemyEnt.enemy?.setPassive?.(ENEMY_PASSIVE_STILL);

    playerEnt.core.gState.addEntity(enemyEnt, false);
    return true;
}

function unlockAllCores(): boolean {
    const player = getPlayer();
    if (typeof player?.setCoreAll !== 'function') {
        //console.error('[keyboard-only] training: setCoreAll not available');
        return false;
    }
    player.setCoreAll(true);
    return true;
}

function unlockAllItems(): boolean {
    const inventory = getPlayer()?.inventory;
    if (typeof inventory?.addAllItems !== 'function') {
        //console.error('[keyboard-only] training: inventory.addAllItems not available');
        return false;
    }
    inventory.addAllItems();
    return true;
}

function unlockAllSkills(): number {
    const opts: any = g_options;
    if (typeof opts?.setDebug !== 'function') {
        //console.error('[keyboard-only] training: g_options.setDebug not available');
        return 0;
    }
    let count = 0;
    for (const flag of SKILL_DEBUG_FLAGS) {
        try {
            opts.setDebug(flag, true);
            count += 1;
        } catch (err) {
            //console.error(`[keyboard-only] training: setDebug("${flag}") failed`, err);
        }
    }
    return count;
}

function unlockAllPartyMembers(): number {
    const party: any = g_party;
    const PM: any = PartyMember;
    if (typeof party?.addPartyMember !== 'function' || typeof PM?.get !== 'function') {
        //console.error('[keyboard-only] training: party APIs not available');
        return 0;
    }
    let added = 0;
    for (const key of PARTY_KEYS) {
        try {
            if (party.hasPartyMember?.(key)) continue;
            const member = PM.get(key);
            if (!member) continue;
            party.addPartyMember(member);
            added += 1;
        } catch (err) {
            //console.error(`[keyboard-only] training: failed to add party "${key}"`, err);
        }
    }
    return added;
}

export function listEnemies(): string[] {
    const enemies = (g_enemies as any)?.enemies;
    if (enemies && typeof enemies.keys === 'function') return [...enemies.keys()];
    return [];
}

const DEFAULT_DUMMY_POSITIONS: DummyPosition[] = [
    { offsetX: -3, offsetY: 0 },
    { offsetX: 3, offsetY: 0 },
];

export function enterTrainingMode(enemyKey = DEFAULT_DUMMY): TrainingResult {
    const cores = unlockAllCores();
    const items = unlockAllItems();
    const skillFlags = unlockAllSkills();
    const partyMembers = unlockAllPartyMembers();

    let dummies = 0;
    for (const offset of DEFAULT_DUMMY_POSITIONS) {
        if (spawnDummy(offset, enemyKey)) dummies += 1;
    }

    return { cores, items, skillFlags, partyMembers, dummies };
}
