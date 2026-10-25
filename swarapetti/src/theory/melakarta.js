// The 72 melakarta ragams, generated from the standard scheme rather than typed
// by hand, so the swaras of every mela follow from its number:
//  - 1-36 use M1 (shuddha madhyamam), 37-72 use M2 (prati madhyamam).
//  - 12 chakras of 6: within each half the chakra fixes the Ri-Ga pair, and the
//    position inside the chakra fixes the Dha-Ni pair, both cycling through
//    R1G1, R1G2, R1G3, R2G2, R2G3, R3G3 (and D1N1 ... D3N3).
// Names follow the common modern (Govindacharya) scheme used in Carnatic
// concerts and textbooks.

export const MELA_NAMES = [
  'Kanakangi', 'Ratnangi', 'Ganamurti', 'Vanaspati', 'Manavati', 'Tanarupi',
  'Senavati', 'Hanumatodi', 'Dhenuka', 'Natakapriya', 'Kokilapriya', 'Rupavati',
  'Gayakapriya', 'Vakulabharanam', 'Mayamalavagowla', 'Chakravakam', 'Suryakantam', 'Hatakambari',
  'Jhankaradhwani', 'Natabhairavi', 'Keeravani', 'Kharaharapriya', 'Gowrimanohari', 'Varunapriya',
  'Mararanjani', 'Charukesi', 'Sarasangi', 'Harikambhoji', 'Dheerashankarabharanam', 'Naganandini',
  'Yagapriya', 'Ragavardhini', 'Gangeyabhushani', 'Vagadheeswari', 'Shulini', 'Chalanata',
  'Salagam', 'Jalarnavam', 'Jhalavarali', 'Navaneetam', 'Pavani', 'Raghupriya',
  'Gavambhodi', 'Bhavapriya', 'Shubhapantuvarali', 'Shadvidamargini', 'Suvarnangi', 'Divyamani',
  'Dhavalambari', 'Namanarayani', 'Kamavardhini', 'Ramapriya', 'Gamanashrama', 'Vishwambari',
  'Shamalangi', 'Shanmukhapriya', 'Simhendramadhyamam', 'Hemavati', 'Dharmavati', 'Neetimati',
  'Kantamani', 'Rishabhapriya', 'Latangi', 'Vachaspati', 'Mechakalyani', 'Chitrambari',
  'Sucharitra', 'Jyotiswarupini', 'Dhatuvardhani', 'Nasikabhushani', 'Kosalam', 'Rasikapriya',
];

// Common short names that people search for.
export const MELA_ALIASES = {
  8: ['Todi'], 15: ['Malavagowla'], 29: ['Shankarabharanam', 'Sankarabharanam'],
  65: ['Kalyani'], 51: ['Pantuvarali', 'Kamavardhani'], 39: ['Varali'],
  28: ['Harikamboji'], 22: ['Karaharapriya'],
};

export const CHAKRAS = [
  'Indu', 'Netra', 'Agni', 'Veda', 'Bana', 'Rutu',
  'Rishi', 'Vasu', 'Brahma', 'Disi', 'Rudra', 'Aditya',
];

const RG = [['R1', 'G1'], ['R1', 'G2'], ['R1', 'G3'], ['R2', 'G2'], ['R2', 'G3'], ['R3', 'G3']];
const DN = [['D1', 'N1'], ['D1', 'N2'], ['D1', 'N3'], ['D2', 'N2'], ['D2', 'N3'], ['D3', 'N3']];

export function melakartaSwaras(n) {
  if (!(n >= 1 && n <= 72)) throw new Error(`No melakarta ${n}`);
  const i = (n - 1) % 36;
  const [r, g] = RG[Math.floor(i / 6)];
  const [d, ni] = DN[i % 6];
  return ['S', r, g, n <= 36 ? 'M1' : 'M2', 'P', d, ni];
}

export function melakarta(n) {
  const swaras = melakartaSwaras(n);
  return {
    id: `mela-${n}`,
    kind: 'melakarta',
    number: n,
    name: MELA_NAMES[n - 1],
    aliases: MELA_ALIASES[n] || [],
    chakra: CHAKRAS[Math.floor((n - 1) / 6)],
    chakraNumber: Math.floor((n - 1) / 6) + 1,
    swaras,
    arohanam: [...swaras, "S'"].join(' '),
    avarohanam: ["S'", ...[...swaras].reverse()].join(' '),
  };
}

export const MELAKARTAS = Array.from({ length: 72 }, (_, i) => melakarta(i + 1));
