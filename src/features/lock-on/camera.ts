import { getPlayer } from '../../utils/player.js';
import { getCurrentMoveDir } from '../../utils/input.js';
import { lockState } from './lock-on.js';
import { getEntityWorldPos, getPlayerPos } from './enemy-query.js';

const ANCHOR_FACTOR = 0.45;
const ANCHOR_LERP = 0.2;
const INPUT_LEAN_FACTOR = 0.6;
const INPUT_LEAN_LERP = 0.35;
const RESET_LERP = 0.4;

function getCamera(): any {
    return getPlayer()?.camera ?? null;
}

function setOffset(x: number, y: number, z: number, duration: number): void {
    const cam = getCamera();
    if (typeof cam?.state?.setOffset !== 'function') return;
    try { cam.state.setOffset(x, y, z, duration); } catch { }
}

export function applyCameraAnchor(): void {
    if (!lockState.entity) return;
    const ppos = getPlayerPos();
    const tpos = getEntityWorldPos(lockState.entity);
    if (!ppos || !tpos) return;
    setOffset((tpos.x - ppos.x) * ANCHOR_FACTOR, (tpos.y - ppos.y) * ANCHOR_FACTOR, 0, ANCHOR_LERP);
}

export function applyCameraInputLean(): void {
    const md = getCurrentMoveDir();
    if (!md) { setOffset(0, 0, 0, INPUT_LEAN_LERP); return; }
    setOffset(md.x * INPUT_LEAN_FACTOR, md.y * INPUT_LEAN_FACTOR, 0, INPUT_LEAN_LERP);
}

export function resetCameraOffset(): void {
    setOffset(0, 0, 0, RESET_LERP);
}
