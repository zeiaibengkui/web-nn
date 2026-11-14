import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  CenterFocusStrongRounded,
  ErrorOutlineRounded,
  GridOnRounded,
  GridOffRounded,
  ReplayRounded,
  VideocamOffRounded,
  VideocamRounded,
} from '@mui/icons-material'
import type { CameraStatus, ModelStatus } from '../types'

interface CameraPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  cameraStatus: CameraStatus
  modelStatus: ModelStatus
  modelError: string | null
  cameraError: string | null
  hasFace: boolean
  fps: number
  showMesh: boolean
  onToggleMesh: () => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export function CameraPanel({
  videoRef,
  canvasRef,
  cameraStatus,
  modelStatus,
  modelError,
  cameraError,
  hasFace,
  fps,
  showMesh,
  onToggleMesh,
  onStart,
  onStop,
  onReset,
}: CameraPanelProps) {
  const isActive = cameraStatus === 'active'
  const isRequesting = cameraStatus === 'requesting'
  const isModelLoading = modelStatus === 'loading'
  const hasError = cameraStatus === 'error' || modelStatus === 'error'
  const errorMessage =
    cameraError ??
    (modelStatus === 'error'
      ? modelError || '识别模型加载失败，请检查网络后重试。'
      : null)

  return (
    <Paper
      component="section"
      sx={{
        overflow: 'hidden',
        bgcolor: '#111510',
        color: 'common.white',
        border: 1,
        borderColor: '#242b22',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CenterFocusStrongRounded
            sx={{ fontSize: 19, color: 'secondary.main' }}
          />
          <Typography variant="h3">实时画面</Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={
              isActive
                ? hasFace
                  ? '已锁定人脸'
                  : '寻找人脸'
                : isModelLoading
                  ? '引擎加载中'
                  : modelStatus === 'error'
                    ? '引擎异常'
                    : '摄像头待机'
            }
            size="small"
            sx={{
              height: 28,
              bgcolor: isActive && hasFace ? 'secondary.main' : 'transparent',
              color: isActive && hasFace ? 'secondary.contrastText' : '#d4dbd0',
              border: 1,
              borderColor:
                isActive && hasFace
                  ? 'secondary.main'
                  : 'rgba(255, 255, 255, 0.18)',
              '& .MuiChip-label': { px: 1.25 },
            }}
          />
          <Tooltip title={showMesh ? '隐藏网格' : '显示网格'}>
            <IconButton
              size="small"
              onClick={onToggleMesh}
              aria-label={showMesh ? '隐藏 FaceMesh 网格' : '显示 FaceMesh 网格'}
              sx={{
                color: showMesh ? 'secondary.main' : '#8d9689',
                border: 1,
                borderColor: 'rgba(255, 255, 255, 0.14)',
              }}
            >
              {showMesh ? (
                <GridOnRounded fontSize="small" />
              ) : (
                <GridOffRounded fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          bgcolor: '#090b09',
          overflow: 'hidden',
        }}
      >
        <Box
          component="video"
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="摄像头实时画面"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            visibility: isActive ? 'visible' : 'hidden',
          }}
        />
        <Box
          component="canvas"
          ref={canvasRef}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
            visibility: isActive ? 'visible' : 'hidden',
          }}
        />

        {!isActive && (
          <Stack
            spacing={2}
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 3,
              py: 4,
              color: '#f3f6ef',
            }}
          >
            <Box
              sx={{
                width: 68,
                height: 68,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                border: 1,
                borderColor: hasError
                  ? 'rgba(255, 154, 133, 0.4)'
                  : 'rgba(255, 255, 255, 0.18)',
                color: hasError ? '#ffb09f' : 'secondary.main',
                bgcolor: 'rgba(255, 255, 255, 0.045)',
              }}
            >
              {hasError ? (
                <ErrorOutlineRounded sx={{ fontSize: 30 }} />
              ) : isModelLoading ? (
                <CircularProgress
                  size={28}
                  thickness={4}
                  sx={{ color: 'secondary.main' }}
                />
              ) : (
                <VideocamOffRounded sx={{ fontSize: 30 }} />
              )}
            </Box>
            <Box sx={{ maxWidth: 430 }}>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.35rem', sm: '1.65rem' },
                  fontWeight: 750,
                  letterSpacing: '-0.035em',
                }}
              >
                {hasError
                  ? '暂时无法启动识别'
                  : isModelLoading
                    ? '正在准备 FaceMesh'
                    : '把脸放进画面中央'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.8,
                  color: '#aeb7a9',
                  lineHeight: 1.65,
                }}
              >
                {errorMessage ??
                  (isModelLoading
                    ? '首次加载需要下载轻量模型，之后会快很多。'
                    : '开启摄像头后，眨一次眼，观察双眼信号如何变化。')}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              onClick={onStart}
              disabled={
                isRequesting ||
                isModelLoading ||
                modelStatus === 'error'
              }
              startIcon={
                isRequesting ? (
                  <CircularProgress
                    size={16}
                    thickness={5}
                    sx={{ color: 'inherit' }}
                  />
                ) : (
                  <VideocamRounded />
                )
              }
            >
              {isRequesting
                ? '正在连接'
                : isModelLoading
                  ? '模型加载中'
                  : modelStatus === 'error'
                    ? '刷新页面重试'
                    : '开启摄像头'}
            </Button>
          </Stack>
        )}

        {isActive && (
          <Box
            sx={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              display: 'flex',
              gap: 1,
            }}
          >
            <Chip
              label={`${fps || '--'} FPS`}
              size="small"
              sx={{
                bgcolor: 'rgba(10, 13, 9, 0.72)',
                color: '#f6f8f3',
                border: 1,
                borderColor: 'rgba(255, 255, 255, 0.16)',
                '& .MuiChip-label': {
                  fontFamily:
                    '"JetBrains Mono Variable", "JetBrains Mono", monospace',
                  fontSize: '0.69rem',
                },
              }}
            />
            <Chip
              label="478 点"
              size="small"
              sx={{
                bgcolor: 'rgba(10, 13, 9, 0.72)',
                color: '#c8f169',
                border: 1,
                borderColor: 'rgba(200, 241, 105, 0.25)',
                '& .MuiChip-label': {
                  fontFamily:
                    '"JetBrains Mono Variable", "JetBrains Mono", monospace',
                  fontSize: '0.69rem',
                },
              }}
            />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.6,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          borderTop: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          bgcolor: '#171c16',
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: '#899284', letterSpacing: '0.08em' }}
        >
          MediaPipe FaceLandmarker · VIDEO
        </Typography>
        {isActive ? (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              color="inherit"
              startIcon={<ReplayRounded />}
              onClick={onReset}
              sx={{ color: '#d9dfd5' }}
            >
              重置计数
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<VideocamOffRounded />}
              onClick={onStop}
              sx={{
                color: '#ffffff',
                borderColor: 'rgba(255, 255, 255, 0.25)',
              }}
            >
              停止
            </Button>
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: '#899284' }}>
            视频帧不会离开这台设备
          </Typography>
        )}
      </Box>

      {cameraStatus === 'error' && cameraError && (
        <Alert
          severity="error"
          variant="filled"
          sx={{ borderRadius: 0, py: 0.4 }}
        >
          {cameraError}
        </Alert>
      )}
    </Paper>
  )
}
