import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Cloudflare Workers + D1 (see wrangler.jsonc). In `vite dev` the adapter's
			// platform proxy provides `platform.env.DB` backed by local D1 in .wrangler/state
			// and reads secrets from .dev.vars.
			adapter: adapter(),

			// Open tabs check once a minute whether a new build has been deployed. When one has,
			// SvelteKit turns the next navigation into a full page load, and the layout offers a reload.
			version: { pollInterval: 60_000 },

			// Content Security Policy. `hash` mode lets SvelteKit hash its own inline bootstrap script,
			// so no 'unsafe-inline' is needed for scripts.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					// Stockfish runs as WebAssembly inside a same-origin worker.
					'script-src': ['self', 'wasm-unsafe-eval', 'https://static.cloudflareinsights.com'],
					'worker-src': ['self'],
					// Piece sprites carry <style> rules and style attributes; inline styles cannot run code.
					'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
					'font-src': ['self', 'https://fonts.gstatic.com'],
					// Google profile pictures of signed-in users.
					'img-src': ['self', 'data:', 'https://*.googleusercontent.com'],
					// Cloudflare Web Analytics reports visits here.
					'connect-src': ['self', 'https://cloudflareinsights.com'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	server: {
		// Must match the Google OAuth redirect URI registered for local dev.
		port: 5177,
		strictPort: true
	}
});
