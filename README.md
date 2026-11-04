<div align="center">

# agent-bridge

**Let Claude Code, Codex, and Antigravity call each other as sub-agents, using the subscriptions you already have.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-8A2BE2)](https://modelcontextprotocol.io)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

**English** · [繁體中文](README.zh-TW.md)

</div>

---

agent-bridge is a small [Model Context Protocol](https://modelcontextprotocol.io) server that exposes each coding agent as a tool to the others. Ask one agent to delegate a task, and it hands the task to another agent, which runs in its own fresh context and returns only the final result.

```text
You (in Claude Code):  Ask Codex to review src/auth.ts for security issues.

Claude Code ── ask_codex ──▶ Codex reviews the file in the same project folder
Claude Code ◀── report ───── and returns its findings
```

## Key Features

- **No API keys.** Uses each vendor's official CLI with the account you are already signed in to (Claude Pro/Max, ChatGPT Plus/Pro, Google).
- **Works in apps and CLIs.** Claude Code (CLI and desktop), the Codex app and CLI, and Antigravity.
- **Zero dependencies.** One ~100-line file. Node.js is all you need.
- **Read-only by default.** The callee can only edit files when the caller sets `allow_edits: true`.
- **Loop-safe.** Callees are told not to call other agents, and Claude callees load no MCP servers at all.
- **One-command setup.** `node install.mjs` detects what you have installed and configures everything. Safe to re-run.

## How It Works

Each vendor ships a non-interactive mode that reuses your stored login:

| Agent | Command used | MCP tool exposed |
|---|---|---|
| Claude Code | `claude -p` | `ask_claude` |
| Codex | `codex exec` | `ask_codex` |
| Antigravity | `agy -p` | `ask_antigravity` |

`agent-mcp.mjs` wraps one of these commands as an MCP tool. Each agent registers the *other* agents, so any of them can delegate to the rest. The two sides share only the task text and the project folder. They do not share conversation history.

## Requirements

- [Node.js](https://nodejs.org) 18 or later
- At least **two** of the following, each installed and signed in once:

| Agent | Account | Install |
|---|---|---|
| Claude Code | Claude Pro / Max | [Claude Code](https://claude.com/claude-code) (the Claude desktop chat app alone is not enough) |
| Codex | ChatGPT Plus / Pro | [Codex](https://developers.openai.com/codex) app or CLI |
| Antigravity | Google account | [Antigravity](https://antigravity.google) |

## Getting Started

### 1. Download

```bash
git clone https://github.com/githubUSER5kr/agent-bridge.git
```

Or click **Code → Download ZIP** on this page and unzip it. Keep the folder somewhere permanent, because the agents launch the bridge from this location.

### 2. Run the installer

From inside the folder:

```bash
node install.mjs
```

> **Windows tip:** open the folder in File Explorer, right-click an empty area, and choose **Open in Terminal**.

Expected output (the installer currently prints in Traditional Chinese):

```text
尋找已安裝的工具…
  ✓ Claude：C:/Users/me/.local/bin/claude.exe
  ✓ Codex：C:/Users/me/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
  ✓ Antigravity：C:/Users/me/AppData/Local/agy/bin/agy.exe

設定 Claude：
  ✓ 可以呼叫 Codex（ask_codex）
  ✓ 可以呼叫 Antigravity（ask_antigravity）
  ...
完成！
```

Agents that are not installed are skipped.

### 3. Restart your apps

Fully quit and reopen Claude, Codex, and Antigravity, then start a **new** conversation. MCP servers load only when a session starts.

### 4. Verify (optional)

```bash
node test.mjs --live
```

This asks each agent to reply once and prints `ok` for each one.

<details>
<summary><b>Manual setup</b> (instead of <code>install.mjs</code>)</summary>

Replace `/path/to/agent-bridge` with the folder's absolute path. On Windows, use forward slashes (`C:/Users/me/agent-bridge`).

**Claude Code**

```bash
claude mcp add --scope user codex -- node /path/to/agent-bridge/agent-mcp.mjs codex
claude mcp add --scope user antigravity -- node /path/to/agent-bridge/agent-mcp.mjs antigravity
```

**Codex**

```bash
codex mcp add claude -- node /path/to/agent-bridge/agent-mcp.mjs claude
codex mcp add antigravity -- node /path/to/agent-bridge/agent-mcp.mjs antigravity
```

Then raise the tool timeout in `~/.codex/config.toml` (the default of 60 s is too short for agent tasks):

```toml
[mcp_servers.claude]
tool_timeout_sec = 1800

[mcp_servers.antigravity]
tool_timeout_sec = 1800
```

**Antigravity**

```bash
agy mcp add claude node /path/to/agent-bridge/agent-mcp.mjs claude
agy mcp add codex node /path/to/agent-bridge/agent-mcp.mjs codex
```

**Usage note (optional, recommended)**

The tools work without it: each tool already describes itself, and naming the tool directly ("use `ask_codex` to…") always works. The note helps an agent recognise casual requests such as *"get a second opinion from Codex"*, and reminds it to pass `cwd` and keep `allow_edits` off unless asked.

Append this to each agent's global instructions file, listing the **other two** agents:

| Agent | File | Tools to list |
|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | `ask_codex` / `ask_antigravity` |
| Codex | `~/.codex/AGENTS.md` | `ask_claude` / `ask_antigravity` |
| Antigravity | `~/.gemini/GEMINI.md` | `ask_claude` / `ask_codex` |

```markdown
## Calling other AI agents

When the user asks to have Codex / Antigravity do something, or wants a second opinion,
use the MCP tools `ask_codex` / `ask_antigravity` (they run on the user's own subscriptions):

- `prompt`: the full task. The other agent cannot see this conversation, so state the goal,
  file paths, and what to report back.
- `cwd`: absolute path of the project folder.
- `allow_edits`: false by default; set true only when the user asked for file changes.
- `model` / `effort`: fill in only when the user specifies a model or effort level.

It may take a few minutes. Summarise the result for the user and judge it yourself
rather than accepting it as-is.
```

</details>

## Usage

Just ask in plain language:

- *"Ask Codex to review `login.js` for bugs."*
- *"Have Claude propose an alternative implementation and compare it with yours."*
- *"Ask Antigravity to fix this function. It may edit files."*
- *"Ask Claude with opus at max effort to design the database schema."*

Before each call, the app shows an approval prompt. Check `allow_edits` in that prompt. If it is `true` and you did not ask for edits, decline.

> [!NOTE]
> "Always allow" approves the tool regardless of `allow_edits`. If you want to review every call that may edit files, choose "Allow once" instead.

## Tool Reference

Every tool (`ask_claude`, `ask_codex`, `ask_antigravity`) takes the same parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | yes | The full task. The callee cannot see the caller's conversation, so include goals, file paths, and what to report back. |
| `cwd` | string | yes | Absolute path of the project folder the callee works in. |
| `allow_edits` | boolean | no (default `false`) | Let the callee modify files. |
| `model` | string | no | Model to use. Omit to use the callee's default. See below. |
| `effort` | string | no | Reasoning effort. Higher is more thorough but slower and uses more quota. See below. |

| Tool | `model` examples | `effort` values |
|---|---|---|
| `ask_claude` | `opus`, `sonnet`, `fable`, or a full name such as `claude-opus-5-5` | `low` `medium` `high` `xhigh` `max` |
| `ask_codex` | any Codex model available on your ChatGPT plan | `minimal` `low` `medium` `high` `xhigh` |
| `ask_antigravity` | an ID from `agy models`, e.g. `gemini-3.8-flash-high` | `low` `medium` `high` `xhigh` `max` |

Model names may contain only letters, digits, and `. _ : / [ ] -`. Anything else is rejected before the callee starts.

The tool returns the callee's final answer as text. If the callee fails, the result is marked as an error and includes the last part of its output.

## Configuration

The bridge finds each CLI on `PATH`. Override with environment variables when a CLI lives elsewhere. `install.mjs` sets these automatically.

| Variable | Default | Example |
|---|---|---|
| `CLAUDE_BIN` | `claude` | `C:/Users/me/.local/bin/claude.exe` |
| `CODEX_BIN` | `codex` | `/opt/homebrew/bin/codex` |
| `AGY_BIN` | `agy` | `C:/Users/me/AppData/Local/agy/bin/agy.exe` |

Windows `.cmd` launchers, such as those created by `npm install -g`, are supported.

## Security

- **Read-only by default.** `allow_edits: true` maps to `--permission-mode acceptEdits` (Claude), `-s workspace-write` (Codex), or `--mode accept-edits` (Antigravity).
- **No shell injection.** The task text reaches the callee through stdin (Claude, Codex) or as a direct argument (Antigravity). No shell ever interprets it.
- **Recursion guard.** Every task starts with an instruction not to call other agents. Claude callees also run with `--strict-mcp-config`, which loads no MCP servers.
- **Credentials untouched.** The bridge only launches official CLIs. It never reads, stores, or forwards tokens.
- **Headless callees cannot prompt.** Any action that would need your approval inside the callee is denied. Your approval of the outer tool call is the only gate.

## Troubleshooting

<details>
<summary>The installer says an agent was "not found"</summary>

Install the agent, sign in once, and re-run `node install.mjs`. If the CLI is installed in an unusual location, set `CLAUDE_BIN`, `CODEX_BIN`, or `AGY_BIN` before running the installer.

</details>

<details>
<summary>A call fails with "請確認 … 已安裝並登入" (check that it is installed and signed in)</summary>

The callee's login has expired. Run `claude`, `codex`, or `agy` in a terminal and sign in again.

</details>

<details>
<summary>Claude shows "Failed to connect" or "Conflicting scopes"</summary>

An older server with the same name is defined in a project (local) scope and overrides the user-scope one. Remove it:

```bash
claude mcp remove codex -s local
```

</details>

<details>
<summary>I moved the folder or downloaded a new version</summary>

Run `node install.mjs` again from the new location. It updates every registration in place.

</details>

## What the Installer Changes

| Agent | MCP registration | Usage note |
|---|---|---|
| Claude Code | `~/.claude.json` (user scope) | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/config.toml` | `~/.codex/AGENTS.md` |
| Antigravity | `~/.gemini/config/mcp_config.json` | `~/.gemini/GEMINI.md` |

The usage note is wrapped in `<!-- agent-bridge:start -->` … `<!-- agent-bridge:end -->`. Re-running the installer replaces that block and leaves the rest of the file untouched.

<details>
<summary>Uninstall</summary>

```bash
claude mcp remove -s user codex && claude mcp remove -s user antigravity
codex mcp remove claude && codex mcp remove antigravity
agy mcp remove claude && agy mcp remove codex
```

Then delete the `agent-bridge` block from the three instruction files.

</details>

## Limitations

- Each call starts a new conversation. Follow-up calls do not remember earlier ones.
- There is no live progress while the callee works. Results arrive when it finishes.
- Each call uses the callee's subscription quota.
- Antigravity's MCP tool timeout has not been verified. Very long tasks may be cut off.

## Related Projects

- [PAL MCP Server](https://github.com/BeehiveInnovations/pal-mcp-server): a full multi-model MCP server whose `clink` tool also bridges AI CLIs, with role presets and conversation continuity. Choose it if you want those features. Choose agent-bridge if you want a single dependency-free file that works only through your subscriptions.

## Disclaimer

agent-bridge is an independent project. It is not affiliated with or endorsed by Anthropic, OpenAI, or Google. Claude, Codex, and Antigravity are trademarks of their respective owners. Use it only with your own accounts on your own machine, and follow each provider's terms of service.

## License

[MIT](LICENSE)
