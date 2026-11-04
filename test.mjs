// Self-check: node test.mjs            (protocol only, no model calls)
//             node test.mjs --live     (also asks each agent to reply OK)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const live = process.argv.includes('--live');

function session(agent, env = {}) {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./agent-mcp.mjs', import.meta.url)), agent], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  let buf = '';
  const waiters = new Map();
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      waiters.get(msg.id)?.(msg); waiters.delete(msg.id);
    }
  });
  let n = 0;
  const call = (method, params) => new Promise((r) => { const id = ++n; waiters.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { call, close: () => p.kill() };
}

for (const agent of ['claude', 'codex', 'antigravity']) {
  const s = session(agent);
  const init = await s.call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.equal(init.result.serverInfo.name, `agent-${agent}`);
  const list = await s.call('tools/list', {});
  assert.equal(list.result.tools[0].name, `ask_${agent}`);
  assert.equal((await s.call('nope', {})).error.code, -32601);
  // Unsafe model names and unknown effort levels are rejected before anything runs.
  for (const bad of [{ model: 'x & calc' }, { model: 'a"b' }, { effort: 'turbo' }]) {
    const r = await s.call('tools/call', { name: `ask_${agent}`, arguments: { prompt: 'hi', cwd: process.cwd(), ...bad } });
    assert.equal(r.result.isError, true, JSON.stringify(bad));
  }
  if (live) {
    const r = await s.call('tools/call', { name: `ask_${agent}`, arguments: { prompt: 'Reply with exactly: OK', cwd: process.cwd() } });
    assert.equal(r.result.isError, false, r.result.content[0].text);
    assert.match(r.result.content[0].text, /OK/);
  }
  s.close();
  console.log(`${agent}: ok`);
}

// A missing executable must come back as a tool error, and the server must keep running.
for (const [agent, env] of [['claude', 'CLAUDE_BIN'], ['antigravity', 'AGY_BIN']]) {
  const s = session(agent, { [env]: 'no-such-agent-binary' });
  await s.call('initialize', {});
  const r = await s.call('tools/call', { name: `ask_${agent}`, arguments: { prompt: 'hi', cwd: process.cwd() } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, new RegExp(env));
  assert.deepEqual((await s.call('ping', {})).result, {});
  s.close();
  console.log(`${agent} missing binary: ok`);
}
