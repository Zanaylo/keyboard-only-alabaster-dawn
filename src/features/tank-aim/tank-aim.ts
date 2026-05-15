import { g_control } from '@project-selene/api/terra';
import { clearLock, lockState } from '../lock-on/lock-on.js';
import { getAiming, getPlayerActor } from '../../utils/player.js';
import { getCurrentMoveDir } from '../../utils/input.js';
import { writeVec, readVec3 } from '../../utils/vec.js';
import { getTankTurnSpeed, isAimStanceEnabled } from '../../options.js';

interface TankState {
    active: boolean;
    held: boolean;
    releasedThisFrame: boolean;
    smoothAimDir: { x: number; y: number };
    needsInit: boolean;
    lastTickMs: number;
}

export const tankState: TankState = {
    active: false,
    held: false,
    releasedThisFrame: false,
    smoothAimDir: { x: 1, y: 0 },
    needsInit: true,
    lastTickMs: 0,
};

let nextTurnSpeed: number | null = null;
export function setTurnSpeedForNextUpdate(rateRadPerSec: number): void {
    nextTurnSpeed = rateRadPerSec;
}

export function setTankHeld(held: boolean): void {
    tankState.held = held;
}

export function ensureSmoothAimDirInited(): void {
    if (!tankState.needsInit) return;
    const face = getPlayerActor()?.face;
    const vec = readVec3(face);
    if (!vec) return;
    const len = Math.hypot(vec.x, vec.y) || 1;
    tankState.smoothAimDir.x = vec.x / len;
    tankState.smoothAimDir.y = (vec.y || 1) / len;
    tankState.needsInit = false;
}

export function resetSmoothAimToFace(): void {
    tankState.needsInit = true;
    ensureSmoothAimDirInited();
}

export function updateSmoothAimDir(dt: number): void {
    const md = getCurrentMoveDir();
    if (!md) return;
    const cur = tankState.smoothAimDir;
    const angleCur = Math.atan2(cur.y, cur.x);
    const angleTarget = Math.atan2(md.y, md.x);
    let diff = angleTarget - angleCur;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const speed = nextTurnSpeed ?? getTankTurnSpeed();
    nextTurnSpeed = null;
    const turn = speed * dt;
    const step = Math.max(-turn, Math.min(turn, diff));
    const newAngle = angleCur + step;
    cur.x = Math.cos(newAngle);
    cur.y = Math.sin(newAngle);
}

export function applyAimDirOverride(): void {
    const a = getAiming();
    if (!a) return;
    const { x, y } = tankState.smoothAimDir;
    writeVec(a.playerAimDir, x, y);
    writeVec(a.aimDir, x, y);
    writeVec(a.aimFacingDir, x, y);
}

function applyTankFace(): void {
    const actor = getPlayerActor();
    if (!actor) return;
    if (typeof actor.facing?.type === 'number') actor.facing.type = 1;
    writeVec(actor.face, tankState.smoothAimDir.x, tankState.smoothAimDir.y);
    if (typeof actor.updateFigureFace === 'function') {
        try { actor.updateFigureFace(); } catch { }
    }
}

function enterTankAim(): void {
    if (tankState.active) return;
    if (lockState.entity) clearLock();
    tankState.active = true;
    tankState.needsInit = true;
    ensureSmoothAimDirInited();
}

function exitTankAim(): void {
    if (!tankState.active) return;
    tankState.active = false;
    tankState.needsInit = true;
    const a = getAiming();
    if (a?.active && !lockState.entity) a.active = false;
    const actor = getPlayerActor();
    if (typeof actor?.facing?.type === 'number') actor.facing.type = 0;
}

let origGetMoveDir: any = null;
let origMouseAiming: any = null;
let origMouseAimEnded: any = null;
let owner: any = null;
let hooksInstalled = false;

export function ensureTankAimHooks(): boolean {
    if (hooksInstalled) return true;
    const ctrl: any = g_control;
    if (!ctrl) return false;
    owner = ctrl;

    if (typeof ctrl.getMoveDir === 'function' && !origGetMoveDir) {
        const original = ctrl.getMoveDir.bind(ctrl);
        origGetMoveDir = original;
        ctrl.getMoveDir = function (dir: any, stepAngle: any, roundCardinal: any) {
            if (tankState.active) {
                if (typeof dir?.setZero === 'function') dir.setZero();
                else if (dir) { dir.x = 0; dir.y = 0; }
                return dir;
            }
            return original(dir, stepAngle, roundCardinal);
        };
    }
    if (typeof ctrl.mouseAiming === 'function' && !origMouseAiming) {
        const original = ctrl.mouseAiming.bind(ctrl);
        origMouseAiming = original;
        ctrl.mouseAiming = function () { return tankState.active || original(); };
    }
    if (typeof ctrl.mouseAimEnded === 'function' && !origMouseAimEnded) {
        const original = ctrl.mouseAimEnded.bind(ctrl);
        origMouseAimEnded = original;
        ctrl.mouseAimEnded = function () { return tankState.releasedThisFrame || original(); };
    }

    hooksInstalled = true;
    return true;
}

export function uninstallTankAimHooks(): void {
    if (!hooksInstalled) return;
    const ctrl: any = owner;
    if (ctrl) {
        if (origGetMoveDir) ctrl.getMoveDir = origGetMoveDir;
        if (origMouseAiming) ctrl.mouseAiming = origMouseAiming;
        if (origMouseAimEnded) ctrl.mouseAimEnded = origMouseAimEnded;
    }
    origGetMoveDir = origMouseAiming = origMouseAimEnded = null;
    owner = null;
    hooksInstalled = false;
}

export function preTickTankAim(): void {
    const now = performance.now();
    const dt = tankState.lastTickMs ? Math.min(0.1, (now - tankState.lastTickMs) / 1000) : 0.016;
    tankState.lastTickMs = now;

    if (tankState.releasedThisFrame) tankState.releasedThisFrame = false;

    if (!isAimStanceEnabled()) {
        if (tankState.active) exitTankAim();
        tankState.held = false;
        return;
    }

    if (tankState.held && !tankState.active) enterTankAim();
    else if (!tankState.held && tankState.active) {
        tankState.releasedThisFrame = true;
        exitTankAim();
    }

    if (tankState.active || tankState.releasedThisFrame) {
        ensureSmoothAimDirInited();
        updateSmoothAimDir(dt);
        const a = getAiming();
        if (a && !a.active && tankState.active) a.active = true;
        applyAimDirOverride();
    }
}

export function tickTankAim(): void {
    if (tankState.active) applyTankFace();
}
