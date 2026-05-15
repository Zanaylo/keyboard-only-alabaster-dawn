import { terra } from '@project-selene/api';
import { g_control, g_fonts, g_gui } from '@project-selene/api/terra';
import { isMenuNavEnabled } from '../../options.js';
import { getInputAction } from '../../utils/input.js';

const MOUSE_MOVE_THRESHOLD = 12;

//PQ ESSE JOGO NÃO TEM UM SISTEMA DE TECLADO PARA CHARTS KKKKKKKKKKKKKKKKKKKKKKK

interface NavState {
    stickyKeyboardMenu: boolean;
    skillTreeSelectPatched: boolean;
    skillTreeGraphPatched: boolean;
    lastMouseX: number;
    lastMouseY: number;
}

export const navState: NavState = {
    stickyKeyboardMenu: false,
    skillTreeSelectPatched: false,
    skillTreeGraphPatched: false,
    lastMouseX: -1,
    lastMouseY: -1,
};

let origIsGamepad: any = null;
let origGetIconFromIndex: any = null;
let isGamepadOwner: any = null;
let fontsOwner: any = null;
let installed = false;
let mousemoveHandler: ((e: MouseEvent) => void) | null = null;

function isAnyMenuOpen(): boolean {
    const scene: any = (terra as any).g_scene;
    if (!scene) return false;
    try {
        if (scene.isMenu?.()) return true;
        if (scene.isWaypointMenu?.()) return true;
        if (scene.isCommandMenu?.()) return true;
    } catch { }
    return false;
}

function isMenuNavKeyHeld(): boolean {
    return !!(
        getInputAction('menuLeft')?.isActive?.() ||
        getInputAction('menuRight')?.isActive?.() ||
        getInputAction('menuUp')?.isActive?.() ||
        getInputAction('menuDown')?.isActive?.() ||
        getInputAction('confirm')?.isActive?.()
    );
}

function getMenuArrowEdge(): { dx: number; dy: number } {
    if (getInputAction('menuLeft')?.hasStarted?.()) return { dx: -1, dy: 0 };
    if (getInputAction('menuRight')?.hasStarted?.()) return { dx: 1, dy: 0 };
    if (getInputAction('menuUp')?.hasStarted?.()) return { dx: 0, dy: -1 };
    if (getInputAction('menuDown')?.hasStarted?.()) return { dx: 0, dy: 1 };
    return { dx: 0, dy: 0 };
}

function findGuiInstance(matchFn: (el: any) => boolean): any | null {
    const gui: any = g_gui;
    if (!gui?.hooks) return null;
    const walk = (hook: any): any => {
        if (!hook) return null;
        if (hook.gui && matchFn(hook.gui)) return hook.gui;
        for (const child of hook.children ?? []) {
            const found = walk(child);
            if (found) return found;
        }
        return null;
    };
    for (const hook of gui.hooks) {
        const found = walk(hook);
        if (found) return found;
    }
    return null;
}
//I know and you know and we both ignore
function snapAmongScreenCoords(
    items: any[],
    getCoords: (item: any) => { x: number; y: number } | null,
    dx: number, dy: number,
    curX: number, curY: number,
    currentItem: any,
    isConnectedFn?: ((item: any) => boolean) | null
): { item: any; x: number; y: number } | null {
    let bestConnected: any = null, bestConnectedDist = Infinity;
    let bestAny: any = null, bestAnyDist = Infinity;
    for (const item of items) {
        if (item === currentItem) continue;
        const c = getCoords(item);
        if (!c) continue;
        const ex = c.x - curX, ey = c.y - curY;
        if (dx > 0 && ex <= 1) continue;
        if (dx < 0 && ex >= -1) continue;
        if (dy > 0 && ey <= 1) continue;
        if (dy < 0 && ey >= -1) continue;
        const aligned = dx !== 0 ? Math.abs(ex) : Math.abs(ey);
        const perp = dx !== 0 ? Math.abs(ey) : Math.abs(ex);
        if (perp > aligned) continue;
        const dist = Math.hypot(ex, ey);
        if (dist < bestAnyDist) { bestAnyDist = dist; bestAny = { item, x: c.x, y: c.y }; }
        if (isConnectedFn?.(item) && dist < bestConnectedDist) {
            bestConnectedDist = dist;
            bestConnected = { item, x: c.x, y: c.y };
        }
    }
    return bestConnected ?? bestAny;
}

function centerOf(hookHolder: any): { x: number; y: number } | null {
    if (!hookHolder?.hook?.screenCoords) return null;
    return {
        x: hookHolder.hook.screenCoords.x + hookHolder.hook.size.x / 2,
        y: hookHolder.hook.screenCoords.y + hookHolder.hook.size.y / 2,
    };
}

function patchSkillTreeSelectPrototype(proto: any): void {
    if (!proto || proto.__keyboardOnlyPatched) return;
    proto.__keyboardOnlyPatched = true;
    const origHandle = proto.handleGamepadInput;
    proto.handleGamepadInput = function (this: any) {
        if (!isMenuNavEnabled()) return origHandle?.call(this);
        const ctrl: any = g_control;
        if (!ctrl) return;
        const { dx, dy } = getMenuArrowEdge();
        if (dx !== 0 || dy !== 0) {
            const cur = this.currentFocus;
            const curCoords = centerOf(cur) ?? { x: this.cursorPos.x, y: this.cursorPos.y };
            const best = snapAmongScreenCoords(this.buttons ?? [], centerOf, dx, dy, curCoords.x, curCoords.y, cur);
            if (best) {
                this.cursorPos.setC(best.x, best.y);
                this.cursorMoved = false;
            }
        }
        if (this.currentFocus && ctrl.menuConfirm?.()) this.fireClickEvent(this.currentFocus);
        this.checkHover(this.cursorPos);
    };
}

function getConnectedNodes(graph: any, focus: any): any[] {
    if (!graph?.nodes || !focus?.config) return [];
    const ids = [
        ...(focus.config.parents ?? []),
        ...(focus.config.children ?? []),
    ];
    const out: any[] = [];
    const seen = new Set<any>();
    for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const n = graph.nodes.get(id);
        if (n) out.push(n);
    }
    return out;
}

function patchSkillTreeGraphPrototype(proto: any): void {
    if (!proto || proto.__keyboardOnlyPatched) return;
    proto.__keyboardOnlyPatched = true;
    const origHandle = proto.handleGamepadInput;
    proto.handleGamepadInput = function (this: any) {
        if (!isMenuNavEnabled()) return origHandle?.call(this);
        const { dx, dy } = getMenuArrowEdge();
        if (dx !== 0 || dy !== 0) {
            const all = typeof this.nodes?.values === 'function' ? Array.from(this.nodes.values()) : [];
            const cur = this.currentFocus;
            const curCoords = centerOf(cur) ?? { x: this.cursorPos.x, y: this.cursorPos.y };
            const connected = cur ? new Set(getConnectedNodes(this, cur)) : new Set();
            const best = snapAmongScreenCoords(
                all, centerOf, dx, dy, curCoords.x, curCoords.y, cur,
                connected.size > 0 ? (n: any) => connected.has(n) : null
            );
            if (best) {
                this.cursorPos.setC(best.x, best.y);
                this.cursorMoved = false;
            }
        }
        origHandle?.call(this);
    };
}

function tryPatchSkillTreeSelect(): void {
    if (navState.skillTreeSelectPatched) return;
    const inst = findGuiInstance(el =>
        Array.isArray(el?.buttons) && el.cursorPos && el.layout
        && Array.isArray(el.circles) && el.treeMode !== undefined
        && typeof el.handleGamepadInput === 'function'
        && typeof el.checkHover === 'function'
    );
    if (!inst) return;
    patchSkillTreeSelectPrototype(Object.getPrototypeOf(inst));
    navState.skillTreeSelectPatched = true;
}

function tryPatchSkillTreeGraph(): void {
    if (navState.skillTreeGraphPatched) return;
    const inst = findGuiInstance(el =>
        el?.nodes && typeof el.nodes.values === 'function'
        && el.cursorPos && Array.isArray(el.lines)
        && typeof el.handleGamepadInput === 'function'
        && typeof el.checkHover === 'function'
        && typeof el.learnSkill === 'function'
    );
    if (!inst) return;
    patchSkillTreeGraphPrototype(Object.getPrototypeOf(inst));
    navState.skillTreeGraphPatched = true;
}

export function ensureKeyboardMenuNav(): boolean {
    if (installed) return true;
    const inp: any = (terra as any).g_input;
    if (typeof inp?.isGamepad !== 'function') return false;

    const original = inp.isGamepad.bind(inp);
    origIsGamepad = original;
    isGamepadOwner = inp;

    inp.isGamepad = function () {
        if (original()) return true;
        if (!isMenuNavEnabled() || !isAnyMenuOpen()) {
            navState.stickyKeyboardMenu = false;
            return false;
        }
        if (isMenuNavKeyHeld()) navState.stickyKeyboardMenu = true;
        return navState.stickyKeyboardMenu;
    };

    const fonts: any = g_fonts;
    if (typeof fonts?.getIconFromIndex === 'function') {
        const origIcon = fonts.getIconFromIndex.bind(fonts);
        origGetIconFromIndex = origIcon;
        fontsOwner = fonts;
        fonts.getIconFromIndex = function (code: any) {
            const cur = inp.isGamepad;
            inp.isGamepad = original;
            try { return origIcon(code); }
            finally { inp.isGamepad = cur; }
        };
    }

    mousemoveHandler = (e: MouseEvent) => {
        if (navState.lastMouseX === -1) {
            navState.lastMouseX = e.clientX;
            navState.lastMouseY = e.clientY;
            return;
        }
        const dx = e.clientX - navState.lastMouseX;
        const dy = e.clientY - navState.lastMouseY;
        navState.lastMouseX = e.clientX;
        navState.lastMouseY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > MOUSE_MOVE_THRESHOLD) {
            navState.stickyKeyboardMenu = false;
        }
    };
    window.addEventListener('mousemove', mousemoveHandler, true);

    installed = true;
    return true;
}

export function uninstallKeyboardMenuNav(): void {
    if (!installed) return;
    if (isGamepadOwner && origIsGamepad) isGamepadOwner.isGamepad = origIsGamepad;
    if (fontsOwner && origGetIconFromIndex) fontsOwner.getIconFromIndex = origGetIconFromIndex;
    if (mousemoveHandler) {
        window.removeEventListener('mousemove', mousemoveHandler, true);
        mousemoveHandler = null;
    }
    origIsGamepad = origGetIconFromIndex = null;
    isGamepadOwner = fontsOwner = null;
    navState.stickyKeyboardMenu = false;
    installed = false;
}

export function tickSkillTreeNav(): void {
    if (!isMenuNavEnabled()) return;
    if (!navState.skillTreeSelectPatched) tryPatchSkillTreeSelect();
    if (!navState.skillTreeGraphPatched) tryPatchSkillTreeGraph();
}
