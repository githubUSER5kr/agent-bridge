# agent-bridge

讓 **Claude Code、Codex、Antigravity** 互相把對方當成 agent 呼叫。
你在任何一個 APP 裡說「叫 Codex 幫我 review 這個檔案」，它就會在背後叫 Codex 做完，再把結果交回來。

- 用你**自己的訂閱帳號**（Claude Pro/Max、ChatGPT Plus/Pro、Google 帳號），不需要 API key
- 桌面 APP 和 CLI 都能用
- 一個檔案、零相依套件，只需要 Node.js 18+

## 原理

每個 AI 寫程式工具都是「模型 + agent 迴圈 + 工具」，APP 和 CLI 是同一個 agent 的兩種外殼。
三家都有官方的非互動模式，用的是你登入時存在電腦裡的訂閱憑證：

| Agent | 非互動指令 |
|---|---|
| Claude Code | `claude -p "任務"` |
| Codex | `codex exec "任務"` |
| Antigravity | `agy -p "任務"` |

`agent-mcp.mjs` 是一個很小的 [MCP](https://modelcontextprotocol.io) server，把「執行某個 agent 的非互動指令」包成一個 MCP 工具（`ask_claude` / `ask_codex` / `ask_antigravity`）。每個 APP 註冊另外兩個，就能互相呼叫：

```
你在 Claude APP：「叫 Codex 檢查 login.js」
  └─ Claude 呼叫 MCP 工具 ask_codex(prompt, cwd)
       └─ agent-mcp.mjs 執行 codex exec "..."（在 cwd 專案資料夾裡）
            └─ Codex 用你的 ChatGPT 訂閱跑完，印出最終回答
       └─ 回答當成工具結果交回 Claude
  └─ Claude 整理後回報給你
```

兩邊不共享記憶，只共享 **任務文字** 和 **專案資料夾**。

安全設計：

- 被叫的一方預設**唯讀**，只有 `allow_edits: true` 才能改檔
- 任務開頭自動加上「你是被呼叫的子 agent，不要再呼叫其他 agent」；叫 Claude 時還會加 `--strict-mcp-config`，讓它不載入任何 MCP，避免互相無限呼叫
- 任務文字經由標準輸入（Claude、Codex）或直接參數（Antigravity）傳給對方，不會被 shell 當成指令解讀

## 安裝

### 1. 安裝並登入三個 CLI

照各家官方說明安裝，並各執行一次、用你的訂閱帳號登入：

- Claude Code：`claude`，登入後確認 `claude -p "hi"` 有回應
- Codex：`codex`，選 ChatGPT 帳號登入，確認 `codex exec --skip-git-repo-check "hi"` 有回應
- Antigravity：安裝 Antigravity 後會有 `agy`，確認 `agy -p "hi"` 有回應

只想串其中兩家也可以，略過沒裝的那家即可。

> **找不到指令時**：`agent-mcp.mjs` 會在 PATH 上找 `claude`、`codex`、`agy`（Windows 上用 npm 安裝產生的 `.cmd` 也支援）。不在 PATH 上時，請用環境變數 `CLAUDE_BIN` / `CODEX_BIN` / `AGY_BIN` 指向執行檔完整路徑。
> 例：Windows 上 Antigravity 的 CLI 通常在 `%LOCALAPPDATA%\agy\bin\agy.exe`，不在 PATH 上。

### 2. 下載

```bash
git clone https://github.com/githubUSER5kr/agent-bridge.git
```

以下把 `agent-mcp.mjs` 的**絕對路徑**寫成 `BRIDGE`，請自行替換（Windows 也請用 `/`，例如 `C:/Users/me/agent-bridge/agent-mcp.mjs`）。

先跑自我測試：

```bash
node test.mjs          # 只測協定，不呼叫模型
node test.mjs --live   # 實際叫三個 agent 各回一次 OK
```

### 3. 註冊 MCP

**Claude Code**（Claude 桌面 APP 的 Code 分頁共用這份設定）：

```bash
claude mcp add --scope user codex -- node BRIDGE codex
claude mcp add --scope user antigravity -- node BRIDGE antigravity
```

**Codex**（Codex APP 共用這份設定）：

```bash
codex mcp add claude -- node BRIDGE claude
codex mcp add antigravity -- node BRIDGE antigravity
```

接著編輯 `~/.codex/config.toml`，在這兩個 server 底下加上逾時（預設 60 秒，agent 任務常常不夠）：

```toml
[mcp_servers.claude]
# ...（command / args 保留）
tool_timeout_sec = 1800

[mcp_servers.antigravity]
# ...
tool_timeout_sec = 1800
```

**Antigravity**：

```bash
agy mcp add claude node BRIDGE claude
agy mcp add codex node BRIDGE codex
```

需要指定執行檔路徑時（例如 `agy` 不在 PATH 上），註冊時加上環境變數：

```bash
# Claude：-e 放在名稱「後面」
claude mcp add --scope user antigravity -e AGY_BIN=C:/path/to/agy.exe -- node BRIDGE antigravity
# Antigravity：--env 放在名稱「前面」
agy mcp add --env CLAUDE_BIN=/path/to/claude claude node BRIDGE claude
```

Codex 則在 `~/.codex/config.toml` 該 server 底下加一行：`env = { AGY_BIN = "C:/path/to/agy.exe" }`。

### 4. 加上全域說明

讓每個 agent 知道什麼時候、怎麼用這些工具。把下面這段加到各自的全域說明檔，並把工具名換成「另外兩個」：

| APP | 檔案 | 工具 |
|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | `ask_codex` / `ask_antigravity` |
| Codex | `~/.codex/AGENTS.md` | `ask_claude` / `ask_antigravity` |
| Antigravity | `~/.gemini/GEMINI.md` | `ask_claude` / `ask_codex` |

```markdown
## 呼叫其他 AI agent

使用者說「叫 Codex / Antigravity 做 X」或需要第二意見時，用 MCP 工具 `ask_codex` / `ask_antigravity`（用使用者的訂閱帳號）：

- `prompt`：完整任務。對方看不到這段對話，要寫清楚目標、檔案路徑、要回報什麼。
- `cwd`：專案資料夾的絕對路徑。
- `allow_edits`：預設 false；只有使用者要求改檔才設 true。

可能要跑幾分鐘，等它結束。把結果摘要給使用者，自己判斷對錯，不要照單全收。
```

### 5. 重開 APP

APP 要**完全關閉再開**才會載入新的 MCP 設定。

## 使用

在任何一個 APP 裡直接說：

- 「叫 Codex 幫我 review src/login.js」
- 「叫 Claude 想另一種寫法，跟你的比較」
- 「叫 Antigravity 幫我把這個函式改好（可以改檔）」

每次呼叫，APP 會跳出確認視窗：

- **只允許這一次**：下次還會問
- **永久允許**：之後這個工具都不再問（注意：不論 `allow_edits` 是 true 或 false 都會放行）
- 視窗會顯示參數，看到你沒要求的 `allow_edits: true` 就拒絕

被叫的一方在背景執行、不會再跳視窗，所以你按允許的那一刻就決定了這次呼叫的權限。

## 限制

- 每次呼叫都是新對話，不能接續上一輪
- 被叫的一方執行中看不到即時進度，跑完才有結果（過程紀錄在各家 CLI 的 session 檔裡）
- 每次呼叫都會用到被叫那一家的訂閱額度
- Antigravity 的 MCP 逾時未確認，任務很久時可能被中斷

## 注意

這個工具只呼叫各家**官方 CLI**，用的是**你自己在自己電腦上**登入的帳號，不會讀取、轉存或轉送任何登入憑證。請遵守各家服務條款，不要拿來共用帳號或對外提供服務。

## 授權

[MIT](LICENSE)
