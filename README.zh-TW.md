<div align="center">

# agent-bridge

**讓 Claude Code、Codex、Antigravity 互相當作子 agent 呼叫，用的是你已經有的訂閱帳號。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-8A2BE2)](https://modelcontextprotocol.io)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

[English](README.md) · **繁體中文**

</div>

---

agent-bridge 是一個小型的 [Model Context Protocol（MCP）](https://modelcontextprotocol.io) 伺服器，把每個寫程式 AI 包成工具，讓其他 AI 可以呼叫。你請其中一個 AI 把任務交出去，它就會交給另一個 AI。對方在全新的對話裡完成，只把最終結果交回來。

```text
你（在 Claude Code 裡）：叫 Codex 檢查 src/auth.ts 有沒有安全問題

Claude Code ── ask_codex ──▶ Codex 在同一個專案資料夾裡檢查
Claude Code ◀── 報告 ────── 交回檢查結果
```

## 特色

- **不需要 API key**：使用各家官方命令列程式，用你已經登入的帳號（Claude Pro/Max、ChatGPT Plus/Pro、Google）。
- **APP 和終端機都能用**：Claude Code（終端機與桌面版）、Codex APP 與 CLI、Antigravity。
- **零相依套件**：只有一個約 190 行的檔案，只需要 Node.js。
- **預設唯讀**：呼叫方設定 `allow_edits: true` 時，對方才能改檔。
- **可以追問**：每次回答最後都會附上 `session_id`。帶回去就能接著同一段對話問；不帶就是全新開始。
- **防止無限呼叫**：被呼叫的一方會被要求不要再呼叫別人；被呼叫的 Claude 完全不載入任何 MCP。
- **一行指令安裝**：`node install.mjs` 會偵測你裝了哪些工具，並設定好一切，可重複執行。

## 運作原理

三家都有官方的「非互動模式」，會沿用你存在電腦裡的登入：

| Agent | 使用的指令 | 提供的 MCP 工具 |
|---|---|---|
| Claude Code | `claude -p` | `ask_claude` |
| Codex | `codex exec` | `ask_codex` |
| Antigravity | `agy -p` | `ask_antigravity` |

`agent-mcp.mjs` 把其中一個指令包成 MCP 工具。每個 agent 註冊**另外兩個**，所以任何一個都能把任務交給其他兩個。雙方只共享任務文字和專案資料夾。對方看不到呼叫方的對話，但記得自己和呼叫方先前的往來（見[追問](#追問)）。

## 系統需求

- [Node.js](https://nodejs.org) 18 以上（下載 **LTS** 版，安裝時一直按「下一步」即可）
- 下列工具**至少兩個**，並各登入過一次：

| Agent | 需要的帳號 | 下載 |
|---|---|---|
| Claude Code | Claude Pro / Max | [Claude Code](https://claude.com/claude-code)（只有 Claude 桌面聊天 APP 不夠） |
| Codex | ChatGPT Plus / Pro | [Codex](https://developers.openai.com/codex) 的 APP 或 CLI |
| Antigravity | Google 帳號 | [Antigravity](https://antigravity.google) |

## 安裝

### 1. 下載

```bash
git clone https://github.com/githubUSER5kr/agent-bridge.git
```

不熟 git 的話，可以按這個頁面上方綠色的 **Code → Download ZIP**，再解壓縮。請放在**之後不會移動**的位置，例如「文件」資料夾，因為 AI 工具會從這裡啟動它。

### 2. 執行安裝程式

在資料夾裡執行：

```bash
node install.mjs
```

> **Windows 小技巧：** 用檔案總管打開資料夾，在空白處按右鍵 →「**在終端機中開啟**」，再輸入上面那行。
>
> **Mac 小技巧：** 打開「終端機」，輸入 `cd `（後面有空格），把資料夾拖進視窗後按 Enter，再輸入上面那行。

成功時會看到：

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

沒安裝的工具會自動略過。

### 3. 重新打開 APP

把 Claude、Codex、Antigravity **完全關閉**再重開，然後開一個**新對話**。MCP 只在對話開始時載入。

### 4. 驗證（選用）

```bash
node test.mjs --live
```

會實際叫每個 agent 回覆一次，全部顯示 `ok` 就代表正常。

<details>
<summary><b>手動設定</b>（不使用 <code>install.mjs</code>）</summary>

把 `/path/to/agent-bridge` 換成資料夾的完整路徑。Windows 也請用 `/`，例如 `C:/Users/me/agent-bridge`。

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

接著在 `~/.codex/config.toml` 把逾時調長（預設 60 秒，對 agent 任務來說太短）：

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

**使用說明（選用，建議加）**

不加也能用：每個工具本身就帶有說明，直接點名工具（「用 `ask_codex` 叫 Codex…」）一定有效。加了這段，AI 比較能聽懂「叫 Codex 給個第二意見」這種隨口的說法，也比較記得要帶 `cwd`、沒要求改檔時不開 `allow_edits`。

把下面這段加到各 agent 的全域說明檔最後面，工具名換成**另外兩個**：

| Agent | 檔案 | 要寫的工具 |
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
- `model` / `effort`：使用者指定模型或思考強度時才填，否則留空。
- `session_id`：要接著先前那次呼叫追問時，填那次回答最後附的 `session_id`（`cwd` 要相同）。新任務就不要填。

可能要跑幾分鐘，等它結束。把結果摘要給使用者，自己判斷對錯，不要照單全收。
```

</details>

## 使用方式

直接用說的：

- 「叫 Codex 幫我檢查 `login.js` 有沒有 bug」
- 「叫 Claude 想另一種寫法，跟你的比較看看」
- 「叫 Antigravity 修好這個函式，可以直接改檔」
- 「叫 Claude 用 opus、effort 開到 max，幫我設計資料庫結構」

每次呼叫前，APP 會跳出確認視窗。請看一下視窗裡的 `allow_edits`：如果是 `true`，但你沒有要求改檔，就按拒絕。

> [!NOTE]
> 「永久允許」不管 `allow_edits` 是什麼都會放行。如果你希望每次可能改檔前都確認，請選「只允許這一次」。

### 追問

你不需要做任何特別的事。每次回答最後都會有這樣一行：

```text
[session_id: 0dbfbb6d-8909-493e-92a9-876ebae605cc]
```

在同一個對話裡接著說，例如「問 Codex 為什麼第 42 行有問題」，呼叫方的 AI 會把這個 `session_id` 帶回去，對方就會接著上次繼續：它還記得讀過哪些檔案、說過什麼。不帶 `session_id` 的話，每次都是全新開始。

| 被呼叫方 | 怎麼記住 | APP 重開後還在嗎？ |
|---|---|---|
| Claude | Claude Code 自己的 session（`--session-id`，之後 `--resume`） | 在 |
| Codex | Codex 自己的 session（`codex exec … resume <id>`） | 在 |
| Antigravity | Antigravity 自己的對話（`--output-format json` 回報 `conversation_id`，之後 `--conversation <id>`） | 在 |

追問時 `cwd` 要和第一次相同，三家都是依專案資料夾存放對話的。

如果對方找不到原本的對話、改在新對話裡回答，回覆裡會註明，並附上新的 `session_id`。

## 工具參數

所有工具（`ask_claude`、`ask_codex`、`ask_antigravity`）的參數都一樣：

| 參數 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `prompt` | string | 是 | 完整任務。對方看不到呼叫方的對話，要寫清楚目標、檔案路徑、要回報什麼。 |
| `cwd` | string | 是 | 對方工作的專案資料夾完整路徑。 |
| `allow_edits` | boolean | 否（預設 `false`） | 是否允許對方改檔。 |
| `model` | string | 否 | 指定模型。不填就用對方的預設模型，可用的值見下表。 |
| `effort` | string | 否 | 思考強度。越高越仔細，但越慢、越耗額度，可用的值見下表。 |
| `session_id` | string | 否 | 接續先前和這個 agent 的對話。填上次回答最後附的 `session_id`，`cwd` 要相同。不填就開新對話。 |

| 工具 | `model` 範例 | `effort` 可用值 |
|---|---|---|
| `ask_claude` | `opus`、`sonnet`、`fable`，或完整名稱如 `claude-opus-5-5` | `low` `medium` `high` `xhigh` `max` |
| `ask_codex` | 你的 ChatGPT 方案可用的模型 ID，例如 `gpt-6.1-sol` | `low` `medium` `high` `xhigh` `max` `ultra`（`ultra` 僅部分模型支援） |
| `ask_antigravity` | `agy models` 列出的 ID，例如 `gemini-3.8-flash-high` | `low` `medium` `high` `xhigh` `max` |

模型名稱只能包含英數字和 `. _ : / [ ] -`，session_id 只能包含英數字和 `. _ : -` 且不能以 `-` 開頭，其他字元會在啟動對方之前就被拒絕。

工具會回傳對方的最終回答，最後附上 `session_id`。如果對方執行失敗，結果會標記為錯誤，並附上對方最後的輸出。

## 設定

轉接程式會在系統路徑（`PATH`）上找各工具。工具裝在其他位置時，可以用環境變數指定。`install.mjs` 會自動幫你設定好。

| 環境變數 | 預設 | 範例 |
|---|---|---|
| `CLAUDE_BIN` | `claude` | `C:/Users/me/.local/bin/claude.exe` |
| `CODEX_BIN` | `codex` | `/opt/homebrew/bin/codex` |
| `AGY_BIN` | `agy` | `C:/Users/me/AppData/Local/agy/bin/agy.exe` |

支援 Windows 上的 `.cmd` 啟動檔（例如 `npm install -g` 產生的）。

## 安全性

- **預設唯讀**：`allow_edits: true` 對應到 `--permission-mode acceptEdits`（Claude）、`-s workspace-write`（Codex）、`--mode accept-edits`（Antigravity）。
- **不會被注入指令**：任務文字經由標準輸入（Claude、Codex）或直接參數（Antigravity）傳給對方，不會經過 shell 解讀。
- **防止遞迴**：每個任務開頭都會要求對方不要再呼叫其他 agent。被呼叫的 Claude 另外加上 `--strict-mcp-config`，不載入任何 MCP。
- **不碰登入憑證**：只啟動官方命令列程式，不讀取、儲存或轉送任何 token。
- **被呼叫方不會跳確認**：對方在背景執行，任何需要你核准的動作都會被直接拒絕。你核准外層那次呼叫，是唯一的把關點。

## 疑難排解

<details>
<summary>安裝程式說某個工具「沒找到」</summary>

先安裝那個工具並登入一次，再重新執行 `node install.mjs`。如果工具裝在特殊位置，執行安裝程式前先設定 `CLAUDE_BIN`、`CODEX_BIN` 或 `AGY_BIN`。

</details>

<details>
<summary>呼叫時出現「請確認 … 已安裝並登入」</summary>

被呼叫那一方的登入過期了。在終端機執行 `claude`、`codex` 或 `agy`，重新登入即可。

</details>

<details>
<summary>Antigravity 出現不認得 <code>--output-format</code> 的錯誤</summary>

你的 `agy` 版本比 bridge 用到的 JSON 輸出功能還舊，請把 Antigravity 更新到最新版。

</details>

<details>
<summary>Claude 顯示「Failed to connect」或「Conflicting scopes」</summary>

代表某個專案（local）層級還有一個同名的舊設定，蓋過了使用者層級的設定。刪掉舊的：

```bash
claude mcp remove codex -s local
```

（如果出問題的是 antigravity，就把 `codex` 換成 `antigravity`）

</details>

<details>
<summary>移動了資料夾，或下載了新版本</summary>

在新位置重新執行 `node install.mjs`，它會自動更新所有設定。

</details>

## 安裝程式修改的檔案

| Agent | MCP 註冊位置 | 使用說明 |
|---|---|---|
| Claude Code | `~/.claude.json`（使用者層級） | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/config.toml` | `~/.codex/AGENTS.md` |
| Antigravity | `~/.gemini/config/mcp_config.json` | `~/.gemini/GEMINI.md` |

使用說明會包在 `<!-- agent-bridge:start -->` … `<!-- agent-bridge:end -->` 之間。重新執行安裝程式只會替換這一段，檔案其他內容不會被動到。

<details>
<summary>移除</summary>

```bash
claude mcp remove -s user codex && claude mcp remove -s user antigravity
codex mcp remove claude && codex mcp remove antigravity
agy mcp remove claude && agy mcp remove codex
```

再把三份說明檔裡的 `agent-bridge` 段落刪掉。

</details>

## 限制

- 如果對方沒有回報 session ID（例如較舊版的 Codex 或 Antigravity），bridge 會自己記住先前的問答，下次附進 prompt（保留最近約 16,000 字元）。這樣記得大意，但不記得對方讀過的檔案，而且呼叫方的 APP 重開後就會遺失。
- 對方工作時看不到即時進度，做完才會有結果。
- 每次呼叫都會用到被呼叫那一家的訂閱額度。
- Antigravity 的 MCP 逾時上限未確認，任務很久時可能被中斷。

## 相關專案

- [PAL MCP Server](https://github.com/BeehiveInnovations/pal-mcp-server)：功能完整的多模型 MCP 伺服器，它的 `clink` 工具也能串接各家 AI 命令列程式，並支援角色預設與多模型工作流程。需要這些功能可以選它；想要單一檔案、零相依、只走訂閱帳號，可以選 agent-bridge。

## 免責聲明

agent-bridge 是獨立專案，與 Anthropic、OpenAI、Google 沒有任何關係，也未獲其背書。Claude、Codex、Antigravity 為各自所有者的商標。請只在自己的電腦上搭配自己的帳號使用，並遵守各家服務條款。

## 授權

[MIT](LICENSE)
