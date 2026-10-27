# Deploying to the tablet (CI/CD)

The `v2-development` branch is self-hosted on a tablet. Code is written on the
PC, and the tablet picks up each change on its own once CI has checked it:

```
PC                       GitHub Actions                         Tablet
git push ──► v2-development ──► CI: lint, format, tests, build
                                   │ all green
                                   ▼
                           v2-deploy branch moved ◄── scripts/tab-deploy.sh watch
                                                       (checks every 60s)
                                                       pull → install → build
                                                       → restart → health check
                                                       → roll back if it fails
```

- **CI** (`.github/workflows/ci.yml`) runs on every push to `v2-development`.
  When all checks pass, the `promote` job points the `v2-deploy` branch at that
  commit. A commit that fails CI never reaches `v2-deploy`.
- **CD** (`scripts/tab-deploy.sh`) runs on the tablet and watches `v2-deploy`.
  The tablet pulls from GitHub, so it needs no public IP, port forwarding or
  webhook.

Never push to `v2-deploy` yourself in normal use; CI owns it.

## What a deploy does

1. Fast-forwards the tablet's checkout to the new commit.
2. Runs `npm ci` only if `package-lock.json` changed, and `npm ci --prefix frontend` only if `frontend/package-lock.json` changed.
3. Rebuilds the frontend only if something under `frontend/` changed. Backend-only changes just restart.
4. Restarts the server and waits up to 90 seconds for it to answer on `PORT`.
5. If any step fails, it goes back to the previous commit, rebuilds and restarts that, and skips the bad commit until a newer one arrives.

It also restarts the server if it finds it has stopped.

## One-time tablet setup (Android + Termux)

These steps assume [Termux](https://f-droid.org/packages/com.termux/) from
F-Droid (the Play Store build is outdated). On a Linux tablet, skip the `pkg`
and Termux:Boot parts.

1. **Install the tools**
    ```bash
    pkg update && pkg install git nodejs
    npm install -g pm2   # optional but recommended: restarts the app if it crashes
    ```

2. **Clone the repo, or update the clone you already have**
    ```bash
    git clone -b v2-development https://github.com/Abhay1006/talkify.git ~/talkify
    cd ~/talkify
    cp .env.example .env   # then fill in MONGO_DB_URI, JWT_SECRET, PORT, ...
    ```
    If the tablet already has a clone, `cd` into it, `git pull origin v2-development`
    once to get the script, and keep your existing `.env`. The deploy script
    refuses to run while tracked files have local edits, so check `git status`
    is clean (a `package-lock.json` changed by `npm install` is the usual
    culprit: `git checkout -- package-lock.json frontend/package-lock.json`).

3. **Stop the server if you started it by hand**, then start it through the script:
    ```bash
    ./scripts/tab-deploy.sh            # installs, builds and starts the app
    ./scripts/tab-deploy.sh status
    ```

4. **Keep watching for new commits**
    ```bash
    ./scripts/tab-deploy.sh watch      # checks every 60 seconds; Ctrl+C stops watching, not the app
    ```
    `watch` takes a wake lock so Android does not suspend Termux with the
    screen off. Also turn off battery optimisation for Termux in Android's
    settings (Apps → Termux → Battery → Unrestricted).

5. **Start everything when the tablet boots** (optional). Install
   [Termux:Boot](https://f-droid.org/packages/com.termux.boot/), open it once,
   then:
    ```bash
    mkdir -p ~/.termux/boot
    cat > ~/.termux/boot/talkify <<'EOF'
    #!/data/data/com.termux/files/usr/bin/sh
    termux-wake-lock
    cd ~/talkify && ./scripts/tab-deploy.sh watch >/dev/null 2>&1 &
    EOF
    chmod +x ~/.termux/boot/talkify
    ```
    `watch` starts the app on its first check, so nothing else is needed.

## Day to day

On the PC:

```bash
git push origin v2-development
```

Within a few minutes (CI time plus up to 60 seconds) the tablet is running it.
Follow along in the repo's **Actions** tab on GitHub, and on the tablet with
`tail -f logs/deploy.log`.

## Commands

| Command | What it does |
|---|---|
| `scripts/tab-deploy.sh` | Deploy once if `v2-deploy` has moved; start the app if it is down |
| `scripts/tab-deploy.sh watch [seconds]` | Do that forever, every 60 seconds by default |
| `scripts/tab-deploy.sh status` | Deployed commit, skipped failed commit, whether the app runs |
| `scripts/tab-deploy.sh restart` | Restart the app without pulling (e.g. after editing `.env`) |
| `scripts/tab-deploy.sh stop` | Stop the app |

Logs: `logs/deploy.log` for deploys; `logs/talkify.log` for the app, or
`pm2 logs talkify` when pm2 is installed.

Optional settings, as environment variables or in `.deploy/env` (sourced
by the script, gitignored): `DEPLOY_BRANCH` (default `v2-deploy`),
`DEPLOY_REMOTE` (`origin`), `APP_NAME` (`talkify`), `HEALTH_TIMEOUT` (`90`
seconds), `PORT` (read from `.env`, else `5001`), `RESTART_CMD` and
`POST_INSTALL` (see below).

## When something else already runs the server

If a supervisor (a tmux watchdog, systemd, ...) already starts the app and
revives it after crashes, don't let the script start a second copy on the
same port. Set `RESTART_CMD` to the command that restarts it through that
supervisor. The script then only runs that command when deploying, and
leaves crash recovery to the supervisor; `stop` is refused.

`POST_INSTALL` runs after every server `npm ci`, for packages the host needs
but the lockfile doesn't list. Example `.deploy/env` for a tablet whose
services run in tmux session `services` and which needs sharp's WebAssembly
build:

```bash
RESTART_CMD='tmux kill-window -t services:=talkify 2>/dev/null; tmux new-window -d -t services -n talkify "cd $HOME/projects/talkify && npm start"'
POST_INSTALL='npm install --no-save --cpu=wasm32 @img/sharp-wasm32@$(node -p "require(\"./node_modules/sharp/package.json\").version")'
```

The `=` in `services:=talkify` makes tmux match the window name exactly, so
it cannot hit a window like `talkify-tunnel` by prefix.

## Troubleshooting

- **"refusing to deploy … local changes"**: someone edited files on the
  tablet. Commit those changes on the PC instead, then on the tablet run
  `git stash` or `git checkout -- <file>`.
- **"not a fast-forward"**: `v2-development` was force-pushed or rebased. If
  the remote version is right, run
  `git reset --hard origin/v2-deploy` on the tablet, then
  `./scripts/tab-deploy.sh`.
- **A commit was rolled back**: the server would not start on it, usually
  because of a missing `.env` setting or a startup crash. `logs/talkify.log`
  shows why. Push a fix; the next green commit deploys normally.
- **Nothing deploys**: check that the CI run on GitHub is green and that its
  `promote` job ran. Then run `./scripts/tab-deploy.sh` by hand on the tablet
  and read its output.
- **Deploy without waiting for CI** (emergencies only):
  `git push origin v2-development:v2-deploy --force` from the PC.
