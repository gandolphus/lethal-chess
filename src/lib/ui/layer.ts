// A layer is a screen that opens over whatever you were doing and leaves it exactly as it was: the page
// beneath stays mounted, its session keeps running, and closing the layer is one step back. It is still
// a route — a reload, a shared link or a cold arrival lands on the same content as a page — but from
// inside the app it is drawn over the page rather than in place of it.
//
// What earns a screen a place here: you reach it from the middle of something, it has no state of its
// own worth coming back to, and what it does is either felt on the page behind it (a theme) or over in
// a moment (a report). Prose you arrive at from a link elsewhere — Privacy, Credits — is a page.

export type Layer = 'settings' | 'report';

export const LAYERS: Record<Layer, { path: string; title: string }> = {
	settings: { path: '/settings', title: 'Settings' },
	report: { path: '/report', title: 'Report a bug' }
};

/** The layer a path names, if it names one. */
export function layerAt(pathname: string): Layer | null {
	for (const layer of Object.keys(LAYERS) as Layer[]) {
		if (LAYERS[layer].path === pathname) return layer;
	}
	return null;
}

/**
 * Whether a click on a link is the plain kind that changes this tab. A modifier, another button or an
 * event someone has already handled means the browser has other plans for it — a new tab, say — and
 * a layer must not get in the way of that.
 */
export function isPlainClick(event: {
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	defaultPrevented: boolean;
}): boolean {
	return (
		event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented
	);
}

/** The layer a link opens, if any: a link into this site, to a layer's path, meant for this tab. */
export function layerOfLink(link: { href: string; target: string; download: string }, origin: string): Layer | null {
	if ((link.target && link.target !== '_self') || link.download) return null;
	try {
		const url = new URL(link.href, origin);
		return url.origin === origin ? layerAt(url.pathname) : null;
	} catch {
		return null;
	}
}
