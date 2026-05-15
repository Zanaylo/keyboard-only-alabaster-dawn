import { lockState } from '../lock-on/lock-on.js';
import {
    tankState,
    ensureSmoothAimDirInited,
    updateSmoothAimDir,
    applyAimDirOverride,
    resetSmoothAimToFace,
    setTurnSpeedForNextUpdate,
} from '../tank-aim/tank-aim.js';
import { isAimingActive } from '../../utils/player.js';
import { isKbOnlyTwinStickEnabled, getAimHoldTurnSpeed } from '../../options.js';

const MOUSE_AUTOHIDE_MS = 2000;
const CSS_CLASS = 'keyboard-only-cursor-hidden';
const CSS_ID = 'keyboard-only-cursor-style';

interface KbState {
    lastMouseMoveAt: number;
    lastTickMs: number;
    cssInjected: boolean;
    mousemoveHandler: ((e: MouseEvent) => void) | null;
    cursorHidden: boolean;
    runtimeOverride: boolean | null;
    lastAimingActive: boolean;
}

const kbState: KbState = {
    lastMouseMoveAt: 0,
    lastTickMs: 0,
    cssInjected: false,
    mousemoveHandler: null,
    cursorHidden: false,
    runtimeOverride: null,
    lastAimingActive: false,
};

export function isKeyboardOnlyMode(): boolean {
    if (kbState.runtimeOverride !== null) return kbState.runtimeOverride;
    return isKbOnlyTwinStickEnabled();
}

export function setKeyboardOnlyOverride(value: boolean | null): void {
    kbState.runtimeOverride = value;
}

function ensureCss(): void {
    if (kbState.cssInjected || document.getElementById(CSS_ID)) {
        kbState.cssInjected = true;
        return;
    }
    const element = document.createElement('style');
    element.id = CSS_ID;
    element.textContent = `body.${CSS_CLASS}, body.${CSS_CLASS} * { cursor: none !important; }`;
    document.head.appendChild(element);
    kbState.cssInjected = true;
}

function setCursorHidden(hidden: boolean): void {
    if (hidden === kbState.cursorHidden) return;
    ensureCss();
    kbState.cursorHidden = hidden;
    if (hidden) document.body.classList.add(CSS_CLASS);
    else document.body.classList.remove(CSS_CLASS);
}

export function installKbOnlyInput(): void {
    if (kbState.mousemoveHandler) return;
    kbState.mousemoveHandler = () => { kbState.lastMouseMoveAt = performance.now(); };
    window.addEventListener('mousemove', kbState.mousemoveHandler);
}

export function uninstallKbOnlyInput(): void {
    if (kbState.mousemoveHandler) {
        window.removeEventListener('mousemove', kbState.mousemoveHandler);
        kbState.mousemoveHandler = null;
    }
    setCursorHidden(false);
}

export function preTickKbOnly(): void {
    const now = performance.now();
    const dt = kbState.lastTickMs ? Math.min(0.1, (now - kbState.lastTickMs) / 1000) : 0.016;
    kbState.lastTickMs = now;

    const enabled = isKeyboardOnlyMode();
    const aimingActive = isAimingActive();

    if (enabled && aimingActive && !kbState.lastAimingActive) {
        resetSmoothAimToFace();
    }
    kbState.lastAimingActive = aimingActive;

    if (enabled) {
        const idle = kbState.lastMouseMoveAt === 0 ? Infinity : now - kbState.lastMouseMoveAt;
        setCursorHidden(idle > MOUSE_AUTOHIDE_MS);
    } else {
        setCursorHidden(false);
    }

    if (enabled && !lockState.entity && !tankState.active) {
        ensureSmoothAimDirInited();
        setTurnSpeedForNextUpdate(getAimHoldTurnSpeed());
        updateSmoothAimDir(dt);
        applyAimDirOverride();
    }
}