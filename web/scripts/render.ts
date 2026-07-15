import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderProjectToFile } from '../src/lib/renderer';
import type { RenderProject } from '../src/lib/project';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('usage: tsx scripts/render.ts <render-project.json>');
  process.exit(1);
}
const project = JSON.parse(readFileSync(jsonPath, 'utf8')) as RenderProject;
mkdirSync('storage/renders', { recursive: true });
const out = path.join('storage', 'renders', 'cli-test.mp4');

renderProjectToFile(project, out, (p) => {
  process.stdout.write(`\rrendering ${(p * 100).toFixed(0)}%`);
}).then(() => console.log(`\ndone: ${out}`))
  .catch((e) => { console.error(e); process.exit(1); });
