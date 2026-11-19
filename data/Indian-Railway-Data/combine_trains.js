import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p1Path = path.join(__dirname, 'trains_part1.json');
const p2Path = path.join(__dirname, 'trains_part2.json');
const outPath = path.join(__dirname, 'trains.json');

console.log('Combining trains_part1.json and trains_part2.json...');
const p1 = JSON.parse(fs.readFileSync(p1Path, 'utf-8'));
const p2 = JSON.parse(fs.readFileSync(p2Path, 'utf-8'));
const all = p1.concat(p2);

fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf-8');
console.log(`Successfully generated ${outPath} with ${all.length} trains.`);
