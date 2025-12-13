# 🚀 快速部署指南

## 最快的方式：使用 Vercel（推荐）

**只需 3 步，30 秒完成部署！**

### 步骤 1：访问 Vercel
在浏览器中打开：https://vercel.com

### 步骤 2：导入 GitHub 仓库
1. 点击 "Add New..." → "Project"
2. 选择 "Import Git Repository"
3. 授权 Vercel 访问您的 GitHub
4. 选择 `new-slot-machine` 仓库
5. 点击 "Import"

### 步骤 3：部署
1. 保持默认设置
2. 点击 "Deploy"
3. 等待约 30 秒，部署完成！

### 步骤 4：访问
1. 复制 Vercel 提供的 HTTPS 链接（例如：`https://new-slot-machine.vercel.app`）
2. **用手机扫描二维码或直接在手机浏览器中打开链接**
3. iOS 用户：首次访问需要点击 "Enable Motion Sensor" 按钮

---

## 方式二：使用 Netlify

### 快速拖拽部署
1. 访问：https://app.netlify.com/drop
2. 将项目文件夹直接拖拽到页面中
3. 等待部署完成
4. 获取 HTTPS 链接，用手机访问

### 或者 GitHub 集成
1. 访问：https://netlify.com
2. 点击 "Add new site" → "Import an existing project"
3. 选择 GitHub，授权并选择 `new-slot-machine` 仓库
4. 点击 "Deploy site"
5. 获取链接，用手机访问

---

## 方式三：GitHub Pages

1. 访问 GitHub 仓库页面
2. 点击 "Settings" → "Pages"
3. 在 "Source" 下选择分支 `claude/physics-text-animation-01Fyd1JZp12Hc8vNvy7ycyEv`
4. 点击 "Save"
5. 等待几分钟后，访问：`https://[你的用户名].github.io/new-slot-machine/`

---

## 方式四：本地测试（需要 HTTPS）

如果要在本地测试，必须使用 HTTPS，因为设备运动 API 需要安全上下文。

### 使用 ngrok（推荐）
```bash
# 1. 启动本地服务器
python3 -m http.server 8000

# 2. 在另一个终端中启动 ngrok
ngrok http 8000

# 3. 使用 ngrok 提供的 HTTPS 链接在手机上访问
```

### 使用 VS Code Live Server with HTTPS
1. 安装 "Live Server" 扩展
2. 配置 HTTPS
3. 右键点击 `index.html` → "Open with Live Server"

---

## 📱 手机访问提示

1. **确保使用 HTTPS**：设备运动 API 只在安全上下文中工作
2. **iOS 用户**：需要点击授权按钮才能使用运动传感器
3. **横屏/竖屏**：两种方向都可以，物理效果会自动适应
4. **晃动手机**：轻轻倾斜手机，观察文字的物理反应

---

## ✅ 推荐方案对比

| 方案 | 速度 | 难度 | HTTPS | 推荐度 |
|------|------|------|-------|--------|
| **Vercel** | ⚡️⚡️⚡️ | ⭐️ | ✅ | ⭐️⭐️⭐️⭐️⭐️ |
| **Netlify** | ⚡️⚡️⚡️ | ⭐️ | ✅ | ⭐️⭐️⭐️⭐️⭐️ |
| **GitHub Pages** | ⚡️⚡️ | ⭐️⭐️ | ✅ | ⭐️⭐️⭐️⭐️ |
| **本地 + ngrok** | ⚡️ | ⭐️⭐️⭐️ | ✅ | ⭐️⭐️⭐️ |

**最推荐：Vercel** - 部署最快，自动 HTTPS，全球 CDN 加速！
