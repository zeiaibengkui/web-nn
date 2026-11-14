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
- 9 点校准、平滑处理和全屏光标显示的近似视线落点估计

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
│   ├── GazeCalibrationDialog.tsx # 全屏 9 点取样流程
│   └── GazePanel.tsx          # 视线落点、校准状态和全屏光标
├── hooks/
│   └── useFaceMesh.ts         # 模型生命周期、帧循环和 Canvas 绘制
├── lib/
│   ├── gazeEstimation.ts      # 虹膜特征、岭回归与视线预测
│   ├── eyeMetrics.ts          # Blendshape、EAR 与开合度计算
│   └── format.ts              # 会话时间格式化
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

## 视线位置估计

摄像头开启后，可以在“视线落点”面板中运行 9 点校准。校准点覆盖整个浏览器视口，每个点先留出稳定时间，再采集约 1.3 秒的虹膜特征。

使用的输入特征包括：

- 左右虹膜中心相对于各自眼眶的位置
- 鼻尖相对于双眼中心和双眼距离的偏移，用于补偿轻微头部移动
- 虹膜横纵位置的多项式组合

每个校准点先聚合为平均特征，再通过带正则项的最小二乘回归拟合到归一化视口坐标。实时结果使用指数平滑降低光标抖动，并通过 `requestAnimationFrame` 数据流持续更新；以下情况会隐藏落点：

- 没有检测到完整人脸
- 用户正在眨眼
- 当前会话尚未完成校准

估计结果是近似区域，不应视为精确眼动仪测量。改变坐姿、观看距离、摄像头角度或浏览器窗口尺寸后，建议重新校准。校准模型目前仅保存在当前页面会话中。

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

### 视线落点跳动或偏差较大

- 在每个校准点出现后保持视线稳定，尽量只移动眼睛
- 保持校准时的坐姿、观看距离和窗口尺寸
- 避免逆光、镜片反光和头部快速移动
- 重新执行完整的 9 点校准

## 使用的技术

- React 19 + React Compiler
- Vite 8 + TypeScript
- MUI 9 + Emotion
- MediaPipe Tasks Vision 1.2.3
- RequestAnimationFrame 视频检测循环
