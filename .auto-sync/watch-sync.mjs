#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(REPO_ROOT, 'scholarshield-hub-main');
const SYNC_DIR = __dirname;
const LOG_FILE = path.join(SYNC_DIR, 'sync.log');
const PID_FILE = path.join(SYNC_DIR, 'sync.pid');
const LOCK_FILE = path.join(SYNC_DIR, 'sync.lock');
const STATUS_FILE = path.join(SYNC_DIR, 'sync-status.json');

const GIT_BIN = fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe')
  ? 'C:\\Program Files\\Git\\cmd\\git.exe'
  : 'git';
const NPM_CMD = fs.existsSync('C:\\Program Files\\nodejs\\npm.cmd')
  ? 'C:\\Program Files\\nodejs\\npm.cmd'
  : 'npm.cmd';

const DEFAULT_QUIET_MS = 60_000;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

const IGNORED_DIR_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '.output',
  '.vercel',
  '.nitro',
  '.wrangler',
  '.tanstack',
  'dist',
  'dist-ssr',
  '.turbo',
]);

const FORBIDDEN_FILE_PATTERNS = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)[^/]+\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|crt|cer|jks|keystore)$/i,
  /(^|\/)(id_rsa|id_ed25519|id_dsa)(\.pub)?$/i,
  /(^|\/).*service[-_]?role.*\.(json|txt|env|ya?ml)$/i,
  /(^|\/)\.dev\.vars(\..*)?$/i,
];

const SECRET_LINE_PATTERNS = [
  {
    name: 'Supabase service-role literal',
    regex:
      /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"`]?(eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|[A-Za-z0-9._-]{25,})['"`]?/i,
  },
  {
    name: 'Supabase secret key (sb_secret_)',
    regex: /\bsb_secret_[A-Za-z0-9_-]{12,}\b/,
  },
  {
    name: 'Private key block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
  },
  {
    name: 'GitHub / Cloud / API token literal',
    regex:
      /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|sk_live_[0-9a-zA-Z]{16,}|xox[baprs]-[0-9a-zA-Z-]{10,})\b/,
  },
  {
    name: 'Database URI with embedded password',
    regex:
      /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/'"`]+:[^@\s'"`]{6,}@[^\s'"`]+/i,
  },
];

function parseArgs(argv) {
  const opts = {
    once: false,
    dryRun: false,
    quietMs: DEFAULT_QUIET_MS,
    branch: 'main',
    quietConsole: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--once') opts.once = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--silent') opts.quietConsole = true;
    else if (arg === '--quiet-ms' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed >= 1000) {
        opts.quietMs = parsed;
      }
    } else if (arg === '--branch' && argv[i + 1]) {
      opts.branch = argv[++i];
    }
  }
  return opts;
}

const OPTIONS = parseArgs(process.argv.slice(2));

function formatLocalTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function rotateLogIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size >= MAX_LOG_BYTES) {
      const archive = path.join(SYNC_DIR, 'sync.log.old');
      fs.renameSync(LOG_FILE, archive);
    }
  } catch {
    // Ignore when log file does not exist yet
  }
}

function log(level, message) {
  const line = `[${formatLocalTimestamp()}] [${level}] ${message}`;
  rotateLogIfNeeded();
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  } catch {
    // Best-effort file logging
  }
  if (!OPTIONS.quietConsole) {
    if (level === 'ERROR') console.error(line);
    else console.log(line);
  }
}

function writeStatus(state) {
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      localTime: formatLocalTimestamp(),
      pid: process.pid,
      branch: OPTIONS.branch,
      quietPeriodSeconds: Math.round(OPTIONS.quietMs / 1000),
      ...state,
    };
    fs.writeFileSync(STATUS_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch {
    // Best-effort status output
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireExclusiveLock() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n`, 'utf8');
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        try {
          const holderPid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
          if (holderPid !== process.pid && !isPidAlive(holderPid)) {
            fs.unlinkSync(LOCK_FILE);
            continue;
          }
        } catch {
          // Lock disappeared or unreadable
        }
        return false;
      }
      throw err;
    }
  }
  return false;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const holder = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
      if (!holder || holder === process.pid) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

function normalizeRelPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
}

function isForbiddenFilePath(relPath) {
  const normalized = normalizeRelPath(relPath);
  return FORBIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shouldIgnoreWatchEvent(relPath) {
  const normalized = normalizeRelPath(relPath);
  if (!normalized) return true;

  const segments = normalized.split('/');
  if (segments.some((seg) => IGNORED_DIR_SEGMENTS.has(seg))) return true;

  if (
    normalized === '.' ||
    normalized === '.auto-sync' ||
    normalized === '.auto-sync/sync.log' ||
    normalized === '.auto-sync/sync.log.old' ||
    normalized === '.auto-sync/sync.pid' ||
    normalized === '.auto-sync/sync.lock' ||
    normalized === '.auto-sync/sync-status.json'
  ) {
    return true;
  }

  try {
    if (fs.statSync(path.join(REPO_ROOT, normalized)).isDirectory()) {
      return true;
    }
  } catch {
    // Deleted path or transient event: continue file-level filtering
  }

  if (isForbiddenFilePath(normalized)) return true;

  if (/(^|\/)(~[^/]+|.*\.tmp|.*\.swp|.*\.swx|.*\.crdownload)$/i.test(normalized)) {
    return true;
  }

  return false;
}

function runGit(args, { cwd = REPO_ROOT, allowFailure = false } = {}) {
  const res = spawnSync(GIT_BIN, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
    maxBuffer: 25 * 1024 * 1024,
  });

  if (res.status !== 0 && !allowFailure) {
    const detail = (res.stderr || res.stdout || res.error?.message || 'Unknown git error').trim();
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
  return res;
}

function runBuildCheck() {
  log('INFO', 'Running production build check (vite build with Vercel preset)...');
  const res = spawnSync('cmd.exe', ['/d', '/c', NPM_CMD, 'run', 'build'], {
    cwd: APP_DIR,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      VERCEL: '1',
      CI: '1',
    },
    maxBuffer: 25 * 1024 * 1024,
  });

  if (res.status !== 0) {
    const output = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
    const tail = output.split(/\r?\n/).slice(-25).join('\n');
    return { ok: false, tail };
  }
  return { ok: true };
}

function getGitOperationInProgress() {
  const gitDir = path.join(REPO_ROOT, '.git');
  const markers = [
    'MERGE_HEAD',
    'REBASE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'BISECT_LOG',
    'rebase-merge',
    'rebase-apply',
  ];
  return markers.filter((m) => fs.existsSync(path.join(gitDir, m)));
}

function parsePorcelainStatus() {
  const out = runGit(['status', '--porcelain=v1', '-z', '-uall']).stdout || '';
  const entries = [];
  const tokens = out.split('\0').filter(Boolean);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const xy = token.slice(0, 2);
    const filePath = token.slice(3);
    if (xy[0] === 'R' || xy[0] === 'C') {
      const origPath = tokens[++i];
      entries.push({ xy, path: normalizeRelPath(filePath), origPath: normalizeRelPath(origPath) });
    } else {
      entries.push({ xy, path: normalizeRelPath(filePath) });
    }
  }
  return entries;
}

function scanAddedTextForSecrets(text, sourceLabel) {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    for (const rule of SECRET_LINE_PATTERNS) {
      if (rule.regex.test(line)) {
        findings.push(`${rule.name} in ${sourceLabel}`);
        break;
      }
    }
  }
  return findings;
}

function scanWorkingTreeForSecrets(entries) {
  const findings = [];

  for (const entry of entries) {
    if (isForbiddenFilePath(entry.path)) {
      findings.push(`Forbidden secret/env file path detected: ${entry.path}`);
    }
    if (entry.origPath && isForbiddenFilePath(entry.origPath)) {
      findings.push(`Forbidden secret/env file path detected: ${entry.origPath}`);
    }
  }

  // Check tracked unstaged + staged added lines
  for (const diffArgs of [
    ['diff', '-U0', '--no-color'],
    ['diff', '--cached', '-U0', '--no-color'],
  ]) {
    const diffOut = runGit(diffArgs, { allowFailure: true }).stdout || '';
    let currentFile = '(diff)';
    for (const line of diffOut.split(/\r?\n/)) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.slice(6);
        continue;
      }
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      findings.push(...scanAddedTextForSecrets(line.slice(1), currentFile));
    }
  }

  // Check untracked safe-sized text files before git add
  for (const entry of entries) {
    if (entry.xy !== '??') continue;
    const abs = path.join(REPO_ROOT, entry.path);
    try {
      const stat = fs.statSync(abs);
      if (!stat.isFile() || stat.size > 1024 * 1024) continue;
      const buf = fs.readFileSync(abs);
      if (buf.includes(0)) continue; // skip binary files
      findings.push(...scanAddedTextForSecrets(buf.toString('utf8'), entry.path));
    } catch {
      // Ignore unreadable transient paths
    }
  }

  return [...new Set(findings)];
}

function scanStagedDiffForSecrets() {
  const findings = [];
  const stagedNamesOut = runGit(['diff', '--cached', '--name-only', '-z']).stdout || '';
  const stagedFiles = stagedNamesOut.split('\0').filter(Boolean).map(normalizeRelPath);

  for (const f of stagedFiles) {
    if (isForbiddenFilePath(f)) {
      findings.push(`Forbidden file staged: ${f}`);
    }
  }

  const diffOut = runGit(['diff', '--cached', '-U0', '--no-color']).stdout || '';
  let currentFile = '(staged)';
  for (const line of diffOut.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    findings.push(...scanAddedTextForSecrets(line.slice(1), currentFile));
  }

  return [...new Set(findings)];
}

function getAheadBehind() {
  const res = runGit(['rev-list', '--left-right', '--count', `HEAD...origin/${OPTIONS.branch}`], {
    allowFailure: true,
  });
  if (res.status !== 0) {
    return { known: false, ahead: 0, behind: 0 };
  }
  const [aheadStr, behindStr] = (res.stdout || '').trim().split(/\s+/);
  return {
    known: true,
    ahead: Number(aheadStr || 0),
    behind: Number(behindStr || 0),
  };
}

function hasMergeTreeConflict() {
  const res = runGit(['merge-tree', '--write-tree', 'HEAD', `origin/${OPTIONS.branch}`], {
    allowFailure: true,
  });
  if (res.status !== 0) {
    return {
      conflict: true,
      detail: (res.stdout || res.stderr || 'merge-tree conflict').trim(),
    };
  }
  return { conflict: false };
}

async function syncOnce() {
  if (!acquireExclusiveLock()) {
    log('WARN', 'Another sync cycle is already in progress; skipping duplicate trigger.');
    return { status: 'skipped-locked' };
  }

  try {
    // 1. Verify branch & clean Git state
    const currentBranch = (runGit(['branch', '--show-current']).stdout || '').trim();
    if (currentBranch !== OPTIONS.branch) {
      const msg = `Active branch is "${currentBranch || '(detached)'}", expected "${OPTIONS.branch}". Skipping auto-sync.`;
      log('WARN', msg);
      writeStatus({ state: 'paused', reason: msg });
      return { status: 'paused-wrong-branch' };
    }

    const activeOps = getGitOperationInProgress();
    if (activeOps.length > 0) {
      const msg = `Git operation in progress (${activeOps.join(', ')}). Resolve manually before auto-sync resumes.`;
      log('ERROR', msg);
      writeStatus({ state: 'paused', reason: msg });
      return { status: 'paused-git-op' };
    }

    const unmerged = (runGit(['diff', '--name-only', '--diff-filter=U']).stdout || '').trim();
    if (unmerged) {
      const msg = `Unresolved merge conflicts detected:\n${unmerged}`;
      log('ERROR', msg);
      writeStatus({ state: 'paused-conflict', reason: msg });
      return { status: 'paused-conflict' };
    }

    // 2. Inspect working tree changes
    const entries = parsePorcelainStatus();
    if (entries.length === 0) {
      // Check if an earlier verified local commit still needs pushing
      const fetchOnly = runGit(['fetch', 'origin', OPTIONS.branch], { allowFailure: true });
      if (fetchOnly.status !== 0) {
        log('INFO', 'No working tree changes (remote check skipped: offline or auth pending).');
        writeStatus({ state: 'idle', note: 'No changes to sync' });
        return { status: 'no-changes' };
      }
      const { known, ahead, behind } = getAheadBehind();
      if (!known || ahead === 0) {
        log('INFO', 'No actual changes to commit or push.');
        writeStatus({ state: 'idle', note: 'Clean working tree' });
        return { status: 'no-changes' };
      }

      if (behind > 0) {
        const treeCheck = hasMergeTreeConflict();
        if (treeCheck.conflict) {
          const msg = `Merge conflict detected with origin/${OPTIONS.branch}; stopped safely without force-pushing.`;
          log('ERROR', msg);
          writeStatus({ state: 'paused-conflict', reason: msg });
          return { status: 'paused-conflict' };
        }
        if (!OPTIONS.dryRun) {
          runGit(['-c', 'pull.rebase=false', 'merge', '--no-edit', `origin/${OPTIONS.branch}`]);
        }
      }

      if (OPTIONS.dryRun) {
        log('INFO', `[dry-run] Would push ${ahead} existing unpushed commit(s) to origin/${OPTIONS.branch}.`);
        return { status: 'dry-run-ok' };
      }

      runGit(['push', 'origin', OPTIONS.branch]);
      const headSha = (runGit(['rev-parse', '--short', 'HEAD']).stdout || '').trim();
      log('INFO', `Pushed ${ahead} existing commit(s) to origin/${OPTIONS.branch} (HEAD ${headSha}).`);
      writeStatus({ state: 'synced', lastCommit: headSha });
      return { status: 'pushed', commit: headSha };
    }

    // 3. Secret & .env safety guard before anything else
    const preFindings = scanWorkingTreeForSecrets(entries);
    if (preFindings.length > 0) {
      const msg = `Blocked sync for security: ${preFindings.join('; ')}`;
      log('ERROR', msg);
      writeStatus({ state: 'blocked-secret', reason: msg });
      return { status: 'blocked-secret', findings: preFindings };
    }

    // 4. Remote fetch & pre-build conflict check
    log('INFO', `Fetching origin/${OPTIONS.branch} to check remote status...`);
    const fetchRes = runGit(['fetch', 'origin', OPTIONS.branch], { allowFailure: true });
    if (fetchRes.status !== 0) {
      const errDetail = (fetchRes.stderr || fetchRes.stdout || 'fetch failed').trim();
      log('ERROR', `Git fetch failed (${errDetail}). Leaving working tree untouched.`);
      writeStatus({ state: 'error', reason: errDetail });
      return { status: 'fetch-failed', error: errDetail };
    }

    const preDivergence = getAheadBehind();
    if (preDivergence.known && preDivergence.behind > 0) {
      const upstreamFiles = new Set(
        (runGit(['diff', '--name-only', `HEAD...origin/${OPTIONS.branch}`]).stdout || '')
          .split(/\r?\n/)
          .filter(Boolean)
          .map(normalizeRelPath),
      );
      const overlapping = entries
        .map((e) => e.path)
        .filter((p) => upstreamFiles.has(p));

      if (overlapping.length > 0) {
        const msg = `Potential merge conflict: origin/${OPTIONS.branch} also modified ${overlapping.join(', ')}. Sync stopped without overwriting changes.`;
        log('ERROR', msg);
        writeStatus({ state: 'paused-conflict', reason: msg });
        return { status: 'paused-conflict', overlapping };
      }

      if (preDivergence.ahead === 0 && !OPTIONS.dryRun) {
        log('INFO', `Fast-forwarding local ${OPTIONS.branch} safely (${preDivergence.behind} upstream commit(s), no overlapping files)...`);
        runGit(['merge', '--ff-only', `origin/${OPTIONS.branch}`]);
      }
    }

    // 5. Production build gate
    const build = runBuildCheck();
    if (!build.ok) {
      const msg = `Production build check failed; commit & push skipped.\n${build.tail}`;
      log('ERROR', msg);
      writeStatus({ state: 'build-failed', reason: build.tail });
      return { status: 'build-failed' };
    }
    log('INFO', 'Production build check passed.');

    if (OPTIONS.dryRun) {
      log(
        'INFO',
        `[dry-run] Pre-flight checks & build passed for ${entries.length} changed file(s). Would stage, commit, and push to origin/${OPTIONS.branch}.`,
      );
      writeStatus({ state: 'dry-run-ok', changedCount: entries.length });
      return { status: 'dry-run-ok', changedCount: entries.length };
    }

    // 6. Stage safe changes (never force, never reset)
    runGit(['add', '-A']);

    const stagedSecretFindings = scanStagedDiffForSecrets();
    if (stagedSecretFindings.length > 0) {
      runGit(['restore', '--staged', '.'], { allowFailure: true });
      const msg = `Blocked sync after staging: ${stagedSecretFindings.join('; ')}`;
      log('ERROR', msg);
      writeStatus({ state: 'blocked-secret', reason: msg });
      return { status: 'blocked-secret', findings: stagedSecretFindings };
    }

    const quietCheck = runGit(['diff', '--cached', '--quiet'], { allowFailure: true });
    if (quietCheck.status === 0) {
      log('INFO', 'Nothing staged after applying ignore rules; skipping empty commit.');
      writeStatus({ state: 'idle', note: 'No staged changes' });
      return { status: 'no-changes' };
    }

    const stagedCount = (runGit(['diff', '--cached', '--name-only']).stdout || '')
      .split(/\r?\n/)
      .filter(Boolean).length;

    // 7. Commit locally
    const commitMsg = `Auto-sync ScholarShield (${formatLocalTimestamp()}) [${stagedCount} file${
      stagedCount === 1 ? '' : 's'
    }]`;
    runGit(['commit', '-m', commitMsg]);
    const localSha = (runGit(['rev-parse', '--short', 'HEAD']).stdout || '').trim();
    log('INFO', `Created local commit ${localSha}: "${commitMsg}"`);

    // 8. Re-check origin/main before pushing cleanly
    runGit(['fetch', 'origin', OPTIONS.branch]);
    const postDivergence = getAheadBehind();
    if (postDivergence.known && postDivergence.behind > 0) {
      const treeCheck = hasMergeTreeConflict();
      if (treeCheck.conflict) {
        const msg = `Merge conflict detected with origin/${OPTIONS.branch} after commit ${localSha}. Stopped without pushing or resetting; please resolve manually.`;
        log('ERROR', msg);
        writeStatus({ state: 'paused-conflict', reason: msg, lastCommit: localSha });
        return { status: 'paused-conflict' };
      }
      log('INFO', `Merging ${postDivergence.behind} non-conflicting remote commit(s) cleanly...`);
      runGit(['-c', 'pull.rebase=false', 'merge', '--no-edit', `origin/${OPTIONS.branch}`]);
    }

    runGit(['push', 'origin', OPTIONS.branch]);
    const finalSha = (runGit(['rev-parse', '--short', 'HEAD']).stdout || '').trim();
    log('INFO', `Successfully pushed ${finalSha} to origin/${OPTIONS.branch}. Vercel Git integration will deploy automatically.`);
    writeStatus({ state: 'synced', lastCommit: finalSha, stagedCount });
    return { status: 'pushed', commit: finalSha, stagedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('ERROR', `Sync error: ${message}`);
    writeStatus({ state: 'error', reason: message });
    return { status: 'error', error: message };
  } finally {
    releaseLock();
  }
}

function ensureSingleWatcherInstance() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const existingPid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
      if (existingPid && existingPid !== process.pid && isPidAlive(existingPid)) {
        log('INFO', `Watcher already running (PID ${existingPid}). Exiting duplicate instance.`);
        return false;
      }
    } catch {
      // Stale PID file; overwrite cleanly
    }
  }
  fs.writeFileSync(PID_FILE, `${process.pid}\n`, 'utf8');
  return true;
}

function cleanupPidAndLock() {
  releaseLock();
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
      if (!pid || pid === process.pid) {
        fs.unlinkSync(PID_FILE);
      }
    }
  } catch {
    // Ignore
  }
}

async function startWatcher() {
  if (!ensureSingleWatcherInstance()) {
    process.exit(0);
  }

  let debounceTimer = null;
  let syncInProgress = false;
  let pendingResync = false;
  let lastNoticeAt = 0;

  const scheduleSync = (triggerFile) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const now = Date.now();
    if (now - lastNoticeAt >= 5000) {
      log(
        'INFO',
        `Detected save (${triggerFile}); waiting ${Math.round(
          OPTIONS.quietMs / 1000,
        )}s with no further edits before syncing...`,
      );
      lastNoticeAt = now;
    }
    writeStatus({
      state: 'waiting-quiet-period',
      lastTriggerFile: triggerFile,
      scheduledSyncAt: new Date(now + OPTIONS.quietMs).toISOString(),
    });

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      if (syncInProgress) {
        pendingResync = true;
        return;
      }
      syncInProgress = true;
      try {
        await syncOnce();
      } finally {
        syncInProgress = false;
        if (pendingResync) {
          pendingResync = false;
          scheduleSync('(edits saved during sync)');
        }
      }
    }, OPTIONS.quietMs);
  };

  log(
    'INFO',
    `ScholarShield Auto-Sync watcher started (PID ${process.pid}, quiet window ${Math.round(
      OPTIONS.quietMs / 1000,
    )}s, target origin/${OPTIONS.branch}).`,
  );
  writeStatus({ state: 'watching' });

  // Run one initial sync check at startup after quiet window only if working tree is already dirty
  const startupEntries = parsePorcelainStatus();
  if (startupEntries.length > 0) {
    scheduleSync(`startup check (${startupEntries[0].path})`);
  }

  const watcher = fs.watch(REPO_ROOT, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const rel = normalizeRelPath(filename.toString());
    if (shouldIgnoreWatchEvent(rel)) return;
    if (syncInProgress) {
      pendingResync = true;
      return;
    }
    scheduleSync(rel);
  });

  const shutdown = (signal) => {
    log('INFO', `Stopping Auto-Sync watcher (${signal})...`);
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
    writeStatus({ state: 'stopped', stoppedBy: signal });
    cleanupPidAndLock();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', cleanupPidAndLock);
}

if (OPTIONS.once) {
  const result = await syncOnce();
  if (
    result.status === 'build-failed' ||
    result.status === 'blocked-secret' ||
    result.status === 'paused-conflict' ||
    result.status === 'paused-git-op' ||
    result.status === 'paused-wrong-branch' ||
    result.status === 'fetch-failed' ||
    result.status === 'error'
  ) {
    process.exitCode = 1;
  }
} else {
  await startWatcher();
}

