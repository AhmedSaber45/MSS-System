Add-Type -AssemblyName System.Drawing

$refPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$refImg = [System.Drawing.Bitmap]::FromFile($refPath)
$testDir = "c:\Users\Administrator\Desktop\System\scripts\extracted"
if (!(Test-Path $testDir)) { New-Item -ItemType Directory -Path $testDir -Force }

# ---------------------------------------------------------
# 1. Extract White Symbol (from Section 4 Black Box)
# Bounds: X=896..979 (W=84), Y=313..379 (H=67)
# ---------------------------------------------------------
$wX = 896; $wY = 313; $wW = 84; $wH = 67
# Expand by 1px margin for clean edge sampling
$wCropX = [Math]::Max(0, $wX - 2)
$wCropY = [Math]::Max(0, $wY - 2)
$wCropW = $wW + 4
$wCropH = $wH + 4

$whiteBmp = New-Object System.Drawing.Bitmap($wCropW, $wCropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $wCropH; $y++) {
    for ($x = 0; $x -lt $wCropW; $x++) {
        $srcP = $refImg.GetPixel($wCropX + $x, $wCropY + $y)
        # Background is black (R,G,B < 25)
        # Symbol is white (R,G,B > 50)
        $lum = [Math]::Round(0.299 * $srcP.R + 0.587 * $srcP.G + 0.114 * $srcP.B)
        if ($lum -lt 25) {
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            # Normalize alpha from 25..220 -> 0..255
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($lum - 25) / (200 - 25) * 255)))
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
    }
}
$whiteBmp.Save("$testDir\as_logo_white.png", [System.Drawing.Imaging.ImageFormat]::Png)
$whiteBmp.Dispose()
Write-Host "Saved as_logo_white.png"

# ---------------------------------------------------------
# 2. Extract Black Symbol (from Section 4 White Box)
# Bounds: X=724..811 (W=88), Y=313..380 (H=68)
# ---------------------------------------------------------
$bX = 724; $bY = 313; $bW = 88; $bH = 68
$bCropX = [Math]::Max(0, $bX - 2)
$bCropY = [Math]::Max(0, $bY - 2)
$bCropW = $bW + 4
$bCropH = $bH + 4

$blackBmp = New-Object System.Drawing.Bitmap($bCropW, $bCropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $bCropH; $y++) {
    for ($x = 0; $x -lt $bCropW; $x++) {
        $srcP = $refImg.GetPixel($bCropX + $x, $bCropY + $y)
        # Background is white (R,G,B > 240)
        # Symbol is black (R,G,B < 200)
        $lum = [Math]::Round(0.299 * $srcP.R + 0.587 * $srcP.G + 0.114 * $srcP.B)
        if ($lum -gt 240) {
            $blackBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Alpha based on darkness: lum 240..30 -> alpha 0..255
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round((240 - $lum) / (240 - 50) * 255)))
            $blackBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 15, 15, 15))
        }
    }
}
$blackBmp.Save("$testDir\as_logo_black.png", [System.Drawing.Imaging.ImageFormat]::Png)
$blackBmp.Dispose()
Write-Host "Saved as_logo_black.png"

# ---------------------------------------------------------
# 3. Extract Gold Symbol (Section 1)
# Bounds: X=60..329 (W=270), Y=84..298 (H=215)
# Background: (29, 25, 22). Blueprint lines: neutral gray (diff R-B < 20)
# Gold facets: R in 120..255, G in 80..200, B in 30..110, (R - B) > 35
# ---------------------------------------------------------
$gX = 60; $gY = 84; $gW = 270; $gH = 215
$goldBmp = New-Object System.Drawing.Bitmap($gW, $gH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Background color in Section 1
$bgR = 29.0; $bgG = 25.0; $bgB = 22.0

for ($y = 0; $y -lt $gH; $y++) {
    for ($x = 0; $x -lt $gW; $x++) {
        $srcP = $refImg.GetPixel($gX + $x, $gY + $y)
        $diffRB = $srcP.R - $srcP.B
        $diffRG = $srcP.R - $srcP.G
        
        # Check if this pixel belongs to the gold symbol
        # Blueprint lines: gray (diffRB < 25, or R < 90)
        # Background: R < 45, G < 40, B < 35
        $isGold = ($srcP.R -ge 85) -and ($diffRB -ge 30) -and ($diffRG -ge 10) -and ($srcP.G -ge 55)
        
        if (-not $isGold) {
            $goldBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Compute alpha for smooth antialiased edge
            # Distance from background color
            $dist = [Math]::Sqrt([Math]::Pow($srcP.R - $bgR, 2) + [Math]::Pow($srcP.G - $bgG, 2) + [Math]::Pow($srcP.B - $bgB, 2))
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round($dist / 80.0 * 255.0)))
            if ($dist -gt 75.0) { $alpha = 255 }
            
            # Decontaminate background color from antialiased border pixels
            $unmixedR = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.R - $bgR * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            $unmixedG = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.G - $bgG * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            $unmixedB = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.B - $bgB * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            
            $goldBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $unmixedR, $unmixedG, $unmixedB))
        }
    }
}
$goldBmp.Save("$testDir\as_logo_gold.png", [System.Drawing.Imaging.ImageFormat]::Png)
$goldBmp.Dispose()
Write-Host "Saved as_logo_gold.png"

# ---------------------------------------------------------
# 4. Extract Bronze Symbol (Section 3)
# Bounds: X=440..592 (W=153), Y=184..295 (H=112)
# Background: Cream (251, 248, 243).
# Bronze facets: dark brown/bronze (R < 180, G < 155, B < 140)
# ---------------------------------------------------------
$brX = 440; $brY = 184; $brW = 153; $brH = 112
$bronzeBmp = New-Object System.Drawing.Bitmap($brW, $brH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$creamR = 251.0; $creamG = 248.0; $creamB = 243.0

for ($y = 0; $y -lt $brH; $y++) {
    for ($x = 0; $x -lt $brW; $x++) {
        $srcP = $refImg.GetPixel($brX + $x, $brY + $y)
        
        # Check if pixel is bronze symbol (not cream background or faint blueprint line)
        # Blueprint lines: faint gray/cream (R > 210, G > 200, B > 195)
        # Symbol is darker: R < 185 and G < 165
        $isBronze = ($srcP.R -lt 185) -and ($srcP.G -lt 165)
        
        if (-not $isBronze) {
            $bronzeBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Compute alpha based on distance from cream background
            $dist = [Math]::Sqrt([Math]::Pow($srcP.R - $creamR, 2) + [Math]::Pow($srcP.G - $creamG, 2) + [Math]::Pow($srcP.B - $creamB, 2))
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round($dist / 100.0 * 255.0)))
            if ($dist -gt 90.0) { $alpha = 255 }
            
            # Decontaminate cream background from edge pixels
            $unmixedR = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.R - $creamR * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            $unmixedG = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.G - $creamG * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            $unmixedB = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($srcP.B - $creamB * (1 - $alpha/255.0)) / [Math]::Max(0.01, ($alpha/255.0)))))
            
            $bronzeBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $unmixedR, $unmixedG, $unmixedB))
        }
    }
}
$bronzeBmp.Save("$testDir\as_logo_bronze.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bronzeBmp.Dispose()
Write-Host "Saved as_logo_bronze.png"

# ---------------------------------------------------------
# 5. Extract App Icon Tile (Section 5)
# Bounds: X=37..135 (W=99), Y=449..544 (H=96)
# ---------------------------------------------------------
$tX = 37; $tY = 449; $tW = 99; $tH = 96
$tileBmp = New-Object System.Drawing.Bitmap($tW, $tH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$tCreamR = 251.0; $tCreamG = 248.0; $tCreamB = 243.0

for ($y = 0; $y -lt $tH; $y++) {
    for ($x = 0; $x -lt $tW; $x++) {
        $srcP = $refImg.GetPixel($tX + $x, $tY + $y)
        # Background is cream (R > 230, G > 220, B > 215)
        # Tile is dark (R < 150)
        $isTile = ($srcP.R -lt 220) -or ($srcP.G -lt 210)
        if (-not $isTile) {
            $tileBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $dist = [Math]::Sqrt([Math]::Pow($srcP.R - $tCreamR, 2) + [Math]::Pow($srcP.G - $tCreamG, 2) + [Math]::Pow($srcP.B - $tCreamB, 2))
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round($dist / 80.0 * 255.0)))
            if ($dist -gt 70.0) { $alpha = 255 }
            $tileBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $srcP.R, $srcP.G, $srcP.B))
        }
    }
}
$tileBmp.Save("$testDir\as_icon_tile.png", [System.Drawing.Imaging.ImageFormat]::Png)
$tileBmp.Dispose()
Write-Host "Saved as_icon_tile.png"

$refImg.Dispose()
