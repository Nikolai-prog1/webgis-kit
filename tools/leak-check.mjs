import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = process.cwd();
const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
const patterns = [
  [
    'private-address',
    /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/gi,
  ],
  ['personal-path', /(?:[A-Z]:[\\/]Users[\\/][^\s"']+|\/home\/[^\s/"']+\/)/gi],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  [
    'credential',
    /\b(?:pass(?:word|wd)|secret|token|api[_-]?key)\b\s*["']?\s*[:=]\s*["'](?!["']|\$\{|<|\*|\s*\})[^"'\n]+["']/gi,
  ],
];
let privateRules = 0;
const local = path.join(root, '.leakcheck.local');
const denyPath =
  process.env.LEAKCHECK_DENYLIST ||
  (fs.existsSync(local) ? fs.readFileSync(local, 'utf8').trim() : '');
if (denyPath) {
  const lines = fs
    .readFileSync(denyPath, 'utf8')
    .split(/\r?\n/)
    .filter((x) => x && !x.startsWith('#'));
  for (const [i, line] of lines.entries())
    patterns.push([`private-rule-${i + 1}`, new RegExp(line, 'gi')]);
  privateRules = lines.length;
}
const findings = [];
// Required contact retained verbatim in the upstream quick-lru MIT notice,
// plus GitHub's own service addresses, which appear in commits that GitHub
// and its bots create (e.g. "Signed-off-by: dependabot[bot] <support@github.com>").
const allowedEmails = new Set([
  'sindresorhus@gmail.com',
  'support@github.com',
  'noreply@github.com',
]);
function scan(text, name) {
  if (name === 'history') text = text.replace(/^[+-](?![+-])/gm, '');
  // This is an ignored local settings filename, not a host.
  text = text.replaceAll('.leakcheck.local', '[local settings]');
  let hostText = text;
  if (/\.[cm]?js$/i.test(name)) {
    const parts = [];
    const source = ts.createSourceFile(
      name,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function visit(node) {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      )
        parts.push(node.getText(source));
      for (const range of [
        ...(ts.getLeadingCommentRanges(text, node.pos) || []),
        ...(ts.getTrailingCommentRanges(text, node.end) || []),
      ])
        parts.push(text.slice(range.pos, range.end));
      ts.forEachChild(node, visit);
    }
    visit(source);
    hostText = parts.join('\n');
  }
  if (
    /\b[a-z\d][a-z\d.-]*\.(?:local|lan|internal|corp|intra)\b/i.test(hostText)
  )
    findings.push(`${name}: private-host`);
  for (const [label, re] of patterns) {
    re.lastIndex = 0;
    if (re.test(text)) findings.push(`${name}: ${label}`);
  }
  const emails =
    text.match(/[A-Z\d.!#$%&'*+/=?^_`{|}~-]+@[A-Z\d.-]+\.[A-Z]{2,}/gi) || [];
  for (const original of emails) {
    const email = original.replace(/^'+/, '').toLowerCase();
    if (!/^[^@]+@/.test(email)) continue;
    if (
      !/^[^@]+@users\.noreply\.github\.com$|^noreply@anthropic\.com$/i.test(
        email,
      ) &&
      !allowedEmails.has(email.toLowerCase())
    )
      findings.push(`${name}: email`);
  }
}
const files = git('ls-files', '-z').split('\0').filter(Boolean);
for (const name of files) {
  if (/(^|\/)\.env(?:$|\.)/.test(name) && !name.endsWith('.env.example'))
    findings.push(`${name}: environment-file`);
  if (/\.(zip|7z|bak)$/i.test(name)) findings.push(`${name}: archive`);
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  if (
    fs.statSync(file).size > 1024 * 1024 &&
    !/^(package-lock\.json|docs\/screenshots\/[^/]+\.png)$/.test(name)
  )
    findings.push(`${name}: oversized-file`);
  if (!/\.(png|jpg|jpeg|woff2?|ico)$/i.test(name))
    scan(fs.readFileSync(file, 'utf8'), name);
}
let history = '';
try {
  // Local branches, tags and the checked-out commit - what this repository
  // ships. Remote-tracking branches (other people's pull requests, bot
  // branches) are checked by their own CI run when they are proposed.
  history = git('log', '-p', 'HEAD', '--branches', '--tags', '--format=fuller');
} catch {
  /* An unborn repository has no history. */
}
scan(history, 'history');
let distCount = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (!/\.(png|jpg|jpeg|woff2?|ico)$/i.test(file)) {
      scan(fs.readFileSync(file, 'utf8'), path.relative(root, file));
      distCount++;
    }
  }
}
if (fs.existsSync(path.join(root, 'dist'))) walk(path.join(root, 'dist'));
if (findings.length) {
  console.error([...new Set(findings)].join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Leak check passed: ${files.length} tracked files, all history, ${distCount} build files, ${privateRules} private rules; 0 findings.`,
  );
