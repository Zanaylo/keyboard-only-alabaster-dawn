import { terra } from '@project-selene/api';
import { isModEnabled, isMenuNavEnabled } from '../../options.js';
import {
    realGamepadPresent,
    isMapOpen,
    isVisionActive,
    isMenuOpen,
    keyboardAxisX,
    keyboardAxisY,
} from './nav-core.js';

const AXIS_LEFT_X = 'LeftStickX';
const AXIS_LEFT_Y = 'LeftStickY';
const AXIS_RIGHT_Y = 'RightStickY';

const ZOOM_IN_CODES = new Set(['Equal', 'NumpadAdd']);
const ZOOM_OUT_CODES = new Set(['Minus', 'NumpadSubtract']);

let zoomInHeld = false;
let zoomOutHeld = false;

let origGetGPAxis: any = null;
let gpOwner: any = null;
let installed = false;
let zoomKeydown: ((e: KeyboardEvent) => void) | null = null;
let zoomKeyup: ((e: KeyboardEvent) => void) | null = null;

function modNavActive(): boolean {
    return isModEnabled() && isMenuNavEnabled() && !realGamepadPresent();
}

export function shouldSpoofGamepad(): boolean {
    return modNavActive() && isMenuOpen() && !isMapOpen() && !isVisionActive();
}

function shouldBridgeStick(): boolean {
    return modNavActive() && (isMapOpen() || isVisionActive());
}

export function ensureGamepadBridge(): boolean {
    if (installed) return true;
    const inp: any = (terra as any).g_input;
    if (typeof inp?.getGPAxisValue !== 'function') return false;

    const orig = inp.getGPAxisValue.bind(inp);
    origGetGPAxis = orig;
    gpOwner = inp;

    inp.getGPAxisValue = function (axis: any) {
        if (!shouldBridgeStick()) return orig(axis);
        if (axis === AXIS_LEFT_X) {
            const v = keyboardAxisX();
            return v !== 0 ? v : orig(axis);
        }
        if (axis === AXIS_LEFT_Y) {
            const v = keyboardAxisY();
            return v !== 0 ? v : orig(axis);
        }
        if (axis === AXIS_RIGHT_Y && isMapOpen()) {
            if (zoomInHeld) return -1;
            if (zoomOutHeld) return 1;
        }
        return orig(axis);
    };

    installed = true;
    return true;
}

export function uninstallGamepadBridge(): void {
    if (!installed) return;
    if (gpOwner && origGetGPAxis) gpOwner.getGPAxisValue = origGetGPAxis;
    origGetGPAxis = null;
    gpOwner = null;
    installed = false;
}

export function installZoomKeys(): void {
    zoomKeydown = (e: KeyboardEvent) => {
        if (ZOOM_IN_CODES.has(e.code)) zoomInHeld = true;
        else if (ZOOM_OUT_CODES.has(e.code)) zoomOutHeld = true;
    };
    zoomKeyup = (e: KeyboardEvent) => {
        if (ZOOM_IN_CODES.has(e.code)) zoomInHeld = false;
        else if (ZOOM_OUT_CODES.has(e.code)) zoomOutHeld = false;
    };
    window.addEventListener('keydown', zoomKeydown, true);
    window.addEventListener('keyup', zoomKeyup, true);
}

export function uninstallZoomKeys(): void {
    if (zoomKeydown) window.removeEventListener('keydown', zoomKeydown, true);
    if (zoomKeyup) window.removeEventListener('keyup', zoomKeyup, true);
    zoomKeydown = zoomKeyup = null;
    zoomInHeld = zoomOutHeld = false;
}

export function isZoomKeyHeld(): boolean {
    return zoomInHeld || zoomOutHeld;
}
