#!/usr/bin/env bash
# Continuous deployment for the self-hosted tablet.
#
# CI moves the `v2-deploy` branch to every commit on v2-development that passes
# lint, tests and the frontend build (.github/workflows/ci.yml). This script
# runs on the tablet, watches that branch, and when it moves:
#
#   1. fast-forwards the checkout to the new commit,
#   2. reinstalls dependencies only if a package-lock.json changed,
#   3. rebuilds the frontend only if something under frontend/ changed,
#   4. restarts the server and waits for it to answer,
#   5. rolls back to the previous commit if any of that fails.
#
# Usage (from anywhere; the script finds the repo itself):
#   scripts/tab-deploy.sh            deploy once if there is a new commit
#   scripts/tab-deploy.sh watch [s]  check every s seconds (default 60), forever
#   scripts/tab-deploy.sh restart    restart the server without pulling
#   scripts/tab-deploy.sh stop       stop the server
#   scripts/tab-deploy.sh status     show deployed commit and whether it runs
#
# Settings (environment variables, all optional):
#   DEPLOY_BRANCH   branch to deploy from        (default v2-deploy)
#   DEPLOY_REMOTE   git remote                   (default origin)
#   APP_NAME        pm2 process name             (default talkify)
#   HEALTH_TIMEOUT  seconds to wait for the app  (default 90)
#   PORT            port to health-check         (default: PORT in .env, else 5001)
#   RESTART_CMD     shell command that (re)starts the server. Set it when
#                   something else already supervises the app (a tmux
#                   watchdog, systemd, ...): the script then only runs this to
#                   restart, never starts its own copy, and leaves crash
#                   recovery to that supervisor.
#   POST_INSTALL    shell command run after every `npm ci` of the server, for
#                   host-only packages that `npm ci` removes again.
#
# Settings can also go in .deploy/env (sourced, gitignored), which keeps them
# with the checkout instead of in whatever starts `watch`.
#
# The server runs under pm2 when it is installed (npm install -g pm2), which
# also restarts it if it crashes. Without pm2 it runs in the background with a
# pid file, and `watch` restarts it if it has died.
#
# See docs/TAB-DEPLOY.md for the one-time tablet setup.

set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR" || exit 1

DEPLOY_BRANCH="${DEPLOY_BRANCH:-v2-deploy}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
APP_NAME="${APP_NAME:-talkify}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

STATE_DIR="$REPO_DIR/.deploy"
LOG_DIR="$REPO_DIR/logs"
PID_FILE="$STATE_DIR/$APP_NAME.pid"
FAILED_FILE="$STATE_DIR/failed-sha"
LOCK_DIR="$STATE_DIR/lock"
DEPLOY_LOG="$LOG_DIR/deploy.log"
APP_LOG="$LOG_DIR/$APP_NAME.log"

mkdir -p "$STATE_DIR" "$LOG_DIR"

# shellcheck source=/dev/null
[ -f "$STATE_DIR/env" ] && . "$STATE_DIR/env"
RESTART_CMD="${RESTART_CMD:-}"
POST_INSTALL="${POST_INSTALL:-}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$DEPLOY_LOG"
}

app_port() {
  if [ -n "${PORT:-}" ]; then
    echo "$PORT"
    return
  fi
  local port=""
  if [ -f .env ]; then
    port="$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' .env | tail -n 1 | tr -d "\"'\r ")"
  fi
  echo "${port:-5001}"
}

# True when an outside supervisor owns the server process (see RESTART_CMD).
supervised() {
  [ -n "$RESTART_CMD" ]
}

have_pm2() {
  command -v pm2 >/dev/null 2>&1
}

# --- process control --------------------------------------------------------

# True if the pid file names a live process that is our server. Checking the
# command line guards against a stale pid reused by another process after a
# reboot.
pid_running() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE")"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
  if [ -r "/proc/$pid/cmdline" ]; then
    tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q "backend/server.js"
  fi
}

is_running() {
  if supervised; then
    http_ok
  elif have_pm2; then
    pm2 describe "$APP_NAME" 2>/dev/null | grep -q "status.*online"
  else
    pid_running
  fi
}

stop_app() {
  if supervised; then
    log "the server is managed by RESTART_CMD's supervisor; stop it there"
    return 1
  fi
  if have_pm2; then
    pm2 stop "$APP_NAME" >/dev/null 2>&1
    return 0
  fi
  pid_running || {
    rm -f "$PID_FILE"
    return 0
  }
  local pid _
  pid="$(cat "$PID_FILE")"
  kill -TERM "$pid" 2>/dev/null
  # server.js forces its own exit after 10s; give it a little longer.
  for _ in $(seq 1 15); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null
  rm -f "$PID_FILE"
}

start_app() {
  if supervised; then
    bash -c "$RESTART_CMD"
    return
  fi
  if have_pm2; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME" --update-env >/dev/null || return 1
    else
      pm2 start backend/server.js --name "$APP_NAME" --cwd "$REPO_DIR" >/dev/null || return 1
    fi
    pm2 save >/dev/null 2>&1
    return 0
  fi
  stop_app
  # Started from the repo root so dotenv finds .env. `set -m` gives the server
  # its own process group, so Ctrl+C on `watch` does not take it down too.
  (
    set -m
    nohup node backend/server.js >>"$APP_LOG" 2>&1 &
    echo $! >"$PID_FILE"
  )
}

# Waits until the server answers HTTP. It only starts listening after MongoDB
# connects, so any response below 500 means it is fully up.
http_ok() {
  node -e 'fetch(process.argv[1]).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))' \
    "http://127.0.0.1:$(app_port)/"
}

wait_healthy() {
  local waited=0
  # Give a restart a moment to take the old process down, so a server that is
  # still on its way out does not count as the new one answering.
  sleep 3
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if http_ok; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

restart_app() {
  log "restarting $APP_NAME"
  start_app || return 1
  if wait_healthy; then
    log "$APP_NAME is up on port $(app_port)"
    return 0
  fi
  log "ERROR: $APP_NAME did not answer within ${HEALTH_TIMEOUT}s (see $APP_LOG or 'pm2 logs $APP_NAME')"
  return 1
}

# --- build --------------------------------------------------------------------

# Installs and builds whatever the change from $1 to $2 needs. With an empty $1
# (first deploy) everything is installed and built.
build() {
  local from="$1" to="$2" changed=""
  if [ -n "$from" ]; then
    changed="$(git diff --name-only "$from" "$to")"
  fi

  if [ -z "$from" ] || [ ! -d node_modules ] || grep -qE '^package(-lock)?\.json$' <<<"$changed"; then
    log "installing server dependencies"
    npm ci --omit=dev --no-audit --no-fund || return 1
    if [ -n "$POST_INSTALL" ]; then
      log "running POST_INSTALL"
      bash -c "$POST_INSTALL" || return 1
    fi
  fi

  if [ -z "$from" ] || [ ! -d frontend/node_modules ] || grep -qE '^frontend/package(-lock)?\.json$' <<<"$changed"; then
    log "installing frontend dependencies"
    npm ci --prefix frontend --no-audit --no-fund || return 1
  fi

  if [ -z "$from" ] || [ ! -f frontend/dist/index.html ] || grep -q '^frontend/' <<<"$changed"; then
    log "building frontend"
    npm run build --prefix frontend || return 1
  fi
}

# --- deploy -------------------------------------------------------------------

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ >"$LOCK_DIR/pid"
    return 0
  fi
  # Clear a lock left behind by a run that was killed.
  local owner
  owner="$(cat "$LOCK_DIR/pid" 2>/dev/null)"
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then
    return 1
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null && echo $$ >"$LOCK_DIR/pid"
}

release_lock() {
  [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK_DIR"
}

deploy_once() {
  if ! git fetch --quiet "$DEPLOY_REMOTE" "$DEPLOY_BRANCH" 2>>"$DEPLOY_LOG"; then
    log "could not fetch $DEPLOY_REMOTE/$DEPLOY_BRANCH (offline, or CI has not promoted a commit yet)"
    supervised || is_running || restart_app
    return 0
  fi

  local current target short
  current="$(git rev-parse HEAD)"
  target="$(git rev-parse FETCH_HEAD)"
  short="$(git rev-parse --short "$target")"

  if [ "$current" = "$target" ] || [ "$target" = "$(cat "$FAILED_FILE" 2>/dev/null)" ]; then
    # Nothing new to deploy (or the new commit already failed once): just make
    # sure the server is still running, unless a supervisor already does that.
    if ! supervised && ! is_running; then
      log "$APP_NAME is not running, starting it"
      [ -f frontend/dist/index.html ] || build "" HEAD || return 1
      restart_app
    fi
    return 0
  fi

  if ! git diff --quiet HEAD --; then
    log "ERROR: the tablet checkout has local changes, refusing to deploy $short."
    log "       Run 'git status' in $REPO_DIR, then 'git stash' or 'git checkout -- <file>'."
    return 1
  fi

  if ! git merge-base --is-ancestor "$current" "$target"; then
    log "ERROR: $short is not a fast-forward of the tablet's commit (history was rewritten,"
    log "       or the tablet has its own commits). To take the remote version as-is:"
    log "       git -C $REPO_DIR reset --hard $DEPLOY_REMOTE/$DEPLOY_BRANCH"
    return 1
  fi

  log "deploying $short: $(git log -1 --format=%s "$target")"
  git merge --ff-only --quiet "$target" || return 1

  if build "$current" "$target" && restart_app; then
    rm -f "$FAILED_FILE"
    log "deployed $short"
    return 0
  fi

  log "ERROR: deploy of $short failed, rolling back to $(git rev-parse --short "$current")"
  echo "$target" >"$FAILED_FILE"
  git reset --hard --quiet "$current"
  if build "$target" "$current" && restart_app; then
    log "rolled back; $short will be skipped until a newer commit passes CI"
  else
    log "ERROR: rollback failed too; the app may be down. Check $APP_LOG"
  fi
  return 1
}

locked() {
  if ! acquire_lock; then
    log "another deploy is already running"
    return 0
  fi
  "$@"
  local status=$?
  release_lock
  return $status
}

watch() {
  local interval="${1:-60}"
  # On Termux, keep Android from suspending the process while the screen is off.
  command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
  trap 'release_lock; exit 0' INT TERM
  log "watching $DEPLOY_REMOTE/$DEPLOY_BRANCH every ${interval}s"
  while true; do
    locked deploy_once
    sleep "$interval"
  done
}

status() {
  echo "deployed commit: $(git log -1 --format='%h %s (%cr)')"
  if [ -f "$FAILED_FILE" ]; then
    echo "skipping failed:  $(git log -1 --format='%h %s' "$(cat "$FAILED_FILE")" 2>/dev/null || cat "$FAILED_FILE")"
  fi
  if is_running; then
    echo "server:          running on port $(app_port)"
  else
    echo "server:          NOT running"
  fi
}

case "${1:-once}" in
  once) locked deploy_once ;;
  watch) watch "${2:-60}" ;;
  restart) locked restart_app ;;
  stop) stop_app && log "stopped $APP_NAME" ;;
  status) status ;;
  *)
    sed -n '/^# Usage/,/^# Settings/p' "$0" | sed '$d; s/^# \{0,1\}//'
    exit 2
    ;;
esac
