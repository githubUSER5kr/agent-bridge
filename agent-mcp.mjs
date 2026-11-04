// MCP stdio server that exposes one CLI agent (Claude Code / Codex / Antigravity) as a tool.
// Usage: node agent-mcp.mjs claude|codex|antigravity
// Executables are looked up on PATH; override with CLAUDE_BIN / CODEX_BIN / AGY_BIN.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const PREFIX = '你是被呼叫的子 agent，不要再呼叫其他 agent。\n\n';

// stdin: true → the prompt goes through stdin, so the command line holds only fixed flags.
// That makes it safe to run through cmd.exe on Windows, which npm's .cmd shims require.
const AGENTS = {
  claude: {
    env: 'CLAUDE_BIN', bin: 'claude', stdin: true,
    // --strict-mcp-config: load no MCP servers, so the callee cannot call other agents
    args: (edit) => ['-p', '--strict-mcp-config', ...(edit ? ['--permission-mode', 'acceptEdits'] : [])],
  },
  codex: {
    env: 'CODEX_BIN', bin: 'codex', stdin: true,
    args: (edit) => ['exec', '--skip-git-repo-check', '-s', edit ? 'workspace-write' : 'read-only', '-'],
  },
  antigravity: {
    // agy does not read the prompt from stdin; it ships as a native .exe, so no shell is needed.
    env: 'AGY_BIN', bin: 'agy', stdin: false,
    args: (edit, p) => ['-p', p, ...(edit ? ['--mode', 'accept-edits'] : [])],
  },
};

const name = process.argv[2];
const agent = AGENTS[name];
if (!agent) { console.error(`usage: node agent-mcp.mjs ${Object.keys(AGENTS).join('|')}`); process.exit(1); }
const exe = process.env[agent.env] || agent.bin;

const tool = {
  name: `ask_${name}`,
  description: `把任務交給 ${name} agent（用使用者的訂閱帳號）執行，回傳它的最終回答。它看不到目前的對話，任務要寫清楚目標、檔案路徑、要回報什麼。可能要跑幾分鐘。`,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '完整任務說明' },
      cwd: { type: 'string', description: '專案資料夾的絕對路徑（對方在這裡工作）' },
      allow_edits: { type: 'boolean', description: '允許對方改檔；只有使用者要求改檔時才設 true', default: false },
    },
    required: ['prompt', 'cwd'],
  },
};

const HINT = `請確認 ${name} 已安裝並登入，或用環境變數 ${agent.env} 指定執行檔完整路徑。`;

function run({ prompt, cwd, allow_edits }) {
  return new Promise((resolve) => {
    const full = PREFIX + prompt;
    const args = agent.args(!!allow_edits, full);
    const opts = { cwd, windowsHide: true, stdio: [agent.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] };
    let child;
    try {
      child = process.platform === 'win32' && agent.stdin
        ? spawn(`"${exe}" ${args.join(' ')}`, { ...opts, shell: true }) // finds .exe and .cmd alike
        : spawn(exe, args, opts); // no shell: the prompt argument is never interpreted
    } catch (e) {
      return resolve({ text: `無法啟動 ${name}（${exe}）：${e.message}\n${HINT}`, isError: true });
    }
    if (agent.stdin) child.stdin.end(full);
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => resolve({ text: `無法啟動 ${name}（${exe}）：${e.message}\n${HINT}`, isError: true }));
    child.on('close', (code) => resolve(code === 0
      ? { text: out.trim() || err.trim(), isError: false }
      : { text: `${name} 結束碼 ${code}\n${(out + '\n' + err).trim().slice(-4000)}\n${HINT}`, isError: true }));
  });
}

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

createInterface({ input: process.stdin }).on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  if (id === undefined) return; // notification
  if (method === 'initialize') {
    send({ id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: `agent-${name}`, version: '1.0.0' } } });
  } else if (method === 'tools/list') {
    send({ id, result: { tools: [tool] } });
  } else if (method === 'tools/call') {
    if (params?.name !== tool.name) return send({ id, error: { code: -32602, message: `unknown tool ${params?.name}` } });
    const { text, isError } = await run(params.arguments ?? {});
    send({ id, result: { content: [{ type: 'text', text }], isError } });
  } else if (method === 'ping') {
    send({ id, result: {} });
  } else {
    send({ id, error: { code: -32601, message: `method not found: ${method}` } });
  }
});
