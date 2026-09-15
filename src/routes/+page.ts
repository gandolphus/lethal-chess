import { loadOpeningIndex } from '$lib/drill/openings';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => ({ openings: await loadOpeningIndex(fetch) });
