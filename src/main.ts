import { Injectable, Mod } from '@project-selene/api';
import { Game, g_scene } from '@project-selene/api/terra';
import { requestCycle, tickLockOn, clearLock, lockState, ensureUpdateTargetHook, uninstallUpdateTargetHook, ensureAimTargetHudWrap, uninstallAimTargetHudWrap } from './features/lock-on/lock-on.js';
import { ensureSetCursorPosWrap, uninstallSetCursorPosWrap } from './features/lock-on/aim-override.js';
import { debugDump, inspectEntry } from './features/lock-on/enemy-query.js';
import { ensureInteractWrap, uninstallInteractWrap } from './features/interact/interact.js';
import { setTankHeld, preTickTankAim, tickTankAim, tankState, ensureTankAimHooks, uninstallTankAimHooks } from './features/tank-aim/tank-aim.js';
import { ensureKeyboardMenuNav, uninstallKeyboardMenuNav, tickSkillTreeNav, navState } from './features/menu-nav/skill-tree-nav.js';
import { ensureGamepadBridge, uninstallGamepadBridge, installZoomKeys, uninstallZoomKeys } from './features/menu-nav/gamepad-bridge.js';
import { ensureMenuExtra, installMenuExtra, uninstallMenuExtra } from './features/menu-nav/menu-extra.js';
import { preTickKbOnly, installKbOnlyInput, uninstallKbOnlyInput, isKeyboardOnlyMode, setKeyboardOnlyOverride } from './features/keyboard-only/keyboard-only-mode.js';
import { ensureDivineArtFaceWrap, uninstallDivineArtFaceWrap, preTickDivineArtRedirect } from './features/divine-arts/divine-arts.js';
import { enterTrainingMode, listEnemies } from './features/training/training-mode.js';
import { isModEnabled, isLockOnEnabled, isAimStanceEnabled } from './options.js';
import { ensureCustomActionsRegistered, actionMatchesEventCode, getActionBoundKey } from './input/register-actions.js';

const ENSURE_HOOKS = [
    ensureCustomActionsRegistered,
    ensureDivineArtFaceWrap,
    ensureUpdateTargetHook,
    ensureSetCursorPosWrap,
    ensureAimTargetHudWrap,
    ensureInteractWrap,
    ensureTankAimHooks,
    ensureKeyboardMenuNav,
    ensureGamepadBridge,
    ensureMenuExtra,
];

class KeyboardOnlyLockOn extends Injectable(Game) {
    update() {
        try {
            for (const ensure of ENSURE_HOOKS) ensure();
            preTickKbOnly();
            if (g_scene?.isRunning?.()) {
                preTickDivineArtRedirect();
                preTickTankAim();
            }
            tickSkillTreeNav();
        } catch (err) {
        }

        const r = super.update();

        try {
            if (g_scene?.isRunning?.()) {
                tickLockOn();
                tickTankAim();
            }
        } catch (err) {
        }
        return r;
    }
}

let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let keyupHandler: ((event: KeyboardEvent) => void) | null = null;

function shouldIgnoreInput(event: KeyboardEvent): boolean {
    const tagret = event.target as HTMLElement | null;
    return !!(tagret && (tagret.tagName === 'INPUT' || tagret.tagName === 'TEXTAREA' || tagret.isContentEditable));
}

function installInput(): void {
    keydownHandler = (event: KeyboardEvent) => {
        if (shouldIgnoreInput(event) || !isModEnabled()) return;
        if (!g_scene?.isRunning?.()) return;
        if (actionMatchesEventCode('lockOn', event.code) && !event.repeat && isLockOnEnabled()) {
            requestCycle();
        } else if (actionMatchesEventCode('aimStance', event.code) && isAimStanceEnabled()) {
            setTankHeld(true);
        }
    };
    keyupHandler = (e: KeyboardEvent) => {
        if (actionMatchesEventCode('aimStance', e.code)) setTankHeld(false);
    };
    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
}

function uninstallInput(): void {
    if (keydownHandler) window.removeEventListener('keydown', keydownHandler);
    if (keyupHandler) window.removeEventListener('keyup', keyupHandler);
    keydownHandler = keyupHandler = null;
}

(globalThis as any).__keyboardOnly = {
    state: lockState,
    tank: tankState,
    nav: navState,
    cycle: requestCycle,
    unlock: clearLock,
    debug: debugDump,
    target: () => inspectEntry(lockState.entry),
    isKbOnly: isKeyboardOnlyMode,
    setKbOnly: setKeyboardOnlyOverride,
    train: enterTrainingMode,
    listEnemies,
};

export default function main(mod: Mod) {
    mod.inject(KeyboardOnlyLockOn);
    installInput();
    installKbOnlyInput();
    installZoomKeys();
    installMenuExtra();
}

export function unload() {
    uninstallInput();
    uninstallKbOnlyInput();
    uninstallZoomKeys();
    uninstallGamepadBridge();
    uninstallMenuExtra();
    uninstallUpdateTargetHook();
    uninstallSetCursorPosWrap();
    uninstallAimTargetHudWrap();
    uninstallInteractWrap();
    uninstallTankAimHooks();
    uninstallKeyboardMenuNav();
    uninstallDivineArtFaceWrap();
    clearLock();
}
