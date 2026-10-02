// The typefaces on the shelves, roughly in historical order. They fill the
// four "type bays" nearest to you: left side first (near bay, then far bay),
// then the right side, each bay read top to bottom.
// All fonts are SIL Open Font License fonts from Google Fonts (see public/fonts/licenses).

export interface Typeface {
  /** Display name of the font family. */
  name: string;
  /** Classification used in type history. */
  classification: string;
  /** One-line teaching note. */
  note: string;
  file: string;
  /** Letters on this typeface's shelf, left to right. */
  letters: string[];
  /** Letter colours (cycled). */
  colors: number[];
}

/** In historical order, grouped in threes (one group per type bay). */
const TYPEFACES: Typeface[][] = [
  [
    {
      name: 'UnifrakturMaguntia',
      classification: 'Blackletter',
      note: 'Gutenberg-era Gothic: dense, angular strokes from the broad-nib pen (c. 1450).',
      file: 'UnifrakturMaguntia-Book.ttf',
      letters: ['A', 'B', 'C'],
      colors: [0x1b1b1b, 0x7a0e0e],
    },
    {
      name: 'Sorts Mill Goudy',
      classification: 'Old-style serif (Garalde)',
      note: 'Low stroke contrast, angled stress and bracketed serifs, after Renaissance types.',
      file: 'SortsMillGoudy-Regular.ttf',
      letters: ['D', 'E', 'F'],
      colors: [0x5b3a29, 0x8c5a3c],
    },
    {
      name: 'Old Standard',
      classification: 'Modern serif (Didone)',
      note: 'High contrast, vertical stress and hairline serifs, as in Bodoni and Didot (c. 1800).',
      file: 'OldStandard-Bold.ttf',
      letters: ['G', 'H', 'I'],
      colors: [0x0b2545, 0x13315c],
    },
    {
      name: 'Abril Fatface',
      classification: 'Fat face (display Didone)',
      note: '19th-century advertising type: very heavy strokes against hairline details.',
      file: 'AbrilFatface-Regular.ttf',
      letters: ['J', 'K'],
      colors: [0xc1121f, 0x780000],
    },
  ],
  [
    {
      name: 'Arvo',
      classification: 'Slab serif (Egyptian)',
      note: 'Block-like serifs about as thick as the stems. Born on 1800s posters.',
      file: 'Arvo-Bold.ttf',
      letters: ['L', 'M', 'N'],
      colors: [0xe76f51, 0xf4a261],
    },
    {
      name: 'Alfa Slab One',
      classification: 'Slab serif (display)',
      note: 'A heavy slab for headlines, in the wood-type poster tradition.',
      file: 'AlfaSlabOne-Regular.ttf',
      letters: ['O', 'P'],
      colors: [0x2a9d8f, 0x264653],
    },
    {
      name: 'Archivo Black',
      classification: 'Grotesque sans-serif',
      note: 'Early sans-serifs: no serifs, fairly even strokes, a little quirky (late 1800s).',
      file: 'ArchivoBlack-Regular.ttf',
      letters: ['Q', 'R'],
      colors: [0x111111, 0x3d3d3d],
    },
    {
      name: 'Poppins',
      classification: 'Geometric sans-serif',
      note: 'Built from circles and straight lines, in the spirit of Futura and the Bauhaus (1920s).',
      file: 'Poppins-Bold.ttf',
      letters: ['S', 'T', 'U'],
      colors: [0xffbe0b, 0xfb5607],
    },
  ],
  [
    {
      name: 'Fira Sans',
      classification: 'Humanist sans-serif',
      note: 'Sans-serif with calligraphic proportions and some stroke modulation. Very readable.',
      file: 'FiraSans-Bold.ttf',
      letters: ['V', 'W'],
      colors: [0xff006e, 0x8338ec],
    },
    {
      name: 'Bebas Neue',
      classification: 'Condensed display sans',
      note: 'Tall and narrow, so headlines fit more letters in less width.',
      file: 'BebasNeue-Regular.ttf',
      letters: ['X', 'Y', 'Z'],
      colors: [0x3a86ff, 0x023e8a],
    },
    {
      name: 'Space Mono',
      classification: 'Monospace',
      note: 'Every glyph takes the same width, a legacy of typewriters and code.',
      file: 'SpaceMono-Bold.ttf',
      letters: ['&', 'E', 'A'],
      colors: [0x38b000, 0x007200],
    },
    {
      name: 'Lobster',
      classification: 'Script',
      note: 'Imitates connected handwriting or brush lettering.',
      file: 'Lobster-Regular.ttf',
      letters: ['O', 'S'],
      colors: [0xd00000, 0xffba08],
    },
  ],
];

export interface TypeBay {
  /** -1 = left side of the aisle, +1 = right side. */
  side: -1 | 1;
  /** 0 = bay nearest to you, 1 = the next one. */
  bay: 0 | 1;
  header: string;
  /** One typeface per shelf, top to bottom. */
  rows: Typeface[];
}

const flat = TYPEFACES.flat();
const HEADERS = ['CLASSIC SERIFS', 'DISPLAY & SLAB SERIFS', 'SANS SERIFS', 'DISPLAY, MONO & SCRIPT'];

export const TYPE_BAYS: TypeBay[] = [0, 1, 2, 3].map((i) => ({
  side: i < 2 ? -1 : 1,
  bay: (i % 2) as 0 | 1,
  header: HEADERS[i],
  rows: flat.slice(i * 3, i * 3 + 3),
}));

export const ALL_TYPEFACES = flat;
