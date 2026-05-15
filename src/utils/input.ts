import { terra } from '@project-selene/api';

export function getInputAction(name: string): any {
    return (terra as any).INPUT_ACTIONS?.[name] ?? null;
}

//KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK resolveu :V

export function getCurrentMoveDir(): { x: number; y: number } | null {
    let dx = 0, dy = 0;
    if (getInputAction('left')?.isActive?.()) dx -= 1;
    if (getInputAction('right')?.isActive?.()) dx += 1;
    if (getInputAction('up')?.isActive?.()) dy -= 1;
    if (getInputAction('down')?.isActive?.()) dy += 1;
    if (dx === 0 && dy === 0) return null;
    const len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len };
}

export function isMoveKeyHeld(): boolean {
    return getCurrentMoveDir() !== null;
}
