import { StartPlayerWeaponActionStep, PlayerCmp } from '@project-selene/api/terra';
import { lockState } from '../lock-on/lock-on.js';
import { tankState, ensureSmoothAimDirInited, updateSmoothAimDir, applyAimDirOverride, setTurnSpeedForNextUpdate, resetSmoothAimToFace } from '../tank-aim/tank-aim.js';
import { getPlayerCmp, getPlayerState, PLAYER_STATE } from '../../utils/player.js';
import { getCurrentMoveDir } from '../../utils/input.js';
import { getCombatArtTurnSpeed } from '../../options.js';

let lastTickMs = 0;
let wasInCombatArt = false;

function redirectControlDir(player: any, x: number, y: number): void {
    if (!player?.controlDir?.setC) return;
    try { player.controlDir.setC(x, y); } catch { /* ignore */ }
}

let origStartMeleeAction: any = null;
let origWeaponActionStart: any = null;
let meleeWrapInstalled = false;
let weaponActionWrapInstalled = false;

function installStartMeleeActionWrap(): boolean {
    if (meleeWrapInstalled) return true;
    const proto: any = (PlayerCmp as any)?.prototype;
    if (typeof proto?.startMeleeAction !== 'function') return false;
    if (proto.__keyboardOnlyMeleeWrapped) { meleeWrapInstalled = true; return true; }

    const orig = proto.startMeleeAction;
    origStartMeleeAction = orig;
    proto.startMeleeAction = function (this: any, weapon: any, node: any) {
        const result = orig.call(this, weapon, node);
        if (lockState.entity) {
            const md = getCurrentMoveDir();
            if (md) redirectControlDir(this, md.x, md.y);
        }
        return result;
    };
    proto.__keyboardOnlyMeleeWrapped = true;
    meleeWrapInstalled = true;
    return true;
}

function installWeaponActionWrap(): boolean {
    if (weaponActionWrapInstalled) return true;
    const proto: any = (StartPlayerWeaponActionStep as any)?.prototype;
    if (typeof proto?.start !== 'function') return false;
    if (proto.__keyboardOnlyWrapped) { weaponActionWrapInstalled = true; return true; }

    const orig = proto.start;
    origWeaponActionStart = orig;
    proto.start = function (this: any, context: any) {
        const result = orig.call(this, context);
        if (this.prepare && lockState.entity) {
            const md = getCurrentMoveDir();
            if (md) redirectControlDir(getPlayerCmp(), md.x, md.y);
        }
        return result;
    };
    proto.__keyboardOnlyWrapped = true;
    weaponActionWrapInstalled = true;
    return true;
}

export function ensureCombatArtFaceWrap(): boolean {
    return installStartMeleeActionWrap() && installWeaponActionWrap();
}

export function uninstallCombatArtFaceWrap(): void {
    const proto1: any = (PlayerCmp as any)?.prototype;
    if (proto1 && origStartMeleeAction) {
        proto1.startMeleeAction = origStartMeleeAction;
        delete proto1.__keyboardOnlyMeleeWrapped;
    }
    origStartMeleeAction = null;
    meleeWrapInstalled = false;

    const proto2: any = (StartPlayerWeaponActionStep as any)?.prototype;
    if (proto2 && origWeaponActionStart) {
        proto2.start = origWeaponActionStart;
        delete proto2.__keyboardOnlyWrapped;
    }
    origWeaponActionStart = null;
    weaponActionWrapInstalled = false;
}

function isInCombatArt(player: any): boolean {
    return player?.inputBuffer?.chargeMove === true;
}

export function preTickCombatArtRedirect(): void {
    if (tankState.active) {
        wasInCombatArt = false;
        return;
    }
    if (getPlayerState() === PLAYER_STATE.AIMING) {
        wasInCombatArt = false;
        return;
    }

    const player = getPlayerCmp();
    const locked = !!lockState.entity;
    const inCombatArt = isInCombatArt(player);

    if (inCombatArt && !wasInCombatArt) resetSmoothAimToFace();
    wasInCombatArt = inCombatArt;

    if (!locked && !inCombatArt) return;
    if (!getCurrentMoveDir()) return;

    const now = performance.now();
    const dt = lastTickMs ? Math.min(0.1, (now - lastTickMs) / 1000) : 0.016;
    lastTickMs = now;

    ensureSmoothAimDirInited();
    setTurnSpeedForNextUpdate(getCombatArtTurnSpeed());
    updateSmoothAimDir(dt);
    if (locked) applyAimDirOverride();

    const sd = tankState.smoothAimDir;
    redirectControlDir(player, sd.x, sd.y);
}

//tentei não consigo fazer os speeds serem o mesmo, vou deixar assim por enquanto depois eu melhoro esse sistema.