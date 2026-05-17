import { terra } from '@project-selene/api';
import { getInputAction } from '../../utils/input.js';

const INPUT_DEVICE_GAMEPAD = 2;
const MOUSE_MOVE_THRESHOLD = 12;

const NEG_X = ['left', 'menuLeft'];
const POS_X = ['right', 'menuRight'];
const NEG_Y = ['up', 'menuUp'];
const POS_Y = ['down', 'menuDown'];

function anyActive(names: string[]): boolean {
    for (const name of names) {
        if (getInputAction(name)?.isActive?.()) return true;
    }
    return false;
}

export function realGamepadPresent(): boolean {
    const inp: any = (terra as any).g_input;
    try { return inp?.currentDevice === INPUT_DEVICE_GAMEPAD; } catch { return false; }
}

export function isMapOpen(): boolean {
    const menu: any = (terra as any).g_menu;
    try { return !!menu?.isMap?.(); } catch { return false; }
}

export function isVisionActive(): boolean {
    const scene: any = (terra as any).g_scene;
    try { return !!scene?.isCommandMenu?.() && !isMapOpen(); } catch { return false; }
}

export function isMenuOpen(): boolean {
    const scene: any = (terra as any).g_scene;
    if (!scene) return false;
    try {
        return !!(scene.isMenu?.() || scene.isCommandMenu?.() || scene.isWaypointMenu?.());
    } catch { return false; }
}

export function keyboardAxisX(): number {
    return (anyActive(POS_X) ? 1 : 0) - (anyActive(NEG_X) ? 1 : 0);
}

export function keyboardAxisY(): number {
    return (anyActive(POS_Y) ? 1 : 0) - (anyActive(NEG_Y) ? 1 : 0);
}

export function navKeyHeld(): boolean {
    return anyActive(NEG_X) || anyActive(POS_X) || anyActive(NEG_Y) || anyActive(POS_Y)
        || !!getInputAction('confirm')?.isActive?.();
}

export interface StickyKeyboard {
    engaged(): boolean;
    engage(): void;
    install(): void;
    uninstall(): void;
}

export function createStickyKeyboard(): StickyKeyboard {
    let sticky = false;
    let lastX = -1;
    let lastY = -1;
    let handler: ((e: MouseEvent) => void) | null = null;

    return {
        engaged: () => sticky,
        engage: () => { sticky = true; },
        install() {
            if (handler) return;
            handler = (e: MouseEvent) => {
                if (lastX === -1) {
                    lastX = e.clientX;
                    lastY = e.clientY;
                    return;
                }
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;
                if (Math.abs(dx) + Math.abs(dy) > MOUSE_MOVE_THRESHOLD) sticky = false;
            };
            window.addEventListener('mousemove', handler, true);
        },
        uninstall() {
            if (handler) window.removeEventListener('mousemove', handler, true);
            handler = null;
            sticky = false;
        },
    };
}
