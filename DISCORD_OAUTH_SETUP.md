# Discord OAuth 設置指南

## ✅ 已完成的改版

教官後台已成功從密碼登錄改為 Discord OAuth 登錄系統。

### 主要變更：
1. **身份驗證**：使用 Discord OAuth 2.0
2. **權限控制**：只允許特定角色 ID 的用戶訪問
3. **自動排除** bot 文件夾（不會上傳到 Vercel）

---

## 🔧 必要配置步驟

### 1. 獲取 Discord Server ID

您需要在 `.env.local` 文件中添加您的 Discord 伺服器 ID：

```bash
DISCORD_GUILD_ID=YOUR_DISCORD_SERVER_ID_HERE
```

**如何獲取 Server ID：**
1. 在 Discord 中，進入「用戶設置」→「進階」
2. 開啟「開發者模式」
3. 右鍵點擊您的伺服器圖標
4. 選擇「複製伺服器 ID」
5. 將 ID 貼到 `.env.local` 文件中

### 2. Discord Application 設置

在 [Discord Developer Portal](https://discord.com/developers/applications) 中：

#### OAuth2 設置：
1. 進入您的應用程式（Client ID: 1479498043341541376）
2. 點擊左側「OAuth2」→「General」
3. 添加 Redirect URI：
   - **本地開發**: `http://localhost:3000/api/auth/discord/callback`
   - **生產環境**: `https://你的域名.com/api/auth/discord/callback`

#### Bot 權限設置：
1. 點擊左側「Bot」
2. 確保以下權限已啟用：
   - ✅ Presence Intent
   - ✅ Server Members Intent
3. 確保 Bot 已加入您的 Discord 伺服器，並有權限讀取成員資訊

---

## 🔐 允許的角色 ID

系統已配置以下角色 ID 可以訪問後台：
- `1471124514170470483`
- `1443928754631213206`

如需修改，請編輯以下文件：
- `app/api/auth/discord/callback/route.ts`
- `app/api/auth/session/route.ts`

---

## 🚀 使用方式

### 本地開發
```bash
npm run dev
```

訪問 `http://localhost:3000/sjx-admin-panel`，點擊「使用 Discord 登入」按鈕

### 生產環境部署

在 Vercel 中設置以下環境變數：
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=你的伺服器ID
NEXT_PUBLIC_BASE_URL=https://你的域名.com
```

⚠️ **注意**：Bot Token 是敏感資訊，請勿公開分享

---

## 🎨 功能特點

### 登入頁面
- Discord OAuth 登入按鈕
- 錯誤訊息顯示（無權限、非成員等）
- 載入狀態提示

### 後台頁面
- 顯示 Discord 用戶資訊和頭像
- 登出按鈕
- 原有的所有管理功能保持不變

### 安全性
- Session 有效期：7 天
- HttpOnly Cookie（防止 XSS）
- 即時角色驗證
- 自動清理 URL 參數

---

## 🐛 常見問題

### 1. 登入後顯示「您沒有訪問權限」
- 確認您的 Discord 帳號在指定伺服器中
- 確認您擁有指定的角色 ID
- 檢查 Bot 是否有讀取成員資訊的權限

### 2. 登入時顯示「您不是 Discord 伺服器成員」
- 確認 `.env.local` 中的 `DISCORD_GUILD_ID` 正確
- 確認 Bot 已加入該伺服器
- 確認 Bot Token 正確且有 Server Members Intent

### 3. 無法登入
- 檢查 Redirect URI 是否正確配置
- 檢查 Console 中的錯誤訊息
- 確認所有環境變數已正確設置

---

## 📁 文件結構

```
app/
├── api/
│   └── auth/
│       ├── discord/
│       │   ├── route.ts          # OAuth 發起
│       │   └── callback/
│       │       └── route.ts      # OAuth 回調 + 角色驗證
│       ├── session/
│       │   └── route.ts          # Session 狀態檢查
│       └── logout/
│           └── route.ts          # 登出
└── sjx-admin-panel/
    └── page.tsx                   # 管理後台頁面

bot/                               # 已加入 .gitignore
```

---

## ✅ 部署檢查清單

- [ ] Discord Server ID 已添加到 `.env.local`
- [ ] Discord Application Redirect URI 已配置
- [ ] Bot 已加入 Discord 伺服器
- [ ] Bot 擁有 Server Members Intent
- [ ] Vercel 環境變數已設置
- [ ] 測試登入流程
- [ ] 測試角色權限驗證
- [ ] 測試登出功能

---

**版本**：v2.0  
**更新日期**：2026-03-06
