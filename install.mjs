// One-step setup: node install.mjs
// Finds Claude Code / Codex / Antigravity, registers the others as MCP tools in each,
// and adds a short usage note to each one's global instructions. Safe to re-run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const win = process.platform === 'win32';
const home = homedir();
const slash = (p) => p.replaceAll('\\', '/');
const BRIDGE = slash(fileURLToPath(new URL('./agent-mcp.mjs', import.meta.url)));
const NODE = slash(process.execPath);
const CODEX_HOME = process.env.CODEX_HOME || join(home, '.codex');

const AGENTS = {
  claude: { label: 'Claude', bin: 'claude', env: 'CLAUDE_BIN', rules: join(home, '.claude', 'CLAUDE.md') },
  codex: { label: 'Codex', bin: 'codex', env: 'CODEX_BIN', rules: join(CODEX_HOME, 'AGENTS.md') },
  antigravity: {
    label: 'Antigravity', bin: 'agy', env: 'AGY_BIN', rules: join(home, '.gemini', 'GEMINI.md'),
    fallback: win ? join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe') : null,
  },
};

function find(a) {
  if (process.env[a.env]) return slash(process.env[a.env]);
  const r = spawnSync(win ? 'where' : 'which', [a.bin], { encoding: 'utf8' });
  const hits = r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
  const hit = win ? hits.find((h) => /\.(exe|cmd)$/i.test(h)) : hits[0];
  if (hit) return slash(hit);
  return a.fallback && existsSync(a.fallback) ? slash(a.fallback) : null;
}

// Runs a CLI with fixed arguments (our own paths only, never user text).
function run(exe, args) {
  const q = (s) => (/[\s"]/.test(s) ? `"${s}"` : s);
  const r = win && /\.(cmd|bat)$/i.test(exe)
    ? spawnSync(`"${exe}" ${args.map(q).join(' ')}`, { shell: true, encoding: 'utf8' })
    : spawnSync(exe, args, { encoding: 'utf8' });
  return r.status === 0;
}

// Codex's default MCP timeout is 60s, too short for an agent task.
function codexTimeout(name) {
  const f = join(CODEX_HOME, 'config.toml');
  const t = readFileSync(f, 'utf8');
  const header = `[mcp_servers.${name}]`;
  const i = t.indexOf(header);
  if (i < 0) return false;
  const end = t.indexOf('\n[', i + header.length);
  if (/^tool_timeout_sec\s*=/m.test(t.slice(i, end < 0 ? undefined : end))) return true;
  const at = i + header.length;
  writeFileSync(f, t.slice(0, at) + '\ntool_timeout_sec = 1800' + t.slice(at));
  return true;
}

const register = {
  claude: (exe, name, env) => {
    run(exe, ['mcp', 'remove', '-s', 'user', name]); // replace an older entry, if any
    return run(exe, ['mcp', 'add', '--scope', 'user', name, '-e', env, '--', NODE, BRIDGE, name]);
  },
  codex: (exe, name, env) => run(exe, ['mcp', 'add', name, '--env', env, '--', NODE, BRIDGE, name]) && codexTimeout(name),
  antigravity: (exe, name, env) => run(exe, ['mcp', 'add', '--env', env, name, NODE, BRIDGE, name]),
};

const START = '<!-- agent-bridge:start -->';
const END = '<!-- agent-bridge:end -->';

function writeRules(file, others) {
  const names = others.map((n) => AGENTS[n].label).join(' / ');
  const tools = others.map((n) => `\`ask_${n}\``).join(' / ');
  const block = `${START}
## 呼叫其他 AI agent

使用者說「叫 ${names} 做 X」或需要第二意見時，用 MCP 工具 ${tools}（用使用者的訂閱帳號）：

- \`prompt\`：完整任務。對方看不到這段對話，要寫清楚目標、檔案路徑、要回報什麼。
- \`cwd\`：專案資料夾的絕對路徑。
- \`allow_edits\`：預設 false；只有使用者要求改檔才設 true。

可能要跑幾分鐘，等它結束。把結果摘要給使用者，自己判斷對錯，不要照單全收。
${END}`;
  mkdirSync(dirname(file), { recursive: true });
  const old = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  writeFileSync(file, re.test(old) ? old.replace(re, () => block) : `${old.trimEnd()}${old.trim() ? '\n\n' : ''}${block}\n`);
}

console.log('尋找已安裝的工具…');
const found = {};
for (const [n, a] of Object.entries(AGENTS)) {
  found[n] = find(a);
  console.log(found[n] ? `  ✓ ${a.label}：${found[n]}` : `  - ${a.label}：沒找到（略過）`);
}
const ok = Object.keys(found).filter((n) => found[n]);
if (ok.length < 2) {
  console.log('\n至少要裝好兩個工具才能互相呼叫。裝好後再執行一次 node install.mjs。');
  process.exit(1);
}

let failed = false;
for (const caller of ok) {
  const others = ok.filter((n) => n !== caller);
  console.log(`\n設定 ${AGENTS[caller].label}：`);
  for (const callee of others) {
    const done = register[caller](found[caller], callee, `${AGENTS[callee].env}=${found[callee]}`);
    failed ||= !done;
    console.log(`  ${done ? '✓' : '✗'} 可以呼叫 ${AGENTS[callee].label}（ask_${callee}）`);
  }
  writeRules(AGENTS[caller].rules, others);
  console.log(`  ✓ 已寫入說明：${slash(AGENTS[caller].rules)}`);
}

console.log(failed
  ? '\n有項目失敗。請確認該工具已登入，再執行一次 node install.mjs。'
  : '\n完成！請把 APP 完全關閉再重新打開，開一個新對話後就能用了。\n（之後若移動或刪除這個資料夾，要重新執行 node install.mjs）');
process.exit(failed ? 1 : 0);
