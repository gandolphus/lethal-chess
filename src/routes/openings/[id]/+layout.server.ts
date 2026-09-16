import { error } from '@sveltejs/kit';
import type { Bundle } from '$lib/drill/bundle';
import { loadOpeningIndex } from '$lib/drill/openings';
import { fetchStatic } from '$lib/server/assets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const opening = (await loadOpeningIndex((path) => fetchStatic(event, path))).find((o) => o.id === event.params.id);
	if (!opening) error(404, 'Unknown opening');
	const response = await fetchStatic(event, `/openings/repertoires/${event.params.id}.json`);
	if (!response.ok) error(response.status, 'Could not load this opening');
	return { opening, bundle: (await response.json()) as Bundle };
};
