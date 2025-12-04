import { request } from 'http';

export default {
	id: process.env.ASSETS_FILENAME_ENDPOINT_PATH || 'assets',
	handler: (router, { env, services, getSchema }) => {
		const assetsPathSeparator = process.env.ASSETS_FILENAME_ENDPOINT_PATH ? '' : '/_';
		// Proxy function that properly forwards all headers and status codes
		// This preserves the cache strategy from the default assets endpoint
		function proxyToAssetsEndpoint(fileId, req, res) {
			// Parse host and port from request or env vars
			// Since we're proxying internally, use the request's host or localhost
			let hostname = 'localhost';
			let port = env.PORT || 8055;
			
			// Build path with query string to preserve transformation params (width, height, etc.)
			// req.url contains the full path including query string from the original request
			// We need to extract just the query string part and append it to our proxied path
			const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
			let path = `/assets/${fileId}${queryString}`;
			
			// Try to get host from request first
			const hostHeader = req.get('host');
			if (hostHeader) {
				const [host, portStr] = hostHeader.split(':');
				hostname = host;
				if (portStr) {
					port = parseInt(portStr, 10);
				}
			} else if (env.HOST) {
				const [host, portStr] = env.HOST.split(':');
				hostname = host;
				if (portStr) {
					port = parseInt(portStr, 10);
				}
			}
			
			// Create headers object, excluding host to avoid conflicts
			const headers = { ...req.headers };
			delete headers.host;
			
			// Use options object format to avoid URL parsing issues
			const proxyReq = request(
				{
					hostname: hostname,
					port: port,
					path: path,
					method: req.method,
					headers: headers,
				},
				(proxyRes) => {
					// Forward status code
					res.statusCode = proxyRes.statusCode;
					res.statusMessage = proxyRes.statusMessage;
					
					// Forward all headers (including cache headers)
					// This preserves the cache strategy from the default endpoint
					const responseHeaders = proxyRes.headers;
					for (const [key, value] of Object.entries(responseHeaders)) {
						// Skip headers that shouldn't be forwarded
						if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'transfer-encoding') {
							res.setHeader(key, value);
						}
					}
					
					// Pipe the response body
					proxyRes.pipe(res);
				}
			);
			
			// Handle proxy request errors
			proxyReq.on('error', (err) => {
				if (!res.headersSent) {
					res.status(500).json({ 
						errors: [{ 
							message: 'Failed to proxy request to assets endpoint',
							extensions: { code: 'INTERNAL_SERVER_ERROR' }
						}] 
					});
				}
			});
			
			// Handle client abort
			req.on('aborted', () => {
				proxyReq.destroy();
			});
			
			proxyReq.end();
		}

		// Shared handler function for file lookup by field
		async function handleFileLookup(req, res, fieldName, value) {
			// Validate value is not empty
			if (!value || value.trim() === '') {
				res.sendStatus(404);
				return;
			}

			const { FilesService } = services;
			
			try {
				// Create FilesService with proper accountability to respect permissions
				const filesService = new FilesService({
					schema: await getSchema(),
					accountability: req.accountability,
				});
				
				// Query file by the specified field
				// Using readByQuery with accountability ensures permission checks are applied
				const files = await filesService.readByQuery({
					filter: {
						[fieldName]: {
							_eq: value
						}
					},
					limit: 1,
				});
				
				const file = files?.[0];
				
				if (!file) {
					res.sendStatus(404);
					return;
				}
				
				// Proxy to the default assets endpoint with the file ID
				// This ensures all default checks, caching, and behavior are preserved
				proxyToAssetsEndpoint(file.id, req, res);
				
			} catch (err) {
				// Handle specific error types if needed
				if (err.status === 403 || err.statusCode === 403) {
					res.sendStatus(403);
					return;
				}
				
				// Log error for debugging but don't expose internal details
				console.error(`Error in assets-by-${fieldName} endpoint:`, err);
				
				if (!res.headersSent) {
					res.sendStatus(404);
				}
			}
		}

		if (process.env.ASSETS_FILENAME_ENDPOINT_PATH) {
			// Endpoint: /a/fd/:filename
			router.get(`${assetsPathSeparator}/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'filename_disk', filename);
			});

			// Endpoint: /a/t/:filename
			router.get(`${assetsPathSeparator}/t/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'title', filename);
			});

			// Endpoint: /a/d/:filename
			router.get(`${assetsPathSeparator}/d/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'filename_download', filename);
			});
		} else {
			// Shorter variants: /_/ instead of /field/
			// Endpoint: /_/fd/:filename
			router.get(`${assetsPathSeparator}/fd/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'filename_disk', filename);
			});

			// Endpoint: /_/f/:filename
			router.get(`${assetsPathSeparator}/t/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'title', filename);
			});

			// Endpoint: /_/filename_download/:filename
			router.get(`${assetsPathSeparator}/d/:filename`, async (req, res) => {
				const filename = req.params['filename'];
				await handleFileLookup(req, res, 'filename_download', filename);
			});
		}
	}
};