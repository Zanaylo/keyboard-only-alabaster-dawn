import { terra } from '@project-selene/api';
import { g_mapInteract } from '@project-selene/api/terra';
import { isInteractFixEnabled } from '../../options.js';

let original: any = null;
let owner: any = null;
let installed = false;

//PQ EU TENHO QUE FAZER ISSO JOGO PELO AMOR DE DEUS

export function ensureInteractWrap(): boolean {
    if (installed) return true;
    const mi: any = g_mapInteract;
    const inp: any = (terra as any).g_input;
    if (typeof mi?.onPreUpdate !== 'function' || typeof inp?.isGamepad !== 'function') return false;

    const orig = mi.onPreUpdate.bind(mi);
    original = orig;
    owner = mi;

    mi.onPreUpdate = function () {
        if (!isInteractFixEnabled()) { orig(); return; }
        const prev = inp.isGamepad;
        inp.isGamepad = () => true;
        try { orig(); }
        finally { inp.isGamepad = prev; }
    };

    installed = true;
    return true;
}

export function uninstallInteractWrap(): void {
    if (!installed) return;
    if (owner && original) owner.onPreUpdate = original;
    original = null;
    owner = null;
    installed = false;
}
