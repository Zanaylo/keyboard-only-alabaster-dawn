import { terra } from '@project-selene/api';

export const PLAYER_STATE = {
    REGULAR: 0,
    AIMING: 1,
    BLOCKED: 2,
    GUARD: 3,
    ITEM_USE: 4,
    SPECIAL: 5,
    PULL: 6,
} as const;

export function getPlayer(): any {
    return (terra as any).g_player ?? null;
}

export function getPlayerEntity(): any {
    return getPlayer()?.entity ?? null;
}

export function getPlayerActor(): any {
    return getPlayerEntity()?.actor ?? null;
}

export function getPlayerCmp(): any {
    const ent = getPlayerEntity();
    return ent?.player ?? ent?.cmpMap?.get?.('player') ?? null;
}

export function getAiming(): any {
    return getPlayer()?.aiming ?? null;
}

export function isAimingActive(): boolean {
    return !!getAiming()?.active;
}

export function getPlayerState(): number {
    return getPlayerCmp()?.state ?? -1;
}
