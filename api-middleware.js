import fs from 'fs';
import path from 'path';
import https from 'https';

const configPath = path.resolve(process.cwd(), 'src/headless/config/headless-config.json');
const headlessProjects = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const apiMiddleware = (req, res, next) => {
  // If the request isn't for our specific API routes, pass it on.
  if (!req.url.startsWith('/api/headless-')) {
    return next();
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      const { siteId } = parsedBody;
      const project = headlessProjects.find(p => p.siteId === siteId);

      if (!project) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: `Project configuration not found for siteId: ${siteId}` }));
      }

      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': project.apiKey,
          'wix-site-id': project.siteId,
        }
      };

      // --- ROUTE HANDLER: Register Member ---
      if (req.url === '/api/headless-register') {
        const { email } = parsedBody;
        const wixApiUrl = 'https://www.wixapis.com/_api/iam/authentication/v2/register';
        const requestBody = JSON.stringify({
          loginId: { email },
          password: "Password123!",
          captcha_tokens: []
        });
        const options = { ...defaultOptions, method: 'POST', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) } };
        const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
        apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
        apiReq.write(requestBody);
        apiReq.end();
      
      // --- ROUTE HANDLER: Search Members ---
      } else if (req.url === '/api/headless-search') {
        const { query } = parsedBody;
        const wixApiUrl = 'https://www.wixapis.com/members/v1/members/query';
        const requestBody = JSON.stringify({
          fieldsets: ["FULL"],
          query: { filter: { loginEmail: query } }
        });
        const options = { ...defaultOptions, method: 'POST', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) } };
        const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
        apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
        apiReq.write(requestBody);
        apiReq.end();

      // --- ROUTE HANDLER: Delete Members ---
      } else if (req.url === '/api/headless-delete') {
          const { memberIds } = parsedBody;
          const deletePromises = memberIds.map(memberId => new Promise((resolve, reject) => {
              const wixApiUrl = `https://www.wixapis.com/members/v1/members/${memberId}`;
              const options = { ...defaultOptions, method: 'DELETE' };
              const apiReq = https.request(wixApiUrl, options, (apiRes) => {
                  if (apiRes.statusCode === 200) {
                      resolve({ memberId, status: 'success' });
                  } else {
                      let errorData = '';
                      apiRes.on('data', chunk => { errorData += chunk; });
                      apiRes.on('end', () => reject({ memberId, status: 'failed', error: errorData }));
                  }
              });
              apiReq.on('error', (e) => reject({ memberId, status: 'failed', error: e.message }));
              apiReq.end();
          }));
          const results = await Promise.allSettled(deletePromises);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(results));

      // --- ROUTE HANDLER: Get/Update Sender Details ---
      } else if (req.url === '/api/headless-sender-details') {
        const wixApiUrl = 'https://www.wixapis.com/email-marketing/v1/sender-details';
        if (req.method === 'POST') { // This is our GET request
          const options = { ...defaultOptions, method: 'GET' };
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.end();
        } else if (req.method === 'PATCH') { // This is our UPDATE request
          const { senderDetails } = parsedBody;
          const requestBody = JSON.stringify({ senderDetails });
          const options = { ...defaultOptions, method: 'PATCH', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) }};
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.write(requestBody);
          apiReq.end();
        } else {
          res.statusCode = 405; // Method Not Allowed
          res.end(JSON.stringify({ message: `Method ${req.method} not allowed for this route.` }));
        }

      } else {
        // If the route starts with /api/headless- but doesn't match any of the above, pass it on.
        next();
      }

    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: 'Invalid request body or server error.' }));
    }
  });
};