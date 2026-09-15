import { loadOpeningIndex } from '$lib/drill/openings';
import { fetchStatic } from '$lib/server/assets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	openings: await loadOpeningIndex((path) => fetchStatic(event, path))
});
