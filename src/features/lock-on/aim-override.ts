import { terra } from '@project-selene/api';
import { lockState } from './lock-on.js';
import { getEntityWorldPos, getPlayerPos } from './enemy-query.js';
import { tankState } from '../tank-aim/tank-aim.js';
import { isKeyboardOnlyMode } from '../keyboard-only/keyboard-only-mode.js';
import { getAiming, getPlayerState, PLAYER_STATE } from '../../utils/player.js';
import { getCurrentMoveDir } from '../../utils/input.js';
import { readVec3 } from '../../utils/vec.js';

//needs some testing, maybe increase value. Don't know yet
const AIM_PROJECT_DISTANCE = 18;

function projectAimToScreen(forwardX: number, forwardY: number, dest: any): boolean {
    const renderer = (terra as any).g_triRenderer;
    if (typeof renderer?.perspectiveView?.getScreenPointFromWorldPoint !== 'function') return false;
    const aiming = getAiming();
    const sp = readVec3(aiming?.playerStartPos);
    if (!sp || !dest) return false;
    const tmp = {
        x: sp.x + forwardX * AIM_PROJECT_DISTANCE,
        y: sp.y + forwardY * AIM_PROJECT_DISTANCE,
        z: sp.z,
    };
    try {
        renderer.perspectiveView.getScreenPointFromWorldPoint(tmp, dest);
        return true;
    } catch { return false; }
}

let original: any = null;
let owner: any = null;
let installed = false;

function pickOverrideDirection(): { x: number; y: number } | null {
    const tankEngaged = tankState.active || tankState.releasedThisFrame;
    const useSmooth = tankEngaged || isKeyboardOnlyMode();

    if (lockState.entity) {
        const md = getCurrentMoveDir();
        const state = getPlayerState();
        if (md && state !== PLAYER_STATE.AIMING) {
            return tankState.smoothAimDir;
        }
        const ppos = getPlayerPos();
        const tpos = getEntityWorldPos(lockState.entity);
        if (ppos && tpos) return { x: tpos.x - ppos.x, y: tpos.y - ppos.y };
        return null;
    }

    if (useSmooth) return tankState.smoothAimDir;
    return null;
}

export function ensureSetCursorPosWrap(): boolean {
    if (installed) return true;
    const aiming = getAiming();
    if (typeof aiming?.setCursorPos !== 'function') return false;

    const orig = aiming.setCursorPos.bind(aiming);
    original = orig;
    owner = aiming;

    aiming.setCursorPos = function (this: any, posX: number, posY: number, moveDir: any) {
        orig(posX, posY, moveDir);

        const dir = pickOverrideDirection();
        if (!dir) return;

        if (this.playerAimDir?.setC) this.playerAimDir.setC(dir.x, dir.y);
        if (this.aimDir?.setC) this.aimDir.setC(dir.x, dir.y);
        if (this.aimFacingDir?.setC) this.aimFacingDir.setC(dir.x, dir.y);

        if (this.aimScreenPos && projectAimToScreen(dir.x, dir.y, this.aimScreenPos)) {
            this.hud?.crosshair?.setAimPos?.(this.aimScreenPos.x, this.aimScreenPos.y);
        }
    };

    installed = true;
    return true;
}

export function uninstallSetCursorPosWrap(): void {
    if (!installed) return;
    if (owner && original) owner.setCursorPos = original;
    original = null;
    owner = null;
    installed = false;
}
