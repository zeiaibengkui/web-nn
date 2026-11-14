import {
  Box,
  Button,
  Divider,
  Paper,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { RestartAltRounded } from '@mui/icons-material'
import type { EyeMethod } from '../types'

interface DetectionSettingsProps {
  method: EyeMethod
  threshold: number
  showMesh: boolean
  showEyeDetails: boolean
  canReset: boolean
  onMethodChange: (method: EyeMethod) => void
  onThresholdChange: (value: number) => void
  onShowMeshChange: (value: boolean) => void
  onShowEyeDetailsChange: (value: boolean) => void
  onReset: () => void
}

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.2 }}>
          {description}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        slotProps={{ input: { 'aria-label': title } }}
      />
    </Stack>
  )
}

export function DetectionSettings({
  method,
  threshold,
  showMesh,
  showEyeDetails,
  canReset,
  onMethodChange,
  onThresholdChange,
  onShowMeshChange,
  onShowEyeDetailsChange,
  onReset,
}: DetectionSettingsProps) {
  const isBlendshape = method === 'blendshape'

  return (
    <Paper
      component="section"
      sx={{
        p: { xs: 2.5, sm: 3 },
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        CONTROLS
      </Typography>
      <Typography variant="h3" sx={{ fontSize: '1.2rem', mt: 0.2 }}>
        检测参数
      </Typography>

      <Typography
        variant="body2"
        sx={{ mt: 2, mb: 0.8, color: 'text.secondary', fontWeight: 650 }}
      >
        判断方式
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={method}
        onChange={(_, value: EyeMethod | null) => {
          if (value) onMethodChange(value)
        }}
        aria-label="眼睛判断方式"
        sx={{
          '& .MuiToggleButton-root': {
            py: 1.1,
            fontSize: '0.76rem',
            fontWeight: 700,
            borderColor: 'divider',
          },
        }}
      >
        <ToggleButton value="blendshape">BLENDSHAPE</ToggleButton>
        <ToggleButton value="ear">几何 EAR</ToggleButton>
      </ToggleButtonGroup>

      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 2.4 }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {isBlendshape ? '闭眼阈值' : 'EAR 阈值'}
        </Typography>
        <Typography
          sx={{
            fontFamily:
              '"JetBrains Mono Variable", "JetBrains Mono", monospace',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {threshold.toFixed(2)}
        </Typography>
      </Stack>
      <Slider
        value={threshold}
        min={isBlendshape ? 0.25 : 0.1}
        max={isBlendshape ? 0.8 : 0.35}
        step={0.01}
        onChange={(_, value) => onThresholdChange(value as number)}
        aria-label={isBlendshape ? '闭眼阈值' : 'EAR 阈值'}
        size="small"
      />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {isBlendshape
          ? '双眼闭眼系数的平均值超过阈值时，计为闭眼。'
          : '双眼纵横比的平均值低于阈值时，计为闭眼。'}
      </Typography>

      <Divider sx={{ my: 2.3 }} />

      <Stack spacing={1.8}>
        <SettingSwitch
          title="FaceMesh 网格"
          description="显示 478 个面部关键点"
          checked={showMesh}
          onChange={onShowMeshChange}
        />
        <SettingSwitch
          title="眼部轮廓"
          description="突出双眼与虹膜关键点"
          checked={showEyeDetails}
          onChange={onShowEyeDetailsChange}
        />
      </Stack>

      <Button
        fullWidth
        variant="outlined"
        color="primary"
        startIcon={<RestartAltRounded />}
        onClick={onReset}
        disabled={!canReset}
        sx={{ mt: 2.5 }}
      >
        开始新的计数
      </Button>
    </Paper>
  )
}
