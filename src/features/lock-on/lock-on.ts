import { g_playerTargets } from '@project-selene/api/terra';
import {
    Enemy,
    Entity,
    buildEnemyList,
    findEntryForEntity,
    getEntityWorldPos,
    getPlayerPos,
    isAliveEnemyLike,
    isOnScreen,
} from './enemy-query.js';
import { applyCameraAnchor, applyCameraInputLean, resetCameraOffset } from './camera.js';
import { isLockOnEnabled } from '../../options.js';
import { getPlayer, getPlayerActor, isAimingActive } from '../../utils/player.js';
import { getCurrentMoveDir } from '../../utils/input.js';
import { writeVec } from '../../utils/vec.js';

const FACE_LERP = 0.35;

interface LockState {
    active: boolean;
    entity: Entity | null;
    entry: Enemy | null;
    sortedEnts: Entity[];
    sortedIndex: number;
    pressedThisFrame: boolean;
}

export const lockState: LockState = {
    active: false,
    entity: null,
    entry: null,
    sortedEnts: [],
    sortedIndex: -1,
    pressedThisFrame: false,
};

export function requestCycle(): void {
    lockState.pressedThisFrame = true;
}

export function clearLock(): void {
    lockState.active = false;
    lockState.entity = null;
    lockState.entry = null;
    lockState.sortedEnts = [];
    lockState.sortedIndex = -1;
    resetCameraOffset();
    const pT: any = g_playerTargets;
    if (pT && pT.currentTarget !== null) pT.currentTarget = null;
}

export function cycleLock(): void {
    const list = buildEnemyList(true);
    if (!list.length) { clearLock(); return; }

    if (!lockState.active || !lockState.entity) {
        const pick = list[0];
        Object.assign(lockState, { entity: pick.ent, entry: pick.entry, active: true });
        lockState.sortedEnts = list.map(it => it.ent);
        lockState.sortedIndex = 0;
        return;
    }

    const idx = list.findIndex(it => it.ent === lockState.entity);
    if (idx === -1) {
        const pick = list[0];
        Object.assign(lockState, { entity: pick.ent, entry: pick.entry });
        lockState.sortedEnts = list.map(it => it.ent);
        lockState.sortedIndex = 0;
        return;
    }
    if (idx + 1 >= list.length) { clearLock(); return; }

    const pick = list[idx + 1];
    Object.assign(lockState, { entity: pick.ent, entry: pick.entry });
    lockState.sortedEnts = list.map(it => it.ent);
    lockState.sortedIndex = idx + 1;
}

function autoPickClosestAlive(): boolean {
    const list = buildEnemyList(true);
    if (!list.length) { clearLock(); return false; }
    const pick = list[0];
    Object.assign(lockState, { entity: pick.ent, entry: pick.entry, active: true });
    lockState.sortedEnts = list.map(it => it.ent);
    lockState.sortedIndex = 0;
    return true;
}

function lockedEntityStillValid(): boolean {
    if (!lockState.entity) return false;
    if (!isAliveEnemyLike(lockState.entity)) return false;
    if (!isOnScreen(lockState.entity)) return false;
    return true;
}

function forceFaceTowardLock(): void {
    if (!lockState.entity || !isAimingActive()) return;
    if (getCurrentMoveDir()) return;

    const actor = getPlayerActor();
    if (!actor?.face) return;

    const ppos = getPlayerPos();
    const tpos = getEntityWorldPos(lockState.entity);
    if (!ppos || !tpos) return;
    const dx = tpos.x - ppos.x, dy = tpos.y - ppos.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;

    const nx = dx / len, ny = dy / len;
    const f = actor.face;
    const cx = f.x ?? 0, cy = f.y ?? 1;
    const lx = cx + (nx - cx) * FACE_LERP;
    const ly = cy + (ny - cy) * FACE_LERP;
    const llen = Math.hypot(lx, ly) || 1;
    writeVec(f, lx / llen, ly / llen);
}

function applyLockToTargets(): boolean {
    if (!lockState.entity) return false;
    const pT: any = g_playerTargets;
    if (!pT) return false;

    if (!lockState.entry || lockState.entry.target?.entity !== lockState.entity) {
        lockState.entry = findEntryForEntity(lockState.entity);
    }
    if (!lockState.entry) return false;

    pT.currentTarget = lockState.entry;
    try { pT.preciseShootTarget?.set?.(lockState.entry.target); } catch { /* ignore */ }
    pT.targetBlocked = false;
    pT.cancelAim = false;
    if ('rediredAim' in pT) pT.rediredAim = false;
    if ('targetingTimer' in pT) pT.targetingTimer = 0;
    return true;
}

let originalUpdateTarget: any = null;
let updateTargetOwner: any = null;
let updateTargetHookInstalled = false;

export function ensureUpdateTargetHook(): boolean {
    if (updateTargetHookInstalled) return true;
    const pT: any = g_playerTargets;
    if (typeof pT?.updateTarget !== 'function') return false;

    const original = pT.updateTarget.bind(pT);
    originalUpdateTarget = original;
    updateTargetOwner = pT;

    pT.updateTarget = function (...args: any[]) {
        const [aimPos, startScreenPos, worldDir, startPos, bestPos, lockingReady, lock] = args;
        if (lockState.entity && isAimingActive()) {
            if (!lockedEntityStillValid() && !autoPickClosestAlive()) {
                return original(aimPos, startScreenPos, worldDir, startPos, bestPos, lockingReady, lock);
            }
            if (applyLockToTargets() && lockState.entry) {
                try { lockState.entry.target?.get?.(bestPos); } catch { /* ignore */ }
                return false;
            }
        }
        return original(aimPos, startScreenPos, worldDir, startPos, bestPos, lockingReady, lock);
    };

    updateTargetHookInstalled = true;
    return true;
}

export function uninstallUpdateTargetHook(): void {
    if (!updateTargetHookInstalled) return;
    if (updateTargetOwner && originalUpdateTarget) updateTargetOwner.updateTarget = originalUpdateTarget;
    originalUpdateTarget = null;
    updateTargetOwner = null;
    updateTargetHookInstalled = false;
}

let originalAimTargetHudRender: any = null;
let aimTargetHudOwner: any = null;
let aimTargetHudHookInstalled = false;

export function ensureAimTargetHudWrap(): boolean {
    if (aimTargetHudHookInstalled) return true;
    const player = getPlayer();
    const hud = player?.aimTargetHud;
    if (typeof hud?.render !== 'function') return false;

    const original = hud.render.bind(hud);
    originalAimTargetHudRender = original;
    aimTargetHudOwner = hud;

    hud.render = function (renderer: any) {
        if (lockState.entity && !isAimingActive() && lockedEntityStillValid()) {
            const aiming = player.aiming;
            if (aiming?.active === false) {
                aiming.active = true;
                try { original(renderer); }
                finally { aiming.active = false; }
                return;
            }
        }
        return original(renderer);
    };

    aimTargetHudHookInstalled = true;
    return true;
}

export function uninstallAimTargetHudWrap(): void {
    if (!aimTargetHudHookInstalled) return;
    if (aimTargetHudOwner && originalAimTargetHudRender) aimTargetHudOwner.render = originalAimTargetHudRender;
    originalAimTargetHudRender = null;
    aimTargetHudOwner = null;
    aimTargetHudHookInstalled = false;
}

export function tickLockOn(): void {
    if (!isLockOnEnabled()) {
        if (lockState.entity) clearLock();
        lockState.pressedThisFrame = false;
        return;
    }
    ensureUpdateTargetHook();

    if (lockState.pressedThisFrame) {
        cycleLock();
        lockState.pressedThisFrame = false;
    }

    if (lockState.entity) {
        if (!lockedEntityStillValid() && !autoPickClosestAlive()) {
            applyCameraInputLean();
            return;
        }
        forceFaceTowardLock();
        applyLockToTargets();
        applyCameraAnchor();
    } else {
        applyCameraInputLean();
    }
}
