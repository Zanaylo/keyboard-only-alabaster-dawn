import { terra } from '@project-selene/api';
import {
    g_control,
    CONTROL_MAP,
    DEFAULT_BINDING,
    ControlConfig,
    ActiveInput,
} from '@project-selene/api/terra';

interface ActionSpec {
    name: string;
    pcKey: string;
    gamepadKey: string | null;
    header: string | null;
}

const ACTIONS: ActionSpec[] = [
    { name: 'lockOn', pcKey: 'KeyP', gamepadKey: null, header: 'keyboard-only' },
    { name: 'aimStance', pcKey: 'KeyY', gamepadKey: null, header: null },
];

let registered = false;

function buildConfig(key: string | null, header: string | null): any {
    const cfg: any = { key1: key, group: 'DEFAULT' };
    if (header) cfg.header = header;
    return cfg;
}

function registerOne(spec: ActionSpec): void {
    const ctrl: any = g_control;
    const map: any = CONTROL_MAP;
    const binding: any = DEFAULT_BINDING;
    const inputActions = (terra as any).INPUT_ACTIONS;
    const inputActionsKeys = (terra as any).INPUT_ACTIONS_KEYS;

    if (!ctrl || !map || !binding || !inputActions || !inputActionsKeys) return;

    if (map.PC && !map.PC[spec.name]) {
        map.PC[spec.name] = new (ControlConfig as any)(buildConfig(spec.pcKey, spec.header));
    }
    if (map.GAMEPAD && !map.GAMEPAD[spec.name]) {
        map.GAMEPAD[spec.name] = new (ControlConfig as any)(buildConfig(spec.gamepadKey, null));
    }

    if (!inputActions[spec.name]) {
        inputActions[spec.name] = binding.action(spec.name);
        inputActionsKeys.push(spec.name);
    }
    const action = inputActions[spec.name];
    if (spec.pcKey && !action.inputs.has(spec.pcKey)) action.bind(spec.pcKey);

    if (ctrl.currentLayout && !ctrl.currentLayout[spec.name]) {
        ctrl.currentLayout[spec.name] = new (ActiveInput as any)();
    }
    const layout = ctrl.currentLayout?.[spec.name];
    if (layout) {
        if (typeof layout.addConfig === 'function') {
            try {
                if (map.PC?.[spec.name]) layout.addConfig('PC', map.PC[spec.name]);
                if (map.GAMEPAD?.[spec.name]) layout.addConfig('GAMEPAD', map.GAMEPAD[spec.name]);
            } catch { }
        }
        if (spec.pcKey) {
            if (spec.pcKey.startsWith('PAD_')) layout.gamepad = spec.pcKey;
            else if (!layout.keyboard1) layout.keyboard1 = spec.pcKey;
        }
    }
}

function reorderToFront(): void {
    const map: any = CONTROL_MAP;
    if (!map?.PC) return;
    const names = ACTIONS.map(a => a.name);

    for (const slot of ['PC', 'GAMEPAD'] as const) {
        const old = map[slot];
        if (!old) continue;
        const keys = Object.keys(old);
        if (names.every((n, i) => keys[i] === n)) continue;
        const reordered: any = {};
        for (const n of names) if (old[n] !== undefined) reordered[n] = old[n];
        for (const k of keys) if (!names.includes(k)) reordered[k] = old[k];
        map[slot] = reordered;
    }
}
//melhorar dps
export function ensureCustomActionsRegistered(): boolean {
    if (registered) return true;
    const ctrl: any = g_control;
    const map: any = CONTROL_MAP;
    if (!ctrl?.currentLayout || !map?.PC) return false;
    for (const spec of ACTIONS) {
        try { registerOne(spec); }
        catch (err) {
            //console.error('[keyboard-only] registerOne failed', spec.name, err); 
        }
    }
    try { reorderToFront(); }
    catch (err) { 
        // console.error('[keyboard-only] reorderToFront failed', err); 
    }
    registered = true;
    return true;
}

export function getActionBoundKey(name: 'lockOn' | 'aimStance', fallback: string): string {
    const action = (terra as any).INPUT_ACTIONS?.[name];
    if (action?.inputs?.size) {
        for (const test of action.inputs) return test;
    }
    return fallback;
}

export function actionMatchesEventCode(name: 'lockOn' | 'aimStance', eventCode: string): boolean {
    const action = (terra as any).INPUT_ACTIONS?.[name];
    return !!action?.inputs?.has?.(eventCode);
}
