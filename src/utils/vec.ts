import { Vec3 } from '@project-selene/api/terra';

export interface Vec3Like { x: number; y: number; z: number }

export function readVec3(vec: any): Vec3Like | null {
    if (!vec) return null;
    if (typeof vec.x === 'number' && typeof vec.y === 'number') {
        return { x: vec.x, y: vec.y, z: typeof vec.z === 'number' ? vec.z : 0 };
    }
    if (vec.v && typeof vec.v[0] === 'number') {
        return { x: vec.v[0], y: vec.v[1] ?? 0, z: vec.v[2] ?? 0 };
    }
    return null;
}

export function writeVec(vec: any, x: number, y: number, z = 0): boolean {
    if (!vec) return false;
    if (typeof vec.setC === 'function') {
        try { vec.setC(x, y, z); return true; } catch { }
    }
    if (vec.v && vec.v.length >= 2) {
        vec.v[0] = x;
        vec.v[1] = y;
        if (vec.v.length > 2) vec.v[2] = z;
        return true;
    }
    if (typeof vec.x === 'number') {
        vec.x = x;
        vec.y = y;
        if ('z' in vec) vec.z = z;
        return true;
    }
    return false;
}

function newVec3(): any {
    try { return new (Vec3 as any)(); }
    catch { return { v: new Float32Array(3) }; }
}

export function ensureVec3At(obj: any, field: string): any {
    if (!obj) return null;
    if (!obj[field]) obj[field] = newVec3();
    return obj[field];
}
