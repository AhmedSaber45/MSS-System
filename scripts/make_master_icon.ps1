Add-Type -AssemblyName System.Drawing

$goldPath = "c:\Users\Administrator\Desktop\System\scripts\extracted\as_logo_gold.png"
$goldBmp = [System.Drawing.Bitmap]::FromFile($goldPath)

# Create 512x512 Master App Icon
$masterSize = 512
$iconBmp = New-Object System.Drawing.Bitmap($masterSize, $masterSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($iconBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Clear transparent
$g.Clear([System.Drawing.Color]::Transparent)

# Draw Rounded Dark Rectangle Tile (matching Section 5)
# Background color in Section 5 is dark warm charcoal: R=30, G=26, B=23 (#1e1a17)
# Border/highlight: slightly lighter R=42, G=36, B=32
$tileRect = New-Object System.Drawing.Rectangle(16, 16, 480, 480)
$cornerRadius = 104

# Create GraphicsPath for rounded rectangle
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $cornerRadius * 2
$path.AddArc($tileRect.X, $tileRect.Y, $d, $d, 180, 90)
$path.AddArc($tileRect.Right - $d, $tileRect.Y, $d, $d, 270, 90)
$path.AddArc($tileRect.Right - $d, $tileRect.Bottom - $d, $d, $d, 0, 90)
$path.AddArc($tileRect.X, $tileRect.Bottom - $d, $d, $d, 90, 90)
$path.CloseFigure()

# Fill tile with subtle dark gradient (from top: #241f1c to bottom: #181412)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $tileRect,
    [System.Drawing.Color]::FromArgb(255, 36, 31, 28),
    [System.Drawing.Color]::FromArgb(255, 24, 20, 18),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g.FillPath($brush, $path)

# Subtle border highlight
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 2.0)
$g.DrawPath($pen, $path)

# Calculate centered position for the Gold AS Logo inside the tile
# Let target symbol width be ~68% of tile width: ~326 px
$targetW = 326
$targetH = [Math]::Round($targetW * ($goldBmp.Height / $goldBmp.Width))
$targetX = [Math]::Round(($masterSize - $targetW) / 2)
$targetY = [Math]::Round(($masterSize - $targetH) / 2)

$g.DrawImage($goldBmp, [System.Drawing.Rectangle]::new($targetX, $targetY, $targetW, $targetH))

$outPath = "c:\Users\Administrator\Desktop\System\scripts\extracted\master_app_icon_512.png"
$iconBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$brush.Dispose()
$pen.Dispose()
$path.Dispose()
$g.Dispose()
$iconBmp.Dispose()
$goldBmp.Dispose()

Write-Host "Generated master_app_icon_512.png"
