// The four in-house piece sets, ported from the design prototypes. Geometry is
// on a 100×100 grid; every set is drawn as an outline pass under a fill pass so
// composed primitives read as one silhouette, and tinted through theme tokens.

/** Mirrors the right half of a profile (starts and ends on the x=50 axis) into a closed path. */
function sym(d: string): string {
	const t = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
	const segs: { c: 'M' | 'L' | 'C'; p: [number, number][] }[] = [];
	let i = 0;
	let cmd = 'M';
	while (i < t.length) {
		if (/[MLC]/.test(t[i])) {
			cmd = t[i++];
			continue;
		}
		if (cmd === 'C') {
			segs.push({
				c: 'C',
				p: [
					[+t[i], +t[i + 1]],
					[+t[i + 2], +t[i + 3]],
					[+t[i + 4], +t[i + 5]]
				]
			});
			i += 6;
		} else {
			segs.push({ c: cmd === 'M' ? 'M' : 'L', p: [[+t[i], +t[i + 1]]] });
			i += 2;
			cmd = 'L';
		}
	}
	const m = ([x, y]: [number, number]) => [(100 - x).toFixed(2), y.toFixed(2)];
	let out = segs.map((s) => s.c + s.p.map((p) => p.join(' ')).join(' ')).join(' ');
	const end = segs[segs.length - 1].p.at(-1)!;
	if (Math.abs(end[0] - 50) > 0.01) out += ' L' + m(end).join(' ');
	for (let k = segs.length - 1; k >= 1; k--) {
		const s = segs[k];
		const prev = segs[k - 1].p.at(-1)!;
		if (s.c === 'C') out += ' C' + [m(s.p[1]), m(s.p[0]), m(prev)].map((p) => p.join(' ')).join(' ');
		else out += ' L' + m(prev).join(' ');
	}
	return out + ' Z';
}

const P = (d: string, extra = '') => `<path d="${d}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, rx = 0) =>
	`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
const circ = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const ell = (cx: number, cy: number, rx: number, ry: number) =>
	`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;

type Glyph = { s: string; d?: string; ao?: number };
type Geometry = Record<'P' | 'R' | 'B' | 'N' | 'Q' | 'K', Glyph>;

/* ── MONOLITH (Round 1): geometric, single-weight, no internal shading. */
const MONOLITH: Geometry = {
	P: {
		s:
			circ(50, 34, 12) +
			rect(45, 43, 10, 15) +
			rect(35, 55, 30, 7, 3.5) +
			P('M40 61 H60 L67 83 H33 Z') +
			rect(28, 81, 44, 10, 3)
	},
	R: {
		s:
			rect(30, 16, 10, 22, 1.5) +
			rect(45, 16, 10, 22, 1.5) +
			rect(60, 16, 10, 22, 1.5) +
			rect(30, 30, 40, 10) +
			P('M37 39 H63 L65 76 H35 Z') +
			rect(31, 74, 38, 8, 2) +
			rect(25, 81, 50, 10, 3)
	},
	B: {
		s:
			circ(50, 13, 4) +
			P('M50 16 C65 29 67 46 50 60 C33 46 35 29 50 16 Z') +
			rect(38, 57, 24, 7, 3.5) +
			P('M42 63 H58 L61 76 H39 Z') +
			rect(33, 74, 34, 8, 2) +
			rect(26, 81, 48, 10, 3),
		d: P('M54 27 L63 41', ' fill="none"')
	},
	N: {
		s:
			P(
				'M33 76 L33 66 C33 59 35 54 38 50 L28 46 C22 45 20 40 22 35 C25 30 31 27 37 27 C40 24 43 18 45 13 L51 15 C55 18 57 22 57 27 C66 34 70 50 70 66 L70 76 Z'
			) +
			rect(31, 74, 38, 8, 2) +
			rect(25, 81, 50, 10, 3),
		d:
			'<circle cx="44" cy="32" r="2.4" stroke="none"/>' +
			P('M25 39 l3 1', ' fill="none"') +
			P('M58 33 C63 40 65 50 65 62', ' fill="none" stroke-width="2.2"')
	},
	Q: {
		s:
			circ(24, 17, 3.6) +
			circ(50, 10, 3.6) +
			circ(76, 17, 3.6) +
			P('M30 46 L24 19 L37 33 L50 12 L63 33 L76 19 L70 46 Z') +
			rect(32, 44, 36, 7, 3.5) +
			P('M40 50 H60 L64 76 H36 Z') +
			rect(30, 74, 40, 8, 2) +
			rect(22, 81, 56, 10, 3)
	},
	K: {
		s:
			rect(47, 5, 6, 22, 1.5) +
			rect(41, 11, 18, 6, 1.5) +
			P('M31 48 L31 28 L42 36 L50 25 L58 36 L69 28 L69 48 Z') +
			rect(32, 46, 36, 7, 3.5) +
			P('M40 52 H60 L64 76 H36 Z') +
			rect(30, 74, 40, 8, 2) +
			rect(22, 81, 56, 10, 3)
	}
};

/* ── MATERIAL: turned forms with heft. Wide plinths, round collars, a dome for the king. */
const mBase = (w: number) => rect(50 - w + 4, 74, 2 * w - 8, 7, 3) + rect(50 - w, 80, 2 * w, 13, 4.5);
const MATERIAL: Geometry = {
	P: { s: circ(50, 30, 11.5) + rect(39, 43, 22, 6, 3) + P(sym('M50 46 L55 46 C56 56 59 66 62 76 L50 76')) + mBase(24), ao: 24 },
	R: {
		s:
			rect(31, 17, 9, 13, 1.5) +
			rect(45.5, 17, 9, 13, 1.5) +
			rect(60, 17, 9, 13, 1.5) +
			rect(31, 27, 38, 12, 2) +
			P(sym('M50 38 L63 38 C63 52 64 64 66 76 L50 76')) +
			mBase(26),
		ao: 26
	},
	B: {
		s:
			circ(50, 11, 3.6) +
			P('M50 14 C64 24 67 44 52 57 L48 57 C33 44 36 24 50 14 Z M54.5 27 L62.5 39 L60 41 L52 29 Z', ' fill-rule="evenodd"') +
			rect(38, 55, 24, 6, 3) +
			P(sym('M50 59 L56 59 C56 66 58 71 60 76 L50 76')) +
			mBase(25),
		ao: 25
	},
	N: {
		s:
			P(
				'M30 76 L30 66 C30 58 32 52 37 48 L27 46 C20 45 16 40 18 36 C19 33 23 32 27 33 L29 31 C31 28 34 25 38 23 L41 12 C44 14 46 17 47 20 L51 19 C53 15 55 12 58 10 L60 22 C67 28 71 40 70 56 L70 76 Z'
			) + mBase(26),
		ao: 26,
		d: circ(41.5, 29.5, 2.1) + P('M61 28 C65 36 67 46 66 60', ' fill="none"') + P('M20 38 L24 37', ' fill="none"')
	},
	Q: {
		s:
			[24, 37, 50, 63, 76].map((x, i) => circ(x, [21, 14, 11, 14, 21][i], 3.6)).join('') +
			P(
				'M28 46 C27 38 25 30 24 23 L33 36 C34 29 36 21 37 16 L44 35 C46 27 48 19 50 13 C52 19 54 27 56 35 L63 16 C64 21 66 29 67 36 L76 23 C75 30 73 38 72 46 Z'
			) +
			rect(29, 44, 42, 7, 3.5) +
			P(sym('M50 50 L60 50 C60 60 62 68 65 76 L50 76')) +
			mBase(29),
		ao: 29
	},
	K: {
		s:
			rect(47, 3, 6, 19, 1.5) +
			rect(41, 8.5, 18, 6, 1.5) +
			P('M31 48 C31 41 33 37 36 35 L36 30 C40 25 45 22 50 22 C55 22 60 25 64 30 L64 35 C67 37 69 41 69 48 Z') +
			rect(30, 46, 40, 7, 3.5) +
			P(sym('M50 52 L60 52 C60 61 62 69 65 76 L50 76')) +
			mBase(29),
		ao: 29,
		d: P('M37 36 L63 36', ' fill="none" stroke-width="1.4" opacity=".5"')
	}
};

/* ── INSTRUMENT: ruler-and-compass construction. Straight cuts, 45° chamfers, perfect circles. */
const iBase = (w: number) =>
	rect(50 - w + 4, 75, 2 * w - 8, 4) + P(`M${50 - w + 3} 79 H${50 + w - 3} L${50 + w} 82 V90 H${50 - w} V82 Z`);
const INSTRUMENT: Geometry = {
	P: { s: circ(50, 28, 10) + rect(46, 37, 8, 8) + rect(40, 45, 20, 4) + P('M43 49 H57 L61 76 H39 Z') + iBase(22), d: P('M43 49 H57', ' fill="none"') },
	R: {
		s: rect(31, 16, 9, 12) + rect(45.5, 16, 9, 12) + rect(60, 16, 9, 12) + rect(31, 27, 38, 10) + P('M36 37 H64 L66 76 H34 Z') + iBase(24),
		d: P('M31 37 H69', ' fill="none"')
	},
	B: {
		s:
			P('M50 4 L54 8 L50 12 L46 8 Z') +
			P('M50 13 L63 34 L60 56 H40 L37 34 Z M56 22 L62.5 35.5 L60 37 L53.5 23.5 Z', ' fill-rule="evenodd"') +
			rect(39, 56, 22, 4) +
			P('M44 60 H56 L59 76 H41 Z') +
			iBase(24)
	},
	N: {
		s: P('M31 76 V62 L35 52 L27 49 L18 45 L17 39 L22 35 L28 34 L34 29 L39 22 L42 12 L47 19 L51 18 L57 11 L59 22 L65 29 L69 41 L70 58 V76 Z') + iBase(26),
		d: rect(40, 27.5, 3, 3) + P('M59 22 L57 40 L63 58 L60 76', ' fill="none"') + P('M34 29 L45 34', ' fill="none"')
	},
	Q: {
		s: P('M27 46 L21 18 L31 34 L38 13 L44 33 L50 8 L56 33 L62 13 L69 34 L79 18 L73 46 Z') + rect(30, 46, 40, 4) + P('M39 50 H61 L65 76 H35 Z') + iBase(28),
		d: P('M27 40 H73', ' fill="none"')
	},
	K: {
		s: rect(47, 3, 6, 19) + rect(40.5, 8, 19, 6) + P('M32 48 V27 L41 34 L50 22 L59 34 L68 27 V48 Z') + rect(30, 48, 40, 4) + P('M39 52 H61 L65 76 H35 Z') + iBase(28),
		d: P('M32 42 H68', ' fill="none"')
	}
};

/* ── NOCTURNE: elongated, waisted glass forms. Cushion bases, elliptical collars. */
const nBase = (w: number) =>
	P(sym(`M50 76 L${50 + w - 5} 76 C${50 + w - 1} 76 ${50 + w} 78 ${50 + w} 82 L${50 + w} 89 C${50 + w} 92 ${50 + w - 2} 93 ${50 + w - 5} 93 L50 93`));
const NOCTURNE: Geometry = {
	P: { s: circ(50, 27, 10.5) + P(sym('M50 36 L53 36 L53.5 44 L50 44')) + ell(50, 46, 8.5, 3) + P(sym('M50 46 L54 46 C54 60 58 70 62 78 L50 78')) + nBase(20) },
	R: {
		s:
			rect(34, 14, 9, 13, 1) +
			rect(45.5, 14, 9, 13, 1) +
			rect(57, 14, 9, 13, 1) +
			P(sym('M50 25 L65 25 C66.5 25 67 26 67 27.5 L67 32 C67 33.5 66 34 64.5 34 L50 34')) +
			P(sym('M50 33 L59 33 C59 48 61 62 65 77 L50 77')) +
			nBase(22)
	},
	B: {
		s:
			circ(50, 9, 3.4) +
			P('M50 12 C61 22 65 42 52 58 L48 58 C35 42 39 22 50 12 Z M55 24 L62 37 L60 39 L53 26 Z', ' fill-rule="evenodd"') +
			ell(50, 59, 9.5, 3.2) +
			P(sym('M50 59 L55 59 C55 66 57 72 60 78 L50 78')) +
			nBase(21)
	},
	N: {
		s:
			P(
				'M33 77 L33 66 C33 58 35 52 39 47 L27 45 C21 44 18 39 20 35 C22 32 26 32 29 33 C31 29 34 25 38 22 L40 10 C44 12 46 16 47 19 L51 18 C53 13 56 10 59 8 L61 20 C68 27 71 40 70 56 L70 77 Z'
			) + nBase(22),
		d: circ(42, 28.5, 1.9) + P('M62 26 C66 34 68 44 67 58', ' fill="none"')
	},
	Q: {
		s:
			[23, 36, 50, 64, 77].map((x, i) => circ(x, [22, 14, 10, 14, 22][i], 2.8)).join('') +
			P(
				'M28 50 C27 40 25 32 23 25 L32 38 C33 31 35 23 36 17 L44 36 C46 28 48 20 50 13 C52 20 54 28 56 36 L64 17 C65 23 67 31 68 38 L77 25 C75 32 73 40 72 50 Z'
			) +
			ell(50, 52, 20, 4) +
			P(sym('M50 53 L58 53 C58 62 61 70 64 78 L50 78')) +
			nBase(27)
	},
	K: {
		s:
			rect(47.5, 1, 5, 18, 2) +
			rect(42, 6.5, 16, 5, 2) +
			P('M33 50 C33 38 42 32 50 18 C58 32 67 38 67 50 Z') +
			ell(50, 52, 20, 4) +
			P(sym('M50 53 L58 53 C58 62 61 70 64 78 L50 78')) +
			nBase(27),
		d: P('M50 24 C50 34 50 40 50 46', ' fill="none" stroke-width="1.2" opacity=".55"')
	}
};

export const CUSTOM_SETS = {
	monolith: MONOLITH,
	material: MATERIAL,
	instrument: INSTRUMENT,
	nocturne: NOCTURNE
} as const;
export type CustomSet = keyof typeof CUSTOM_SETS;

const TYPES = ['K', 'Q', 'R', 'B', 'N', 'P'] as const;

const gradient = (id: string) =>
	`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient>`;

/* Material: real light on the silhouette — diffuse form shading + specular rim, key light upper-left. */
const lit = (id: string, w: boolean) => `
<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
	<feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur"/>
	<feDiffuseLighting in="blur" surfaceScale="4.5" diffuseConstant="${w ? 1.12 : 1.3}" lighting-color="#fff" result="diff"><feDistantLight azimuth="230" elevation="58"/></feDiffuseLighting>
	<feComposite in="diff" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="lit"/>
	<feSpecularLighting in="blur" surfaceScale="4.5" specularConstant="${w ? 0.22 : 0.34}" specularExponent="${w ? 30 : 26}" lighting-color="#fff" result="spec"><feDistantLight azimuth="230" elevation="58"/></feSpecularLighting>
	<feSpecularLighting in="blur" surfaceScale="4.5" specularConstant="${w ? 0.16 : 0.42}" specularExponent="${w ? 14 : 12}" lighting-color="${w ? '#ffe2b8' : '#e9d6b4'}" result="rim"><feDistantLight azimuth="40" elevation="${w ? 26 : 24}"/></feSpecularLighting>
	<feComposite in="spec" in2="rim" operator="arithmetic" k2="1" k3="1" result="specs"/>
	<feComposite in="specs" in2="SourceAlpha" operator="in" result="specIn"/>
	<feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="1" result="out"/>
	<feComposite in="out" in2="SourceAlpha" operator="in"/>
</filter>`;

/* Nocturne: a band of light along every upward-facing edge, computed from the silhouette. */
const rim = (id: string, w: boolean) => `
<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
	<feOffset in="SourceAlpha" dx="0" dy="${w ? 2.4 : 2.2}" result="off"/>
	<feComposite in="SourceAlpha" in2="off" operator="out" result="band"/>
	<feGaussianBlur in="band" stdDeviation="${w ? 0.55 : 0.5}" result="bandb"/>
	<feFlood flood-color="${w ? '#ffffff' : '#d6e8ff'}" flood-opacity=".95" result="c"/>
	<feComposite in="c" in2="bandb" operator="in" result="rim"/>
	${
		w
			? '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rim"/></feMerge>'
			: `<feOffset in="SourceAlpha" dx="0" dy="-1.4" result="off2"/>
	<feComposite in="SourceAlpha" in2="off2" operator="out" result="band2"/>
	<feFlood flood-color="#6f86ad" flood-opacity=".55" result="c2"/>
	<feComposite in="c2" in2="band2" operator="in" result="rim2"/>
	<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rim2"/><feMergeNode in="rim"/></feMerge>`
	}
</filter>`;

const STYLE = `
.lp .o { stroke-linejoin: round; stroke-linecap: round; }
.lp .d { stroke-linecap: round; stroke-linejoin: round; }
/* monolith: outline pass under a two-stop fill */
.lp-monolith .o { stroke-width: 5; }
.lp-monolith .d { stroke-width: 3; }
.lp-monolith.w .o, .lp-monolith.w .d { stroke: var(--pws); fill: var(--pws); }
/* White pieces need a heavier outline than black to hold their silhouette on light squares. */
.lp-monolith.w .o { stroke-width: 6.5; }
.lp-monolith.b .o { stroke: var(--pbs); fill: var(--pbs); }
.lp-monolith.b .d { stroke: var(--pbh); fill: var(--pbh); }
.lp-monolith.w .f { fill: url(#lp-monolith-grad-w); }
.lp-monolith.b .f { fill: url(#lp-monolith-grad-b); }
#lp-monolith-grad-w stop:first-child { stop-color: var(--pw1); } #lp-monolith-grad-w stop:last-child { stop-color: var(--pw2); }
#lp-monolith-grad-b stop:first-child { stop-color: var(--pb1); } #lp-monolith-grad-b stop:last-child { stop-color: var(--pb2); }
/* material: outline pass + lit fill pass + ambient-occlusion ellipse */
.lp-material .o { stroke-width: 2.3; }
.lp-material.w .o { stroke: var(--pws); fill: var(--pws); }
.lp-material.b .o { stroke: var(--pbs); fill: var(--pbs); }
.lp-material.w .f { fill: url(#lp-material-grad-w); }
.lp-material.b .f { fill: url(#lp-material-grad-b); }
#lp-material-grad-w stop:first-child { stop-color: var(--pw1); } #lp-material-grad-w stop:last-child { stop-color: var(--pw2); }
#lp-material-grad-b stop:first-child { stop-color: var(--pb1); } #lp-material-grad-b stop:last-child { stop-color: var(--pb2); }
.lp-material.w .lit { filter: url(#lp-material-lit-w); }
.lp-material.b .lit { filter: url(#lp-material-lit-b); }
.lp-material .ao { fill: #000; opacity: .38; filter: url(#lp-material-blur); }
.lp-material.w .d { stroke: var(--pws); fill: var(--pws); stroke-width: 2.2; }
.lp-material.b .d { stroke: var(--pbh); fill: var(--pbh); stroke-width: 2.2; }
/* instrument: flat fill, CAD hairline that keeps its weight at every board size */
.lp-instrument .o { stroke-width: 2.6px; }
.lp-instrument.w .o { stroke: var(--pws); fill: var(--pws); }
.lp-instrument.b .o { stroke: var(--pbs); fill: var(--pbs); stroke-width: 3.2px; }
.lp-instrument.w .f { fill: var(--pw1); }
.lp-instrument.b .f { fill: var(--pb1); }
.lp-instrument.w .d { stroke: var(--pws); fill: none; stroke-width: 1.2px; }
.lp-instrument.b .d { stroke: var(--pbh); fill: none; stroke-width: 1.2px; }
/* nocturne: dark glass with a top rim of light */
.lp-nocturne .o { stroke-width: 2.6; }
.lp-nocturne.w .o { stroke: var(--pws); fill: var(--pws); }
.lp-nocturne.b .o { stroke: var(--pbs); fill: var(--pbs); }
.lp-nocturne.w .f { fill: url(#lp-nocturne-grad-w); }
.lp-nocturne.b .f { fill: url(#lp-nocturne-grad-b); }
#lp-nocturne-grad-w stop:first-child { stop-color: var(--pw1); } #lp-nocturne-grad-w stop:last-child { stop-color: var(--pw2); }
#lp-nocturne-grad-b stop:first-child { stop-color: var(--pb1); } #lp-nocturne-grad-b stop:last-child { stop-color: var(--pb2); }
.lp-nocturne.w .rim { filter: url(#lp-nocturne-rim-w); }
.lp-nocturne.b .rim { filter: url(#lp-nocturne-rim-b); }
.lp-nocturne.w .d { stroke: var(--pws); fill: var(--pws); stroke-width: 2; }
.lp-nocturne.b .d { stroke: var(--pbh); fill: var(--pbh); stroke-width: 1.8; }
`;

/** Builds the `<defs>` markup (symbols, gradients, filters) for one custom set. */
export function customSprite(set: CustomSet): string {
	const geometry = CUSTOM_SETS[set];
	const nss = (markup: string) =>
		set === 'instrument' ? markup.replace(/<(path|rect|circle|ellipse) /g, '<$1 vector-effect="non-scaling-stroke" ') : markup;
	let defs = '';
	if (set === 'material') defs += gradient('lp-material-grad-w') + gradient('lp-material-grad-b');
	if (set === 'material') defs += '<filter id="lp-material-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="2.2"/></filter>' + lit('lp-material-lit-w', true) + lit('lp-material-lit-b', false);
	if (set === 'nocturne') defs += gradient('lp-nocturne-grad-w') + gradient('lp-nocturne-grad-b') + rim('lp-nocturne-rim-w', true) + rim('lp-nocturne-rim-b', false);
	if (set === 'monolith') defs += gradient('lp-monolith-grad-w') + gradient('lp-monolith-grad-b');

	for (const t of TYPES) {
		const g = geometry[t];
		defs += `<g id="lp-${set}-g-${t}">${nss(g.s)}</g><g id="lp-${set}-gd-${t}">${nss(g.d ?? '')}</g>`;
		for (const c of ['w', 'b'] as const) {
			const o = `<use href="#lp-${set}-g-${t}" class="o"/>`;
			const f = `<use href="#lp-${set}-g-${t}" class="f"/>`;
			const d = `<use href="#lp-${set}-gd-${t}" class="d"/>`;
			const symbol = (suffix: string, inner: string) =>
				`<symbol id="lp-${set}-${c}${t}${suffix}" viewBox="0 0 100 100"><g class="lp lp-${set} ${c}">${inner}</g></symbol>`;
			if (set === 'material') {
				const ao = `<ellipse class="ao" cx="50" cy="92" rx="${(g.ao ?? 24) + 1}" ry="3.6"/>`;
				defs += symbol('', `${ao}${o}<g class="lit">${f}</g>${d}`);
				// The unlit variant: the same silhouette without the lighting chain, for anything that moves.
				defs += symbol('-flat', `${ao}${o}${f}${d}`);
			} else if (set === 'nocturne') {
				defs += symbol('', `${o}<g class="rim">${f}</g>${d}`);
			} else {
				defs += symbol('', `${o}${f}${d}`);
			}
		}
	}
	return `<style>${STYLE}</style><defs>${defs}</defs>`;
}
