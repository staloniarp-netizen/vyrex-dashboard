# Vyrex Software — GitHub Pages version

This is the PHP panel converted to a static HTML/CSS/JS application.

## Files
- `index.html` — application entry point
- `app.js` — UI, authentication and API requests
- `styles.css` — original dark panel styling adapted for the SPA
- `config.js` — API URL
- `logo.png` — original logo

## Important
GitHub Pages cannot execute PHP. This version calls the existing web API directly from the browser.

Before publishing:
1. Change `API_BASE_URL` in `config.js` to an **HTTPS** API endpoint.
2. Configure the API server's CORS policy to allow your GitHub Pages domain.
3. Do **not** put your Discord OAuth client secret in `config.js`.
4. Discord account linking needs a trusted backend for the authorization-code exchange.
5. The static version uses `sessionStorage` for the current username/password because the original API does not appear to return a browser session/token. This is less secure than a server-side session or bearer-token flow; preferably change the API to issue a short-lived token.

The supplied API URL is HTTP (`http://51.75.118.75:20125/...`). A GitHub Pages HTTPS site cannot reliably make browser requests to an HTTP API because of mixed-content blocking. Put the API behind HTTPS (reverse proxy/TLS) first.
