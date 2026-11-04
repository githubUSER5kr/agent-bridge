# agent-bridge

讓 **Claude、Codex、Antigravity** 三個 AI 互相幫忙。

在其中一個 APP 裡說「**叫 Codex 幫我檢查這個檔案**」，它就會自動請 Codex 去做，再把結果告訴你。

- 用你**自己的訂閱帳號**，不需要 API key
- 桌面 APP 和終端機都能用
- 只要裝兩個以上就能用，不一定要三個都有

---

## 安裝（約 5 分鐘）

### 第 1 步：裝好你要用的 AI 工具，並各登入一次

至少要兩個。

| 工具 | 需要的帳號 | 要裝什麼 |
|---|---|---|
| Claude | Claude Pro / Max | [Claude Code](https://claude.com/claude-code)（只有 Claude 桌面 APP 不夠，要裝 Claude Code） |
| Codex | ChatGPT Plus / Pro | [Codex](https://developers.openai.com/codex) 的 APP 或 CLI |
| Antigravity | Google 帳號 | [Antigravity](https://antigravity.google) |

裝好後各打開一次，用你的帳號登入。

### 第 2 步：安裝 Node.js

到 [nodejs.org](https://nodejs.org) 下載 **LTS** 版本，安裝時一直按「下一步」就好。

### 第 3 步：下載這個專案

1. 按這個頁面上方綠色的 **Code** 按鈕 → **Download ZIP**
2. 把 ZIP 解壓縮到一個**之後不會移動的地方**，例如「文件」資料夾裡

> ⚠️ 之後不要移動或刪除這個資料夾，AI 工具會從這裡啟動它。真的要移動的話，移動後重做第 4 步。

### 第 4 步：執行安裝程式

**Windows**

1. 打開剛剛解壓縮出來的 `agent-bridge-main` 資料夾
2. 在資料夾裡的空白處按**右鍵** → **在終端機中開啟**
3. 輸入下面這行，按 Enter：

```
node install.mjs
```

**Mac**

1. 打開「終端機」APP
2. 輸入 `cd `（cd 後面有一個空格），把 `agent-bridge-main` 資料夾**拖進**終端機視窗，按 Enter
3. 輸入 `node install.mjs`，按 Enter

看到類似這樣的畫面就成功了：

```
尋找已安裝的工具…
  ✓ Claude：…
  ✓ Codex：…
  ✓ Antigravity：…

設定 Claude：
  ✓ 可以呼叫 Codex（ask_codex）
  ✓ 可以呼叫 Antigravity（ask_antigravity）
  ...

完成！請把 APP 完全關閉再重新打開，開一個新對話後就能用了。
```

### 第 5 步：重新打開 APP

把 Claude、Codex、Antigravity 的 APP **完全關閉**再重新打開，然後**開一個新對話**。

---

## 使用方式

直接用說的就好，例如：

- 「叫 Codex 幫我檢查 login.js 有沒有 bug」
- 「叫 Claude 想另一種寫法，跟你的比較看看」
- 「叫 Antigravity 幫我把這個函式改好，可以直接改檔案」

### 跳出確認視窗時怎麼選？

每次呼叫其他 AI 前，APP 會先問你：

| 選項 | 意思 |
|---|---|
| 只允許這一次 | 這次可以，下次還會再問 |
| 永久允許 | 以後呼叫這個 AI 都不再問 |
| 拒絕 | 這次不要呼叫 |

視窗裡如果看到 `allow_edits: true`，代表**對方可以修改你的檔案**。你沒有要它改檔卻看到這個，就按拒絕。

> 選「永久允許」之後，連會改檔的呼叫也不會再問你。如果你希望改檔前一定要確認，就每次選「只允許這一次」。

---

## 常見問題

**安裝程式說某個工具「沒找到」**
那個工具還沒裝好。裝好、登入後，再執行一次 `node install.mjs`。

**呼叫時出現「請確認 ○○ 已安裝並登入」**
那個工具的登入過期了。打開終端機輸入 `claude`、`codex` 或 `agy`，照畫面重新登入。

**移動了資料夾，或下載了新版本**
在新的資料夾裡再執行一次 `node install.mjs`，它會自動更新設定。

**Claude 顯示 codex「Failed to connect」或「Conflicting scopes」**
代表你以前在某個資料夾另外設定過同名的工具。在終端機執行：

```
claude mcp remove codex -s local
```

（看到的名字是 antigravity 就把 codex 換成 antigravity）

**會額外花錢嗎？**
不會額外收費，但會用到被呼叫那一家的**訂閱額度**。

**想確認是不是真的裝好了**
在 `agent-bridge-main` 資料夾執行 `node test.mjs --live`，它會實際叫每個 AI 回覆一次，全部顯示 `ok` 就對了。

---

## 安裝程式改了哪些東西

安裝程式只做這些事，可以重複執行，不會重複新增：

| 工具 | 註冊位置 | 寫入的說明檔 |
|---|---|---|
| Claude | `~/.claude.json` | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/config.toml` | `~/.codex/AGENTS.md` |
| Antigravity | `~/.gemini/config/mcp_config.json` | `~/.gemini/GEMINI.md` |

說明檔裡只會新增一段夾在 `<!-- agent-bridge:start -->` 和 `<!-- agent-bridge:end -->` 之間的文字，你原本的內容不會被動到。要移除時，刪掉那段文字，並在各工具執行 `mcp remove` 即可。

---

## 原理（給想了解的人）

三家都有官方的「非互動模式」：`claude -p`、`codex exec`、`agy -p`。這些指令用的是你登入時存在電腦裡的訂閱帳號。

`agent-mcp.mjs` 是一個很小的 [MCP](https://modelcontextprotocol.io) 伺服器。它把「執行某個 AI 的非互動指令」包成一個工具（`ask_claude` / `ask_codex` / `ask_antigravity`），每個 APP 再註冊另外兩個：

```
你在 Claude 說：「叫 Codex 檢查 login.js」
  └─ Claude 呼叫工具 ask_codex
       └─ agent-mcp.mjs 在背後執行 codex exec "..."
            └─ Codex 用你的 ChatGPT 訂閱做完，回報結果
  └─ Claude 整理後告訴你
```

兩邊不共享記憶，只共享**任務文字**和**專案資料夾**。

安全設計：

- 被呼叫的一方預設**只能讀、不能改檔**
- 被呼叫的一方會被告知「不要再呼叫其他 AI」，避免互相無限呼叫
- 任務文字不會被系統當成指令執行

## 限制

- 每次呼叫都是新的對話，對方不記得上一次
- 對方工作時看不到即時進度，做完才有結果
- Antigravity 那一邊的等待時間上限未確認，任務很久時可能被中斷

## 注意

這個工具只使用各家**官方程式**，用的是**你自己在自己電腦上**登入的帳號，不會讀取、儲存或傳送任何登入資料。請遵守各家服務條款，不要拿來共用帳號或對外提供服務。

## 授權

[MIT](LICENSE)
