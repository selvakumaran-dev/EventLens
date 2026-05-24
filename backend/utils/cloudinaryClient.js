import https from 'https';

/**
 * Delete resources from Cloudinary using pure Node.js HTTPS REST API.
 * Zero external library dependencies.
 *
 * @param {string[]} publicIds - Array of Cloudinary public IDs to delete
 * @returns {Promise<object>} - Resolution promise with API response
 */
export function deleteCloudinaryResources(publicIds) {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('⚠️  Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) missing in backend .env. Skipping asset deletion.');
      return resolve({ success: false, message: 'Cloudinary credentials missing' });
    }

    if (!publicIds || publicIds.length === 0) {
      return resolve({ success: true, message: 'No public IDs provided' });
    }

    // Build the query string: ?public_ids[]=id1&public_ids[]=id2...
    const queryParts = publicIds.map((id) => `public_ids[]=${encodeURIComponent(id)}`);
    const path = `/v1_1/${cloudName}/resources/image/upload?${queryParts.join('&')}`;

    // Basic Auth header: Basic base64(apiKey:apiSecret)
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const options = {
      hostname: 'api.cloudinary.com',
      port: 443,
      path: path,
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Length': 0,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`🧹  Cloudinary assets deleted successfully:`, publicIds);
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Cloudinary response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}
