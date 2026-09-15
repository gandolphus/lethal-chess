import { error } from '@sveltejs/kit';
import type { Bundle } from '$lib/drill/bundle';
import { loadOpeningIndex } from '$lib/drill/openings';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const opening = (await loadOpeningIndex(fetch)).find((o) => o.id === params.id);
	if (!opening) error(404, 'Unknown opening');
	const response = await fetch(`/openings/repertoires/${params.id}.json`);
	if (!response.ok) error(response.status, 'Could not load this opening');
	return { opening, bundle: (await response.json()) as Bundle };
};
