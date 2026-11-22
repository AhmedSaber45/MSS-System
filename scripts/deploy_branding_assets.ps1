Add-Type -AssemblyName System.Drawing

$baseDir = "c:\Users\Administrator\Desktop\System"
$sourceDir = "$baseDir\scripts\extracted"

# Target directories
$publicBranding = "$baseDir\public\assets\branding"
$srcBranding = "$baseDir\src\assets\branding"
$adminBranding = "$baseDir\admin-dashboard\public\assets\branding"
$tauriIcons = "$baseDir\src-tauri\icons"

foreach ($dir in @($publicBranding, $srcBranding, $adminBranding, $tauriIcons)) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# 1. Copy transparent brand assets
$brandFiles = @(
    "as_logo_gold.png",
    "as_logo_bronze.png",
    "as_logo_white.png",
    "as_logo_black.png",
    "master_app_icon_512.png"
)

foreach ($f in $brandFiles) {
    Copy-Item "$sourceDir\$f" "$publicBranding\$f" -Force
    Copy-Item "$sourceDir\$f" "$srcBranding\$f" -Force
    Copy-Item "$sourceDir\$f" "$adminBranding\$f" -Force
}
Copy-Item "$sourceDir\master_app_icon_512.png" "$publicBranding\as_icon_512.png" -Force
Copy-Item "$sourceDir\master_app_icon_512.png" "$srcBranding\as_icon_512.png" -Force
Copy-Item "$sourceDir\master_app_icon_512.png" "$adminBranding\as_icon_512.png" -Force

Write-Host "Brand logo assets copied to public, src, and admin-dashboard branding directories."

# 2. Generate Tauri App Icons from master_app_icon_512.png
$master = [System.Drawing.Bitmap]::FromFile("$sourceDir\master_app_icon_512.png")

function Resize-And-Save($srcBmp, $w, $h, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcBmp, [System.Drawing.Rectangle]::new(0, 0, $w, $h))
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $destPath ($($w)x$($h))"
}

# Standard Tauri icon sizes
Resize-And-Save $master 512 512 "$tauriIcons\icon.png"
Resize-And-Save $master 256 256 "$tauriIcons\128x128@2x.png"
Resize-And-Save $master 128 128 "$tauriIcons\128x128.png"
Resize-And-Save $master 64 64 "$tauriIcons\64x64.png"
Resize-And-Save $master 32 32 "$tauriIcons\32x32.png"

# Windows UWP/Square tile sizes
Resize-And-Save $master 30 30 "$tauriIcons\Square30x30Logo.png"
Resize-And-Save $master 44 44 "$tauriIcons\Square44x44Logo.png"
Resize-And-Save $master 71 71 "$tauriIcons\Square71x71Logo.png"
Resize-And-Save $master 89 89 "$tauriIcons\Square89x89Logo.png"
Resize-And-Save $master 107 107 "$tauriIcons\Square107x107Logo.png"
Resize-And-Save $master 142 142 "$tauriIcons\Square142x142Logo.png"
Resize-And-Save $master 150 150 "$tauriIcons\Square150x150Logo.png"
Resize-And-Save $master 284 284 "$tauriIcons\Square284x284Logo.png"
Resize-And-Save $master 310 310 "$tauriIcons\Square310x310Logo.png"
Resize-And-Save $master 50 50 "$tauriIcons\StoreLogo.png"

# 3. Generate Multi-Resolution Windows ICO file
# Modern Windows ICO format embeds PNG bytes for each size: 16, 24, 32, 48, 64, 128, 256
$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytesList = @()

foreach ($sz in $icoSizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($master, [System.Drawing.Rectangle]::new(0, 0, $sz, $sz))
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,@($sz, $ms.ToArray())
    $ms.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

$icoPath = "$tauriIcons\icon.ico"
$icoStream = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($icoStream)

# ICONDIR header (6 bytes)
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = ICO
$bw.Write([uint16]$icoSizes.Count) # Number of images

# Calculate offset for first image data
# Header (6) + (Count * 16)
$dataOffset = 6 + ($icoSizes.Count * 16)

# Write ICONDIRENTRY for each size
foreach ($item in $pngBytesList) {
    $sz = $item[0]
    $data = $item[1]
    
    $dimByte = [byte]0
    if ($sz -lt 256) { $dimByte = [byte]$sz }
    
    $bw.Write($dimByte) # Width
    $bw.Write($dimByte) # Height
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bit count
    $bw.Write([uint32]$data.Length) # Image data bytes
    $bw.Write([uint32]$dataOffset) # Offset
    
    $dataOffset += $data.Length
}

# Write raw PNG byte streams
foreach ($item in $pngBytesList) {
    $data = $item[1]
    $bw.Write($data, 0, $data.Length)
}

$bw.Flush()
$bw.Close()
$icoStream.Dispose()
Write-Host "Generated multi-resolution icon.ico ($($icoSizes -join ', ') px)"

# Also create public/favicon.ico
Copy-Item "$tauriIcons\icon.ico" "$baseDir\public\favicon.ico" -Force
Copy-Item "$tauriIcons\icon.ico" "$baseDir\admin-dashboard\public\favicon.ico" -Force
Write-Host "Copied favicon.ico to public and admin-dashboard/public"

$master.Dispose()
Write-Host "All branding assets generated and deployed successfully."
