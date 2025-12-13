# Turn Horizontal - Physics Text Animation

一个基于真实物理引擎的手机交互程序，展示剪贴风格的文字悬挂在丝滑的绳子上，响应手机晃动。

## 功能特点

- ✂️ **剪贴字母效果**：每个字母都像是从报纸或杂志上剪切拼贴而成
- 🧵 **柔软丝滑的绳子**：使用物理引擎模拟真实的丝绸质感
- 📱 **重力感应**：晃动手机，文字会随之摆动
- 🎨 **极简设计**：白色背景，无投影，安静统一的真实质感
- 👋 **智能消失**：当文字完全超出屏幕后，自动消失

## 技术栈

- HTML5 Canvas
- Matter.js (物理引擎)
- Device Orientation API (重力感应)

## 使用方法

### 方法一：本地测试

1. 克隆此仓库
2. 使用本地服务器运行（必须使用 HTTPS 才能在手机上使用重力感应）

```bash
# 使用 Python 3
python3 -m http.server 8000

# 或使用 Node.js
npx http-server
```

3. 在手机浏览器中访问你的本地 IP 地址

### 方法二：部署到 GitHub Pages

1. 推送代码到 GitHub
2. 在仓库设置中启用 GitHub Pages
3. 使用手机访问生成的 HTTPS 链接

### 方法三：使用 Vercel/Netlify 部署

最简单的方法是使用免费的静态网站托管服务：

**Vercel:**
1. 访问 [vercel.com](https://vercel.com)
2. 导入此 GitHub 仓库
3. 自动部署后，使用手机访问生成的链接

**Netlify:**
1. 访问 [netlify.com](https://netlify.com)
2. 拖拽项目文件夹到 Netlify
3. 使用手机访问生成的链接

## iOS 用户注意

在 iOS 13+ 设备上，首次访问时需要点击"Enable Motion Sensor"按钮来授权使用设备运动传感器。

## 交互说明

1. 打开网页后，您会看到"TURN HORIZONTAL"文字悬挂在屏幕中上部
2. 晃动手机，文字会随着手机的倾斜方向摆动
3. 持续晃动可以让文字飞出屏幕
4. 一旦文字完全离开屏幕，它就会永久消失

## 文件结构

```
.
├── index.html          # 主 HTML 文件
├── app.js             # 物理引擎和交互逻辑
└── README.md          # 说明文档
```

## 浏览器兼容性

- ✅ iOS Safari 13+
- ✅ Chrome Mobile
- ✅ Firefox Mobile
- ✅ Samsung Internet

## 许可证

MIT License
