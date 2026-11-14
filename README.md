# Blinkline

一个基于 React、MUI 和 MediaPipe `@mediapipe/tasks-vision` 的实时眨眼识别页面。

应用使用 `FaceLandmarker` 在浏览器本地处理摄像头画面，输出 478 个面部关键点与 52 个表情混合值（blendshapes），并据此完成：

- 实时 FaceMesh、双眼和虹膜轮廓绘制
- `eyeBlinkLeft` / `eyeBlinkRight` 闭眼系数读取
- 基于关键点几何关系的 EAR（Eye Aspect Ratio）计算
- 眨眼次数、双眼开合度、会话时长和帧率统计
- 可调节的闭眼阈值与检测方式
- 摄像头、模型和权限错误的界面状态反馈
- 摄像头流、动画帧和 WASM 资源的完整清理
- 自动跟随系统偏好、可手动切换并持久保存的浅色/深色主题
- FaceMesh → Kalidokit → Live2D 的实时头部、眼睛、嘴型和眉毛驱动

界面完全使用 MUI 组件、主题与 `sx` 构建，没有自定义 CSS 文件。

## 快速开始

环境要求：

- Node.js 20 或更高版本
- 支持 `getUserMedia` 的现代浏览器
- 摄像头访问权限

安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```

打开终端中显示的本地地址，允许摄像头权限，然后点击“开启摄像头”。

生产构建与代码检查：

```bash
pnpm build
pnpm lint
```

## GitHub Pages

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到：

```text
https://<github-username>.github.io/web-nn/
```

Pages 的构建来源需要设置为 **GitHub Actions**。摄像头权限要求页面通过 HTTPS 访问，GitHub Pages 默认满足这一条件。

## Iframe 嵌入模式

在 URL 后添加 `?embed=1` 可以进入纯 Live2D 模式：

```text
https://zeiaibengkui.github.io/web-nn/?embed=1
```

该模式只渲染透明的 Live2D 画布，不显示标题、摄像头、统计面板或控制按钮。FaceMesh 仍会在隐藏的视频元素上运行，并在模型加载完成后自动申请摄像头权限。

跨域 iframe 必须显式允许摄像头：

```html
<iframe
  src="https://zeiaibengkui.github.io/web-nn/?embed=1"
  allow="camera"
  style="border: 0; width: 640px; height: 640px; background: transparent"
></iframe>
```

宿主页面和 iframe 背景都应保持透明。摄像头权限被拒绝时，在 iframe 内点击一次会在错误状态后重试权限请求。

## Linux 桌面应用

项目同时包含 Web 和 Electron 运行方式，共用 `src`、`public` 和 Live2D 模型资源。Linux 桌面版默认打开一个透明、无边框、始终置顶的 `?embed=1&desktop=1` 窗口。

开发模式：

```bash
pnpm desktop:dev
```

构建未打包目录和 Linux 安装包：

```bash
pnpm desktop:dir
pnpm desktop:build
```

`desktop:dir` 输出到 `release/linux-unpacked`，`desktop:build` 会生成 AppImage 和 deb。Linux 默认让 Chromium 自动选择 Wayland/X11。若当前桌面环境的透明合成不工作，可以尝试：

```bash
BLINKLINE_OZONE_PLATFORM=x11 pnpm desktop:dev
```

不建议默认强制 X11；部分 Wayland 环境中的 XWayland 会导致 GPU/WebGL 初始化不稳定。

桌面窗口支持：

- 拖动透明区域移动窗口
- 右键菜单切换点击穿透、置顶或退出
- `Ctrl+Shift+X` 切换点击穿透
- `Ctrl+Shift+A` 切换始终置顶
- 自动允许本地应用页面使用摄像头

点击穿透开启后，需要再次按 `Ctrl+Shift+X` 恢复窗口交互。

## 摄像头要求

浏览器只允许在安全上下文中访问摄像头：

- 开发环境使用 `http://localhost` 或 `http://127.0.0.1`
- 部署环境必须使用 HTTPS

如果页面通过局域网 IP 的普通 HTTP 地址访问，浏览器通常会拒绝摄像头权限。

第一次打开页面时会从 CDN 下载 MediaPipe WASM 和 FaceLandmarker 模型。视频帧只在浏览器本地推理，不会被上传；但 WASM 和模型文件本身需要联网加载。

## 项目结构

```text
src/
├── components/
│   ├── AppHeader.tsx          # 页面品牌与隐私状态
│   ├── CameraPanel.tsx        # 视频、Canvas、摄像头状态和绘制开关
│   ├── DetectionSettings.tsx  # 检测方式、阈值和显示设置
│   ├── EyeSignals.tsx         # 眨眼次数、双眼开合度和会话指标
│   └── Live2DPanel.tsx        # Pixi/Cubism 渲染与 Live2D 参数写入
├── hooks/
│   └── useFaceMesh.ts         # 模型生命周期、帧循环和 Canvas 绘制
├── lib/
│   ├── eyeMetrics.ts          # Blendshape、EAR 与开合度计算
│   ├── live2dMapping.ts       # Kalidokit 结果到 Live2D 参数的映射
│   └── format.ts              # 会话时间格式化
├── config/
│   └── live2d.ts               # 默认模型和 VITE_LIVE2D_MODEL_URL
├── App.tsx                    # 摄像头、眨眼状态机和页面组合
├── main.tsx                   # MUI ThemeProvider 与 CssBaseline
├── theme.ts                   # 颜色、字体、圆角和组件默认样式
└── types.ts                   # 状态与检测结果类型
```

## 检测流程

### 1. 初始化 FaceLandmarker

`useFaceMesh` 在组件挂载后创建一次 `FaceLandmarker`：

```ts
const vision = await FilesetResolver.forVisionTasks(WASM_PATH)

const landmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: MODEL_PATH,
    delegate: 'GPU',
  },
  runningMode: 'VIDEO',
  numFaces: 1,
  outputFaceBlendshapes: true,
})
```

如果当前设备无法使用 GPU delegate，会自动回退到 CPU。模型在组件卸载时会调用 `close()` 释放 WASM 内存。

### 2. 处理视频帧

检测循环使用 `requestAnimationFrame`，只在 `video.currentTime` 发生变化时调用 `detectForVideo`，避免重复处理同一帧：

```ts
if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
  lastVideoTime = video.currentTime
  const results = landmarker.detectForVideo(video, performance.now())
  // 绘制结果并更新指标
}
```

停止摄像头或组件卸载时，循环会通过 `cancelAnimationFrame` 停止。

### 3. 判断闭眼

页面提供两种判断方式，可在右侧“检测参数”中切换。

#### Blendshape

从 `faceBlendshapes[0].categories` 中读取左右眼闭眼系数：

```text
(eyeBlinkLeft + eyeBlinkRight) / 2 > threshold
```

默认阈值为 `0.50`。这种方式直接使用模型输出，响应快，适合实时眨眼检测。

#### 几何 EAR

使用左右眼各 6 个关键点计算眼睛纵横比：

```text
EAR = (|p2 - p6| + |p3 - p5|) / (2 × |p1 - p4|)
```

当双眼 EAR 的平均值低于阈值时视为闭眼。默认阈值为 `0.20`，不同摄像头、距离和面部比例可能需要微调。

### 4. 统计眨眼

眨眼计数器在“闭眼 → 睁眼”的变化沿累加，并要求闭眼状态持续至少 70ms、最多 1.5s：

- 过滤单帧噪声造成的误计数
- 忽略长时间闭眼或离开画面
- 丢失人脸时自动重置当前闭眼状态

检测方式的切换和“开始新的计数”操作也会重置眨眼状态机。

## Live2D 虚拟形象

Live2D 驱动链路分为三层：

1. `FaceLandmarker` 输出 478 个归一化面部关键点。
2. `Kalidokit.Face.solve()` 计算头部旋转、眼睛开合、瞳孔、嘴型和眉毛数值。
3. `pixi-live2d-display` 在 `beforeModelUpdate` 阶段将平滑后的参数写入 Cubism Core 模型。

当前会写入以下常用参数；模型缺少某个参数时会自动跳过：

```text
ParamAngleX / Y / Z
ParamBodyAngleX / Y / Z
ParamEyeLOpen / ParamEyeROpen
ParamEyeBallX / ParamEyeBallY
ParamMouthOpenY / ParamMouthForm
ParamBrowLY / ParamBrowRY
```

输入关键点会先复制一份再交给 Kalidokit，避免解算时对原始 FaceMesh 数据做单位转换。头部、眼睛和嘴型参数通过逐帧插值降低抖动，模型自带的呼吸、物理和待机动作仍然保留。

页面默认加载仓库内 [Senko_Normals](public/l2d-models/models/Senko_Normals/senko.model3.json) Cubism 4 模型。部署自己的模型时，设置模型设置文件 URL：

```bash
VITE_LIVE2D_MODEL_URL="https://example.com/your-model/model.model3.json" pnpm dev
```

也可以在项目根目录创建 `.env.local`：

```dotenv
VITE_LIVE2D_MODEL_URL=https://example.com/your-model/model.model3.json
```

也可以在运行时通过 `model_url` 查询参数切换模型，无需重新构建：

```text
https://zeiaibengkui.github.io/web-nn/?model_url=https%3A%2F%2Fexample.com%2Fyour-model%2Fmodel.model3.json
```

`model_url` 支持外部 HTTP(S) 地址和站内相对路径，例如 `/l2d-models/models/Hiyori/Hiyori.model3.json`。建议先对含特殊字符的 URL 使用 `encodeURIComponent`。非 HTTP(S) 地址会自动回退到默认模型。

使用 `model_name` 可以直接选择仓库内打包的 Cubism 4 模型：

```text
https://zeiaibengkui.github.io/web-nn/?model_name=hiyori
https://zeiaibengkui.github.io/web-nn/?embed=1&model_name=haru
```

可用值：`senko`、`haru`、`hiyori`、`mao`、`mark`、`natori`、`ren`、`rice`、`wanko`、`abeikelongbi_3`。大小写不敏感，也支持 `senko_normals` 作为 Senko 的别名。若同时提供 `model_url` 和 `model_name`，优先使用 `model_url`；未知名称会回退到 Senko。

非 embed 页面也可以直接在“虚拟形象”面板的模型下拉框中选择这些模型。切换后会把选择写入 `model_name` 查询参数，并立即重新加载模型。

模型中的所有相对资源必须能通过浏览器访问，并且服务器需要允许 CORS。请确保你拥有所用 Live2D 模型的授权。Cubism 4 Core 通过 `index.html` 中的官方脚本加载。

相关参考项目：[live2d-face-release](https://zkcpku.github.io/live2d-face-release/)

[hacxy/l2d-widget](https://github.com/hacxy/l2d-widget)

## 模型与性能配置

相关地址定义在 `src/hooks/useFaceMesh.ts`：

```ts
const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'

const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
```

为了保证 WASM 与当前 npm 包版本兼容，`WASM_PATH` 中固定了 `@mediapipe/tasks-vision@1.2.3`。升级依赖时请同步更新该版本号，或改为在本地托管 WASM 文件。

可继续调整的模型参数：

- `numFaces`：当前为 `1`
- `minFaceDetectionConfidence`：当前为 `0.6`
- `minFacePresenceConfidence`：当前为 `0.6`
- `minTrackingConfidence`：当前为 `0.55`

## 左右眼说明

MediaPipe 的 `eyeBlinkLeft` 和 `eyeBlinkRight` 对应被拍摄者自己的左眼和右眼，而不是观看者看到的画面左右方向。

页面为了提供自然的镜像自拍体验，对视频和 Canvas 使用了水平翻转。这个翻转只影响画面显示，不改变关键点和 blendshape 的索引含义。

## 常见问题

### 摄像头权限被拒绝

在浏览器地址栏的站点设置中重新允许摄像头访问，然后刷新页面。

### 一直停留在“正在准备 FaceMesh”

确认网络可以访问以下域名：

- `cdn.jsdelivr.net`
- `storage.googleapis.com`

企业网络、代理或广告拦截规则可能阻止模型和 WASM 下载。

### 画面正常但不能识别人脸

- 让整个面部进入画面，不要离镜头过近
- 避免强烈的逆光或过暗环境
- 保持正脸并减少快速转动
- 检查控制台是否出现 WebGL / WebGL2 相关错误

### 眨眼次数偏多或偏少

调整“闭眼阈值”：

- 误计数较多时，提高 Blendshape 阈值或降低 EAR 阈值
- 正常眨眼没有被记录时，降低 Blendshape 阈值或提高 EAR 阈值

### 性能较低

- 关闭 FaceMesh 网格可以减少 Canvas 绘制量
- 使用支持 GPU delegate 的最新版 Chrome 或 Edge
- 优先使用原生前置摄像头，而不是虚拟摄像头或远程视频流

### Live2D 模型加载失败

- 确认 `.model3.json`、`.moc3`、贴图和其他资源配置文件均可访问
- 检查模型的相对路径和远程服务器的 CORS 设置
- 确认模型使用 Cubism 4，并且 `live2dcubismcore.min.js` 已成功加载
- 当前实现默认使用标准 Cubism 参数名；自定义模型需要在 `Live2DPanel.tsx` 中调整参数映射

## 使用的技术

- React 19 + React Compiler
- Vite 8 + TypeScript
- MUI 9 + Emotion
- MediaPipe Tasks Vision 1.2.3
- Kalidokit 1.1.5
- PixiJS 6 + pixi-live2d-display 0.4
- RequestAnimationFrame 视频检测循环
