import {
    MapCamera,
    MapInteractLayer,
    MapViewCursor,
    VisionInteractLayer,
    GenericGuiCursor,
    OptionKeyboardMaskGui,
} from '@project-selene/api/terra';
import { terra } from '@project-selene/api';
import { isModEnabled, isMenuNavEnabled } from '../../options.js';
import {
    realGamepadPresent,
    isMapOpen,
    isVisionActive,
    navKeyHeld,
    createStickyKeyboard,
} from './nav-core.js';
import { isZoomKeyHeld } from './gamepad-bridge.js';

const sticky = createStickyKeyboard();

function isMapOrVision(): boolean {
    return isMapOpen() || isVisionActive();
}

function shouldDriveCursor(open: boolean): boolean {
    if (!open || !isModEnabled() || !isMenuNavEnabled() || realGamepadPresent()) return false;
    if (navKeyHeld() || isZoomKeyHeld()) sticky.engage();
    return sticky.engaged();
}

function wrapInputUpdate(proto: any, flag: string, isOpen: () => boolean): boolean {
    if (!proto) return false;
    if (proto[flag]) return true;
    const origUpdate = proto.update;
    if (typeof origUpdate !== 'function') return false;
    proto[flag] = true;
    proto.update = function (this: any, ...args: any[]) {
        const inp: any = (terra as any).g_input;
        if (!inp || typeof inp.isGamepad !== 'function' || !shouldDriveCursor(isOpen())) {
            return origUpdate.apply(this, args);
        }
        const saved = inp.isGamepad;
        inp.isGamepad = () => true;
        try { return origUpdate.apply(this, args); }
        finally { inp.isGamepad = saved; }
    };
    return true;
}

interface ProtoWrap {
    cls: any;
    flag: string;
    isOpen: () => boolean;
}

const PROTO_WRAPS: ProtoWrap[] = [
    { cls: MapCamera, flag: '__kbOnlyMapCam', isOpen: isMapOpen },
    { cls: MapInteractLayer, flag: '__kbOnlyMapInteract', isOpen: isMapOpen },
    { cls: MapViewCursor, flag: '__kbOnlyMapCursor', isOpen: isMapOpen },
    { cls: VisionInteractLayer, flag: '__kbOnlyVision', isOpen: isVisionActive },
    { cls: GenericGuiCursor, flag: '__kbOnlyCursor', isOpen: isMapOrVision },
];

const wrapped = new Set<string>();
let rebindWrapped = false;

function ensureRebindHook(): boolean {
    if (rebindWrapped) return true;
    const maskProto: any = (OptionKeyboardMaskGui as any)?.prototype;
    if (!maskProto || typeof maskProto.onListEntryClicked !== 'function') return false;
    if (maskProto.__kbOnlyRebind) {
        rebindWrapped = true;
        return true;
    }
    const orig = maskProto.onListEntryClicked;
    maskProto.onListEntryClicked = function (this: any, entry: any) {
        if (entry && entry.input1 && typeof entry.getData === 'function') {
            return orig.call(this, entry.input1);
        }
        return orig.call(this, entry);
    };
    maskProto.__kbOnlyRebind = true;
    rebindWrapped = true;
    return true;
}

export function ensureMenuExtra(): boolean {
    for (const { cls, flag, isOpen } of PROTO_WRAPS) {
        if (wrapped.has(flag)) continue;
        if (wrapInputUpdate((cls as any)?.prototype, flag, isOpen)) wrapped.add(flag);
    }
    ensureRebindHook();
    return wrapped.size === PROTO_WRAPS.length && rebindWrapped;
}

export function installMenuExtra(): void {
    sticky.install();
}

export function uninstallMenuExtra(): void {
    sticky.uninstall();
}
