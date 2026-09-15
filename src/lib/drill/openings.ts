import type { OpeningIndexEntry } from './bundle';

export const OPENING_GROUPS: { id: OpeningIndexEntry['group']; label: string }[] = [
	{ id: 'white-e4', label: 'White · 1.e4' },
	{ id: 'white-d4', label: 'White · 1.d4' },
	{ id: 'white-flank', label: 'White · flank openings' },
	{ id: 'black-e4', label: 'Black against 1.e4' },
	{ id: 'black-d4', label: 'Black against 1.d4' }
];

/** The builder writes this next to the bundles; it is the one list of available openings. */
export async function loadOpeningIndex(fetcher: (path: string) => Promise<Response>): Promise<OpeningIndexEntry[]> {
	const response = await fetcher('/openings/repertoires/index.json');
	if (!response.ok) throw new Error(`Could not load the opening list (${response.status})`);
	return response.json();
}
