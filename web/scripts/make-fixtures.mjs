import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('public/fixtures', { recursive: true });

const clips = [
  { name: 'clip-a', dur: 6, freq: 440, src: 'testsrc2' },
  { name: 'clip-b', dur: 8, freq: 660, src: 'smptebars' },
  { name: 'clip-c', dur: 5, freq: 880, src: 'testsrc' },
];

for (const { name, dur, freq, src } of clips) {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `${src}=size=720x1280:rate=30:duration=${dur}`,
    '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${dur}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    `public/fixtures/${name}.mp4`,
  ], { stdio: 'inherit' });
  console.log(`made ${name}.mp4 (${dur}s)`);
}
