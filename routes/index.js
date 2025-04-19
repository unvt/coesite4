var express = require('express');
var router = express.Router();

// Check if development mode is enabled
const devMode = process.env.DEV_MODE === 'true';

/* GET home page. */
router.get('/', 
 async function(req, res, next) {

  let params = {
    active: { home: true }
  };

  // Get the user
  const user = req.app.locals.users[req.session.userId];
  
  // Skip access token acquisition in development mode
  if (!devMode) {
    // Get the access token
    var accessToken;
    try {
      accessToken = await getAccessToken(req.session.userId, req.app.locals.msalClient);
    } catch (err) {
      res.send(JSON.stringify(err, Object.getOwnPropertyNames(err)));
      return;
    }
  }

  res.render('index', params);
});


async function getAccessToken(userId, msalClient) {
  // Look up the user's account in the cache
  try {
    const accounts = await msalClient
      .getTokenCache()
      .getAllAccounts();

    const userAccount = accounts.find(a => a.homeAccountId === userId);

    // Get the token silently
    const response = await msalClient.acquireTokenSilent({
      scopes: process.env.OAUTH_SCOPES.split(','),
      redirectUri: process.env.OAUTH_REDIRECT_URI,
      account: userAccount
    });

    return response.accessToken;
  } catch (err) {
    console.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
  }
}

module.exports = router;

