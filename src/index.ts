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

const routes: Record<string, string> = {
	muppet: 'muppet.jpg',
	legend: 'legend.jpg',
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.replace(/^\//, '');

		if (routes[path]) {
			const img = await env.imgBucket.get(routes[path]);

			if (!img) {
				return new Response('Image could not be found in bucket.', { status: 404 });
			}

			return new Response(img.body, {
				headers: {
					'Content-Type': img.httpMetadata?.contentType ?? 'image/jpeg',
					'Content-Length': img.size.toString(),
				},
			});
		}

		return new Response('Route not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
