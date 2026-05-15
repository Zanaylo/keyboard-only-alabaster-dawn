import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'dist/unpacked');
const OUT = path.join(ROOT, 'dist/keyboard-only.mod.zip');

async function addFolder(zip: JSZip, folder: string, prefix = ''): Promise<void> {
    for (const entry of await fs.promises.readdir(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await addFolder(zip, full, zipPath);
        else zip.file(zipPath, await fs.promises.readFile(full));
    }
}

if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC} — run "npm run build" first.`);
    process.exit(1);
}

const zip = new JSZip();
await addFolder(zip, SRC);
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
await fs.promises.writeFile(OUT, buf);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${buf.length} bytes)`);
