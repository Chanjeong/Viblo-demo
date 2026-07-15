import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as loadRubik } from '@remotion/google-fonts/Rubik';
import type { FontFamilyId } from '@/lib/project';

const archivo = loadArchivoBlack();
const rubik = loadRubik();

export const FONT_FAMILIES: Record<FontFamilyId, string> = {
  'archivo-black': `'${archivo.fontFamily}', 'Segoe UI Emoji', sans-serif`,
  rubik: `'${rubik.fontFamily}', 'Segoe UI Emoji', sans-serif`,
};
