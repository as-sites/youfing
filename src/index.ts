/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const extensionRoute = (extension: string, paths: string[]) =>
	paths.reduce<Record<string, string>>((acc, path) => ({ ...acc, [path]: `${path}.${extension}` }), {});

// manually defined routes are faster than trying fallbacks
const routes: Record<string, string> = {
	...extensionRoute('jpg', ['muppet', 'legend', 'genius']),
	...extensionRoute('jpeg', ['idiot']),
	...extensionRoute('gif', ['tool']),
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.replace(/^\//, '');

		const img =
			(routes[path] ? await env.imgBucket.get(routes[path]) : null) ??
			(await env.imgBucket.get(`${path}.jpg`)) ??
			(await env.imgBucket.get(`${path}.jpeg`)) ??
			(await env.imgBucket.get(`${path}.png`)) ??
			(await env.imgBucket.get(`${path}.gif`));

		if (!img) {
			return new Response('No matching route or image could be found.', { status: 404 });
		}

		return new Response(img.body, {
			headers: {
				'Content-Type': img.httpMetadata?.contentType ?? 'image/jpeg',
				'Content-Length': img.size.toString(),
			},
		});
	},
} satisfies ExportedHandler<Env>;
