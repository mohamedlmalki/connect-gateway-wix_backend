import fs from 'fs';
import path from 'path';
import https from 'https';

const configPath = path.resolve(process.cwd(), 'src/headless/config/headless-config.json');
const headlessProjects = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const apiMiddleware = (req, res, next) => {
  if (req.url !== '/api/headless-register') {
    return next();
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const { email, siteId } = JSON.parse(body);
      const project = headlessProjects.find(p => p.siteId === siteId);

      if (!project) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: 'Project configuration not found.' }));
      }

      const wixApiUrl = 'https://www.wixapis.com/_api/iam/authentication/v2/register';
      const requestBody = JSON.stringify({
        loginId: { email },
        password: "Password123!",
        captcha_tokens: []
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': project.apiKey,
          'wix-site-id': project.siteId, // Pass the siteId here as per the Svelte example
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const apiReq = https.request(wixApiUrl, options, (apiRes) => {
        res.statusCode = apiRes.statusCode;
        Object.keys(apiRes.headers).forEach(key => res.setHeader(key, apiRes.headers[key]));
        apiRes.pipe(res);
      });

      apiReq.on('error', (e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ message: 'Internal server error during API call.' }));
      });

      apiReq.write(requestBody);
      apiReq.end();
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: 'Invalid request body.' }));
    }
  });
};