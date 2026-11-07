// Self-check: node test.mjs            (protocol only, no model calls)
//             node test.mjs --live     (also asks each agent to reply OK)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    // A follow-up with the returned session_id must remember the first turn.
    const first = await s.call('tools/call', { name: `ask_${agent}`, arguments: { prompt: 'Remember the code word PINEAPPLE. Reply with exactly: OK', cwd: process.cwd() } });
    const id = first.result.content[0].text.match(/\[session_id: ([^\]]+)\]/)?.[1];
    assert.ok(id, first.result.content[0].text);
    const next = await s.call('tools/call', { name: `ask_${agent}`, arguments: { prompt: 'What was the code word? Reply with the word only.', cwd: process.cwd(), session_id: id } });
    assert.equal(next.result.isError, false, next.result.content[0].text);
    assert.match(next.result.content[0].text, /PINEAPPLE/i);
  }
  s.close();
  console.log(`${agent}: ok`);
}

// Malformed session IDs are rejected before anything runs.
{
  const s = session('antigravity', { AGY_BIN: 'no-such-agent-binary' });
  await s.call('initialize', {});
  for (const session_id of ['a b', 'x&y', '--mode', '-c', '"quoted"']) {
    const r = await s.call('tools/call', { name: 'ask_antigravity', arguments: { prompt: 'hi', cwd: process.cwd(), session_id } });
    assert.equal(r.result.isError, true, session_id);
    assert.doesNotMatch(r.result.content[0].text, /AGY_BIN/, 'must fail before launching'); // not a launch error
  }
  s.close();
  console.log('session_id validation: ok');
}

// Conversation continuity, checked against a fake agent that echoes its arguments and stdin.
// It prints a Codex-style "session id:" header, and with --output-format json it answers with an
// Antigravity-style envelope (FAKE_PLAIN=1 imitates an older agy without JSON output).
// (Needs a shebang script, so it runs on macOS / Linux only.)
if (process.platform !== 'win32') {
  const dir = mkdtempSync(join(tmpdir(), 'agent-bridge-'));
  const fake = join(dir, 'fake-agent');
  writeFileSync(fake, `#!${process.execPath}
let input = '';
process.stdin.on('data', (d) => (input += d)).on('end', () => {
  const argv = process.argv.slice(2);
  console.error('session id: 0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000');
  const echo = JSON.stringify({ argv, stdin: input });
  if (!argv.includes('--output-format') || process.env.FAKE_PLAIN) return console.log(echo);
  const asked = argv[argv.indexOf('--conversation') + 1];
  const id = !argv.includes('--conversation') ? 'conv-1111' : asked === 'conv-gone' ? 'conv-2222' : asked;
  console.log(JSON.stringify({ conversation_id: id, status: 'SUCCESS', response: echo, num_turns: 1 }, null, 2));
});
`);
  chmodSync(fake, 0o755);
  const ask = async (s, agent, args) => {
    const r = await s.call('tools/call', { name: `ask_${agent}`, arguments: { cwd: process.cwd(), ...args } });
    assert.equal(r.result.isError, false, r.result.content[0].text);
    const text = r.result.content[0].text;
    const id = text.match(/\[session_id: ([^\]]+)\]/)?.[1];
    assert.ok(id, 'answer must end with a session_id');
    const lost = text.includes('找不到原本的對話');
    return { id, lost, ...JSON.parse(text.slice(0, text.indexOf('\n\n'))) };
  };

  // Claude: we choose the ID, then resume it natively.
  let s = session('claude', { CLAUDE_BIN: fake });
  await s.call('initialize', {});
  let a = await ask(s, 'claude', { prompt: 'first' });
  assert.match(a.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(a.argv.slice(0, 4), ['-p', '--strict-mcp-config', '--session-id', a.id]);
  let b = await ask(s, 'claude', { prompt: 'second', session_id: a.id });
  assert.equal(b.id, a.id);
  assert.deepEqual(b.argv.slice(2, 4), ['--resume', a.id]);
  assert.match(b.stdin, /second/);
  s.close();
  console.log('claude session: ok');

  // Codex: the ID comes from its stderr header, then `exec … resume <id> -`.
  s = session('codex', { CODEX_BIN: fake });
  await s.call('initialize', {});
  a = await ask(s, 'codex', { prompt: 'first', model: 'm1' });
  assert.equal(a.id, '0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000');
  assert.ok(!a.argv.includes('resume'));
  b = await ask(s, 'codex', { prompt: 'second', session_id: a.id, model: 'm1' });
  assert.deepEqual(b.argv, ['exec', '--skip-git-repo-check', '-s', 'read-only', '-m', 'm1', 'resume', a.id, '-']);
  s.close();
  console.log('codex session: ok');

  // Antigravity: the ID comes from the JSON envelope, then `--conversation <id>`.
  s = session('antigravity', { AGY_BIN: fake });
  await s.call('initialize', {});
  a = await ask(s, 'antigravity', { prompt: 'first', effort: 'low' });
  assert.equal(a.id, 'conv-1111');
  assert.deepEqual(a.argv.slice(2), ['--output-format', 'json', '--effort', 'low']);
  b = await ask(s, 'antigravity', { prompt: 'second', session_id: a.id });
  assert.equal(b.id, a.id);
  assert.equal(b.lost, false);
  assert.deepEqual(b.argv.slice(2), ['--output-format', 'json', '--conversation', a.id]);
  assert.doesNotMatch(b.argv[1], /first/);          // native resume: no replayed history
  // If agy cannot find the conversation and starts a new one, the caller is told and gets the new ID.
  const c = await ask(s, 'antigravity', { prompt: 'third', session_id: 'conv-gone' });
  assert.equal(c.id, 'conv-2222');
  assert.equal(c.lost, true);
  s.close();
  console.log('antigravity session: ok');

  // Fallback: a CLI that reports no ID (older agy) is continued by replaying earlier turns.
  s = session('antigravity', { AGY_BIN: fake, FAKE_PLAIN: '1' });
  await s.call('initialize', {});
  a = await ask(s, 'antigravity', { prompt: 'remember BANANA' });
  assert.match(a.id, /^[0-9a-f-]{36}$/);
  b = await ask(s, 'antigravity', { prompt: 'what word?', session_id: a.id });
  assert.equal(b.id, a.id);
  const sent = b.argv[1];
  assert.match(sent, /remember BANANA/);            // the earlier task…
  assert.match(sent, /"argv"/);                     // …and the earlier answer are replayed
  assert.ok(sent.indexOf('remember BANANA') < sent.indexOf('what word?'));
  assert.ok(!b.argv.includes('--conversation'));
  const d = await ask(s, 'antigravity', { prompt: 'fresh start' });
  assert.notEqual(d.id, a.id);
  assert.doesNotMatch(d.argv[1], /BANANA/);         // no session_id → a clean conversation
  s.close();
  rmSync(dir, { recursive: true, force: true });
  console.log('replay fallback: ok');
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
