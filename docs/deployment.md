# Deploy the static website to a VPS

Build locally and upload only `dist/`; Nginx serves the files without a Node.js process. This guide assumes **Ubuntu/Debian with systemd**, SSH access as a non-root sudo user, and a domain you control. It has not been run against your VPS.

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
