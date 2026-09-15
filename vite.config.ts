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
			adapter: adapter()
		})
	],
	server: {
		// Must match the Google OAuth redirect URI registered for local dev.
		port: 5177,
		strictPort: true
	}
});
