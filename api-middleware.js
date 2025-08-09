import fs from 'fs';
import path from 'path';
import https from 'https';

const configPath = path.resolve(process.cwd(), 'src/headless/config/headless-config.json');
let headlessProjects = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Helper function for fetching all members with pagination
const fetchAllMembers = (options) => {
    return new Promise((resolve, reject) => {
        let allMembers = [];
        let offset = 0;
        const limit = 1000;

        const fetchPage = () => {
            const wixApiUrl = `https://www.wixapis.com/members/v1/members?paging.limit=${limit}&paging.offset=${offset}&fieldsets=FULL`;
            const apiReq = https.request(wixApiUrl, { ...options, method: 'GET' }, (apiRes) => {
                let data = '';
                apiRes.on('data', chunk => { data += chunk; });
                apiRes.on('end', () => {
                    try {
                        const parsedData = JSON.parse(data);
                        if (parsedData.members && parsedData.members.length > 0) {
                            allMembers = allMembers.concat(parsedData.members);
                            offset += parsedData.members.length;
                            if (parsedData.metadata && parsedData.metadata.total > allMembers.length) {
                                fetchPage();
                            } else {
                                resolve(allMembers);
                            }
                        } else {
                            resolve(allMembers);
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse API response: ' + e.message));
                    }
                });
            });
            apiReq.on('error', (e) => reject(e));
            apiReq.end();
        };
        fetchPage();
    });
};

export const apiMiddleware = (req, res, next) => {
  if (!req.url.startsWith('/api/headless-')) {
    return next();
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      
      if (req.url === '/api/headless-get-config' && req.method === 'GET') {
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(currentConfig));
      } 
      else if (req.url === '/api/headless-update-config' && req.method === 'POST') {
        const newConfigData = parsedBody.config;
        if (!newConfigData) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: "Request must include a 'config' property." }));
        }
        try {
          fs.writeFileSync(configPath, JSON.stringify(newConfigData, null, 2));
          headlessProjects = newConfigData;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Configuration updated successfully.' }));
        } catch (writeError) {
          console.error("Failed to write to config file:", writeError);
          res.statusCode = 500;
          res.end(JSON.stringify({ message: 'Failed to write configuration file.' }));
        }
        return; 
      }

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
      } 
      else if (req.url === '/api/headless-search') {
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
      } 
      else if (req.url === '/api/headless-delete') {
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
      }
      else if (req.url === '/api/headless-list-all') {
        try {
            const allMembers = await fetchAllMembers(defaultOptions);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ members: allMembers }));
        } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Failed to fetch all members.', details: error.message }));
        }
      } 
      else if (req.url === '/api/headless-validate-links') {
          const { html } = parsedBody;
          if (!html) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ message: "Request must include an 'html' property."}));
          }
          const wixApiUrl = 'https://www.wixapis.com/email-marketing/v1/campaign-validation/validate-html-links';
          const requestBody = JSON.stringify({ html });
          const options = { ...defaultOptions, method: 'POST', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) } };
          const apiReq = https.request(wixApiUrl, options, apiRes => {
              res.statusCode = apiRes.statusCode;
              apiRes.pipe(res);
          });
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.write(requestBody);
          apiReq.end();
      }
      else if (req.url === '/api/headless-validate-link') {
          const { url } = parsedBody;
          if (!url) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ message: "Request must include a 'url' property."}));
          }
          const wixApiUrl = 'https://www.wixapis.com/email-marketing/v1/campaign-validation/validate-link';
          const requestBody = JSON.stringify({ url });
          const options = { ...defaultOptions, method: 'POST', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) } };
          const apiReq = https.request(wixApiUrl, options, apiRes => {
              res.statusCode = apiRes.statusCode;
              apiRes.pipe(res);
          });
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.write(requestBody);
          apiReq.end();
      }
      // ★★★ NEW: ROUTE HANDLER: Send Test Email ★★★
      else if (req.url === '/api/headless-send-test-email') {
          const { campaignId, emailSubject, toEmailAddress } = parsedBody;
          if (!campaignId || !emailSubject || !toEmailAddress) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ message: "Request must include 'campaignId', 'emailSubject', and 'toEmailAddress'." }));
          }
          const wixApiUrl = `https://www.wixapis.com/email-marketing/v1/campaigns/${campaignId}/test`;
          const requestBody = JSON.stringify({ emailSubject, toEmailAddress });
          const options = { ...defaultOptions, method: 'POST', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) } };
          const apiReq = https.request(wixApiUrl, options, apiRes => {
              res.statusCode = apiRes.statusCode;
              apiRes.pipe(res);
          });
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.write(requestBody);
          apiReq.end();
      }
      else if (req.url === '/api/headless-get-stats') {
          const { campaignIds } = parsedBody;
          if (!campaignIds || !Array.isArray(campaignIds)) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ message: "Request must include a 'campaignIds' array." }));
          }
          const wixApiUrl = `https://www.wixapis.com/email-marketing/v1/campaigns/statistics?${campaignIds.map(id => `campaignIds=${id}`).join('&')}`;
          const options = { ...defaultOptions, method: 'GET' };
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.end();
      }
      else if (req.url === '/api/headless-get-recipients') {
          const { campaignId, activity } = parsedBody;
          if (!campaignId || !activity) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ message: "Request must include 'campaignId' and 'activity'." }));
          }
          const wixApiUrl = `https://www.wixapis.com/email-marketing/v1/campaigns/${campaignId}/statistics/recipients?activity=${activity}`;
          const options = { ...defaultOptions, method: 'GET' };
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.end();
      }
      else if (req.url === '/api/headless-sender-details') {
        const wixApiUrl = 'https://www.wixapis.com/email-marketing/v1/sender-details';
        if (req.method === 'POST') {
          const options = { ...defaultOptions, method: 'GET' };
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.end();
        } else if (req.method === 'PATCH') {
          const { senderDetails } = parsedBody;
          const requestBody = JSON.stringify({ senderDetails });
          const options = { ...defaultOptions, method: 'PATCH', headers: { ...defaultOptions.headers, 'Content-Length': Buffer.byteLength(requestBody) }};
          const apiReq = https.request(wixApiUrl, options, apiRes => apiRes.pipe(res));
          apiReq.on('error', (e) => { res.statusCode = 500; res.end(JSON.stringify({ message: 'API call error.' })); });
          apiReq.write(requestBody);
          apiReq.end();
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ message: `Method ${req.method} not allowed for this route.` }));
        }
      } else {
        next();
      }
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: 'Invalid request body or server error.' }));
    }
  });
};