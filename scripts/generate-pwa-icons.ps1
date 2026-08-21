param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\public\icons")
)

Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

function New-RoundedPath([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-AppIcon([int]$Size, [string]$Path) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#061111"))

  $scale = $Size / 512.0
  $inner = New-RoundedPath (48 * $scale) (48 * $scale) (416 * $scale) (416 * $scale) (78 * $scale)
  $innerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0c2222"))
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#22d3ee"), 18 * $scale)
  $graphics.FillPath($innerBrush, $inner)
  $graphics.DrawPath($borderPen, $inner)

  $linePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#34d399"), 22 * $scale)
  $linePen.StartCap = $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($linePen, 142 * $scale, 342 * $scale, 256 * $scale, 168 * $scale)
  $graphics.DrawLine($linePen, 256 * $scale, 168 * $scale, 370 * $scale, 342 * $scale)
  $graphics.DrawLine($linePen, 142 * $scale, 342 * $scale, 370 * $scale, 342 * $scale)

  $cyanBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#22d3ee"))
  $lightPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#d9fbff"), 12 * $scale)
  foreach ($circle in @(@(208,104,96), @(90,312,84), @(338,312,84))) {
    $graphics.FillEllipse($cyanBrush, $circle[0] * $scale, $circle[1] * $scale, $circle[2] * $scale, $circle[2] * $scale)
    $graphics.DrawEllipse($lightPen, $circle[0] * $scale, $circle[1] * $scale, $circle[2] * $scale, $circle[2] * $scale)
  }

  $triangle = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(238 * $scale, 126 * $scale),
    [System.Drawing.PointF]::new(288 * $scale, 152 * $scale),
    [System.Drawing.PointF]::new(238 * $scale, 179 * $scale)
  )
  $darkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#061111"))
  $graphics.FillPolygon($darkBrush, $triangle)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $darkBrush.Dispose(); $lightPen.Dispose(); $cyanBrush.Dispose(); $linePen.Dispose()
  $borderPen.Dispose(); $innerBrush.Dispose(); $inner.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-AppIcon 192 (Join-Path $OutputDirectory "icon-192.png")
New-AppIcon 512 (Join-Path $OutputDirectory "icon-512.png")
New-AppIcon 180 (Join-Path $OutputDirectory "apple-touch-icon.png")
