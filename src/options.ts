import { g_options } from '@project-selene/api/terra';

function get(key: string, fallback: any): any {
    const opts: any = g_options;
    if (!opts || typeof opts.get !== 'function') return fallback;
    try {
        const v = opts.get(key);
        return v === undefined || v === null ? fallback : v;
    } catch {
        return fallback;
    }
}

//Master switch

export function isModEnabled(): boolean {
    return get('keyboard-only-enabled', true) === true;
}

//Feature toggles

export function isLockOnEnabled(): boolean {
    return isModEnabled() && get('keyboard-only-feature-lock-on', true) === true;
}

export function isAimStanceEnabled(): boolean {
    return isModEnabled() && get('keyboard-only-feature-aim-stance', true) === true;
}

//Needs fix for later
//Ajustar essa merda para depois pqp
export function isInteractFixEnabled(): boolean {
    return isModEnabled() && get('keyboard-only-feature-interact', true) === true;
}

export function isMenuNavEnabled(): boolean {
    return isModEnabled() && get('keyboard-only-feature-menu-nav', true) === true;
}

export function isKbOnlyTwinStickEnabled(): boolean {
    return isModEnabled() && get('keyboard-only-mode', false) === true;
}

//Remember: Keybinds are handled by the native input system — see register-actions.ts.

const TANK_MAX_RAD_PER_SEC = 10;
const AIM_HOLD_MAX_RAD_PER_SEC = 10;
const COMBAT_ART_MAX_RAD_PER_SEC = 60;

function pctOf(pct: number, max: number): number {
    return (pct / 100) * max;
}

export function getTankTurnSpeed(): number {
    return pctOf(Number(get('keyboard-only-tank-turn-speed', 45)), TANK_MAX_RAD_PER_SEC);
}

export function getAimHoldTurnSpeed(): number {
    return pctOf(Number(get('keyboard-only-aim-hold-turn-speed', 60)), AIM_HOLD_MAX_RAD_PER_SEC);
}

export function getCombatArtTurnSpeed(): number {
    return pctOf(Number(get('keyboard-only-combat-art-turn-speed', 50)), COMBAT_ART_MAX_RAD_PER_SEC);
}
