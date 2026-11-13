# Deploy the static website

For this static site, the GitHub Actions workflow validates and builds the public files, then uploads that exact production build to a dedicated VPS release directory over SSH. Caddy serves the active release. No app container, Node.js process, Docker, Coolify, or application runtime secrets are needed.

## GitHub Actions → Caddy on the VPS

`.github/workflows/deploy.yml` runs on pushes to `main` and on manual dispatch. It runs `npm ci`, `npm run check`, a preview build, the tests, then an indexable production build. The built `dist/` is passed as an artifact from the successful validation job to deployment; it is not rebuilt a second time. Only `main` deploys, and only after all checks pass. Pull requests do not deploy production.

Each deployment is stored under `/var/www/landing/releases/<commit-sha>`. After verifying `index.html`, the workflow atomically switches `/var/www/landing/current` to that release. Previous releases are retained for rollback. Caddy serves the symlinked `current` directory; content deployments do not reload Caddy. Do not copy Hepta's Docker build, container replacement, or app secrets: this is a static site.

### 1. Prepare Caddy and the VPS once

The workflow deploys to `/var/www/landing`. Keep an existing SSH/Caddy/domain setup intact; adapt the example to your actual Caddyfile rather than replacing a site block blindly. Configure the domain to serve the active directory:

```caddyfile
carloscampos.cloud {
    root * /var/www/landing/current
    file_server
}
```

The hostname's DNS must point to the VPS, and ports 80/443 must reach Caddy for automatic HTTPS. Validate and reload Caddy **only if its configuration changed**:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Create the deployment path and make the SSH account the owner. Caddy needs read/traverse access to the directory and files; do not use world-writable permissions such as `777`.

```sh
sudo install -d -o YOUR_SSH_USER -g YOUR_SSH_USER -m 0755 \
  /var/www/landing /var/www/landing/releases
```

The SSH account must own both directories: it writes release files beneath `releases` and creates/replaces the `current` symlink directly beneath `/var/www/landing`. Confirm both paths are writable by that account and Caddy can read the deployed files. If your Caddy service runs in a container or has custom filesystem restrictions, ensure it can see `/var/www/landing/current` before proceeding.

### 2. Add SSH credentials to GitHub

Create these **Repository secrets** under GitHub **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP address. |
| `VPS_USER` | SSH account that owns `/var/www/landing` and can write releases there. |
| `VPS_SSH_KEY` | Private OpenSSH key for that account. Keep the matching public key in its `authorized_keys`. |
| `VPS_KNOWN_HOSTS` | Verified SSH host-key line for the VPS. |

For a non-standard SSH port, create the Actions **variable** `VPS_PORT` with its numeric port; otherwise the workflow uses `22`. This workflow does not disable host-key checking. Obtain the server key from a trusted provider/console or administrator, verify its fingerprint out of band, and store the matching `known_hosts` line. Do not trust an unverified `ssh-keyscan` result. Rotate/revoke the SSH key if exposed. No Coolify token, GitHub Packages credential, Docker credential, or application secret is needed.

### 3. Deploy and verify

After configuring Caddy and the four required secrets, push a commit to `main` or manually run **Build and deploy** from GitHub **Actions**, selecting `main`. The workflow validates the source, transfers only the built static site, then switches the active symlink. Confirm the Actions jobs succeeded, open the public domain, and verify `/robots.txt` includes `Allow: /`, the page loads its image/fonts, and `/sitemap.xml` uses the expected canonical domain.

If the domain differs from `carloscampos.cloud`, update the canonical URL configuration described in the README before deploying. Caddy controls TLS; the workflow only transfers files and does not change DNS or Caddy configuration.

### Roll back

To select a previously deployed commit, run this on the VPS as the deployment SSH user, substituting a verified 40-character commit SHA whose release directory exists:

```sh
PREVIOUS_SHA='PASTE_VERIFIED_COMMIT_SHA'
test -s "/var/www/landing/releases/$PREVIOUS_SHA/index.html" &&
ln -s "/var/www/landing/releases/$PREVIOUS_SHA" "/var/www/landing/current.rollback" &&
mv -Tf "/var/www/landing/current.rollback" /var/www/landing/current
```

The workflow intentionally does not prune old releases. Remove only verified inactive releases after confirming the current and rollback targets. Changing website content requires no Caddy reload; a Caddyfile change requires validation and reload.

## Manual Nginx deployment

This is an alternative for a VPS where you intentionally want to serve the site directly with Nginx instead of the Caddy setup above. Do not configure a second web server to compete for the same domain or ports.

This route assumes **Ubuntu/Debian with systemd**, SSH access as a non-root sudo user, and a domain you control. It has not been run against your VPS.

Build locally and upload only `dist/`; Nginx serves the files without a Node.js process.

## 1. Build locally

Run in the project directory on **your computer** with Node.js >=22.23.4, npm >=9.6.5, SSH, and rsync:

```sh
npm ci
npm run check
npm run build
npm run test
PUBLIC_INDEXABLE=true npm run build
```

Keep `PUBLIC_INDEXABLE` unset for the first build: the tests expect preview `noindex` output. The last build produces the public release. Inspect `dist/index.html` for `index, follow`, `dist/robots.txt` for `Allow: /`, and `dist/sitemap.xml` for `https://carloscampos.cloud/` before uploading. Never upload the source directory, `.env`, `.git`, or `node_modules`. This follows Astro's [static build guidance](https://docs.astro.build/en/guides/deploy/).

## 2. Prepare the VPS safely

Replace `YOUR_SSH_USER` and `YOUR_VPS_IP` below. On **your computer**, keep these variables in the same terminal for the upload later:

```sh
VPS='YOUR_SSH_USER@YOUR_VPS_IP'
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
printf 'Release: %s\n' "$RELEASE"
ssh "$VPS"
```

You are now on the **VPS**. Inspect existing listeners and web-server configuration first:

```sh
sudo ss -ltnp
```

If Nginx, Apache, a control panel, a reverse proxy, or another service already manages ports 80/443 or this domain, **stop and integrate with that setup**. Do not replace its vhosts, remove its default site, or stop its services. Back up any existing site/configuration before migrating. On a server without an existing web stack:

```sh
sudo apt update
sudo apt install nginx rsync
sudo nginx -t
sudo systemctl enable --now nginx
```

Reserve `/var/www/landing` for this project only; if it already holds another site, stop. Use the release identifier printed locally (do not generate a different value here):

```sh
RELEASE='PASTE_THE_RELEASE_IDENTIFIER_PRINTED_LOCALLY'
sudo install -d -m 0755 /var/www/landing/releases
sudo mkdir "/var/www/landing/releases/$RELEASE" &&
sudo chown "$(id -un):$(id -gn)" "/var/www/landing/releases/$RELEASE"
```

`mkdir` must succeed; an existing release directory means choose a new identifier. Open inbound TCP 80 and 443 in the provider firewall and any existing host firewall, preserving SSH access. Do not enable/reset a firewall blindly. Run `exit` to return from SSH to your original local terminal.

## 3. Upload and select a release

On **your computer**, in the original project terminal containing `VPS` and `RELEASE`:

```sh
rsync -rvz --chmod=D755,F644 dist/ "$VPS:/var/www/landing/releases/$RELEASE/"
ssh "$VPS"
```

Back on the **VPS**, set the same release identifier again, record the old target for rollback, verify the upload, and switch atomically:

```sh
RELEASE='PASTE_THE_RELEASE_IDENTIFIER_PRINTED_LOCALLY'
readlink /var/www/landing/current
test -s "/var/www/landing/releases/$RELEASE/index.html" &&
sudo ln -s "/var/www/landing/releases/$RELEASE" /var/www/landing/current.next &&
sudo mv -Tf /var/www/landing/current.next /var/www/landing/current
```

The first deployment has no old target, so `readlink` returns no value. Stop if the HTML check fails, `current` is a real directory, or `current.next` already exists; inspect rather than overwrite unexpected state. Run the switch commands only after the upload succeeds. Each update gets a new release directory, so no destructive `rsync --delete` is needed.

## 4. Configure Nginx and DNS

On the **VPS**, inspect `sudo nginx -T` locally for a conflicting `server_name carloscampos.cloud`. If one exists, adapt it with its owner's approval instead of adding a duplicate. Create `/etc/nginx/sites-available/landing` with `sudoedit` **only if that file does not already exist**:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name carloscampos.cloud;
    root /var/www/landing/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Enable this new site without removing any others:

```sh
sudo ln -s /etc/nginx/sites-available/landing /etc/nginx/sites-enabled/landing
sudo nginx -t && sudo systemctl reload nginx
curl -I -H 'Host: carloscampos.cloud' http://127.0.0.1/
```

Expect HTTP 200. If IPv6 is disabled on the VPS, omit the `[::]:80` listener. This uses Nginx's [static file serving model](https://nginx.org/en/docs/beginners_guide.html).

At your DNS provider, point the domain's `A` record to the VPS IPv4 address **only after confirming that replacing its current website is intended**. Add/update `AAAA` only with working VPS IPv6; remove stale conflicting records. DNS changes can interrupt an existing website. This guide configures the apex domain only, not `www`. If the domain differs, first update the source files listed in the README and rebuild. Wait until `http://carloscampos.cloud/` reaches this release from outside the VPS.

## 5. Enable HTTPS and verify publicly

Use the current official [Certbot Nginx instructions](https://certbot.eff.org/instructions?ws=nginx&os=snap) for your OS to install Certbot. Keep an existing Certbot installation/renewal setup intact; do not mix installation methods. Back up the site's Nginx configuration before Certbot edits it:

```sh
# VPS
sudo cp -p /etc/nginx/sites-available/landing "/etc/nginx/sites-available/landing.backup.$(date -u +%Y%m%dT%H%M%SZ)"
sudo certbot --nginx -d carloscampos.cloud
sudo nginx -t
sudo certbot renew --dry-run
```

Select HTTP-to-HTTPS redirection if offered. Confirm the renewal timer/cron is active. On **your computer**, verify certificate validation, redirect behavior, and crawler files:

```sh
curl -I http://carloscampos.cloud/
curl -I https://carloscampos.cloud/
curl -fsS https://carloscampos.cloud/robots.txt
curl -fsS https://carloscampos.cloud/sitemap.xml
```

Expect HTTP to redirect to HTTPS, HTTPS 200, `Allow: /`, and the correct canonical sitemap URL. Check page source for `index, follow` and the canonical URL, then inspect the site on mobile/desktop and confirm all images/fonts load. These checks do not guarantee search-engine inclusion or performance scores.

## Updates and rollback

For each update, use the intended source revision, repeat the local checks/build, and upload to a **new** release directory. Record the source commit and old `current` target before switching. Keep at least one working prior release and a separate backup; the Git repository alone does not preserve deployed output or server configuration.

To roll back **on the VPS**, replace the placeholder with a verified retained release identifier:

```sh
PREVIOUS='YOUR_VERIFIED_PREVIOUS_RELEASE_IDENTIFIER'
test -s "/var/www/landing/releases/$PREVIOUS/index.html" &&
sudo ln -s "/var/www/landing/releases/$PREVIOUS" /var/www/landing/current.next &&
sudo mv -Tf /var/www/landing/current.next /var/www/landing/current
```

Stop if the check fails or `current.next` exists. Recheck the live site. Content-only switches need no Nginx restart; reverting server configuration requires restoring its separate backup, `sudo nginx -t`, then reload. Symlink rollback does not undo DNS or certificate changes. Old release directories consume disk space: remove only explicitly verified inactive releases after the rollback window, never the active or backup target. No automatic cleanup is configured.
