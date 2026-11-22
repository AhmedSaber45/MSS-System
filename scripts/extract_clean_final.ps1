Add-Type -AssemblyName System.Drawing

$refPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$refImg = [System.Drawing.Bitmap]::FromFile($refPath)
$outDir = "c:\Users\Administrator\Desktop\System\scripts\extracted"

# -------------------------------------------------------------------------
# 1. GOLD SYMBOL (Section 1) -> as_logo_gold.png
# Crop: X=75..325 (W=250), Y=55..215 (H=160)
# Background: Dark brown/black (~29, 25, 22)
# Blueprint lines: gray (lum ~70-110, diff R-B < 25)
# Gold facets: R >= 120, G >= 75, (R - B) >= 30, warm amber tones
# ---------------------------------------------------------
$gX = 75; $gY = 55; $gW = 250; $gH = 160
$goldBmp = New-Object System.Drawing.Bitmap($gW, $gH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgR = 29.0; $bgG = 25.0; $bgB = 22.0

for ($y = 0; $y -lt $gH; $y++) {
    for ($x = 0; $x -lt $gW; $x++) {
        $p = $refImg.GetPixel($gX + $x, $gY + $y)
        $diffRB = $p.R - $p.B
        $diffRG = $p.R - $p.G
        
        # Gold pixel detection:
        # A true gold pixel has high R, moderate G, low B, and (R-B) is strongly positive
        # Blueprint lines: faint gray where diffRB is small (<25)
        # Background: dark (R < 50, G < 45, B < 40)
        $isGold = ($p.R -ge 85) -and ($diffRB -ge 28) -and ($diffRG -ge 8) -and ($p.G -ge 50)
        
        if (-not $isGold) {
            $goldBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Compute distance from dark background for antialiasing
            $dist = [Math]::Sqrt([Math]::Pow($p.R - $bgR, 2) + [Math]::Pow($p.G - $bgG, 2) + [Math]::Pow($p.B - $bgB, 2))
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round($dist / 65.0 * 255.0)))
            if ($dist -gt 60.0) { $alpha = 255 }
            
            # Decontaminate background color from semi-transparent edge pixels
            $aNorm = [Math]::Max(0.05, ($alpha / 255.0))
            $unmixedR = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.R - $bgR * (1 - $aNorm)) / $aNorm)))
            $unmixedG = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.G - $bgG * (1 - $aNorm)) / $aNorm)))
            $unmixedB = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.B - $bgB * (1 - $aNorm)) / $aNorm)))
            
            $goldBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $unmixedR, $unmixedG, $unmixedB))
        }
    }
}

# Auto-crop bounding box of non-empty pixels in $goldBmp
function Crop-Transparent($src) {
    $minX = $src.Width; $maxX = 0; $minY = $src.Height; $maxY = 0
    for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
            $p = $src.GetPixel($x, $y)
            if ($p.A -gt 15) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    # Add 2px transparent padding
    $pad = 2
    $cW = ($maxX - $minX + 1) + ($pad * 2)
    $cH = ($maxY - $minY + 1) + ($pad * 2)
    $dest = New-Object System.Drawing.Bitmap($cW, $cH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.DrawImage($src, [System.Drawing.Rectangle]::new($pad, $pad, ($maxX - $minX + 1), ($maxY - $minY + 1)), [System.Drawing.Rectangle]::new($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $dest
}

$cleanGold = Crop-Transparent $goldBmp
$cleanGold.Save("$outDir\as_logo_gold.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cleanGold.Dispose()
$goldBmp.Dispose()
Write-Host "Saved clean as_logo_gold.png"

# -------------------------------------------------------------------------
# 2. BRONZE SYMBOL (Section 3) -> as_logo_bronze.png
# Crop: X=445..595 (W=150), Y=210..312 (H=102)
# Background: Cream (~251, 248, 243)
# Blueprint lines: faint gray/cream (lum > 200)
# Bronze facets: dark bronze/charcoal (R < 180, G < 155, B < 140)
# -------------------------------------------------------------------------
$brX = 445; $brY = 210; $brW = 150; $brH = 102
$bronzeBmp = New-Object System.Drawing.Bitmap($brW, $brH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$creamR = 251.0; $creamG = 248.0; $creamB = 243.0

for ($y = 0; $y -lt $brH; $y++) {
    for ($x = 0; $x -lt $brW; $x++) {
        $p = $refImg.GetPixel($brX + $x, $brY + $y)
        $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
        
        # Bronze symbol has lum < 185
        # Blueprint lines and background have lum > 200
        $isBronze = ($lum -lt 190) -and ($p.R -lt 190) -and ($p.G -lt 170)
        
        if (-not $isBronze) {
            $bronzeBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Compute distance from cream background
            $dist = [Math]::Sqrt([Math]::Pow($p.R - $creamR, 2) + [Math]::Pow($p.G - $creamG, 2) + [Math]::Pow($p.B - $creamB, 2))
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round($dist / 85.0 * 255.0)))
            if ($dist -gt 80.0) { $alpha = 255 }
            
            # Decontaminate cream background
            $aNorm = [Math]::Max(0.05, ($alpha / 255.0))
            $unmixedR = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.R - $creamR * (1 - $aNorm)) / $aNorm)))
            $unmixedG = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.G - $creamG * (1 - $aNorm)) / $aNorm)))
            $unmixedB = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($p.B - $creamB * (1 - $aNorm)) / $aNorm)))
            
            $bronzeBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $unmixedR, $unmixedG, $unmixedB))
        }
    }
}

$cleanBronze = Crop-Transparent $bronzeBmp
$cleanBronze.Save("$outDir\as_logo_bronze.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cleanBronze.Dispose()
$bronzeBmp.Dispose()
Write-Host "Saved clean as_logo_bronze.png"

# -------------------------------------------------------------------------
# 3. MONOCHROME WHITE SYMBOL -> as_logo_white.png
# -------------------------------------------------------------------------
$wX = 896; $wY = 313; $wW = 84; $wH = 67
$whiteBmp = New-Object System.Drawing.Bitmap($wW, $wH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $wH; $y++) {
    for ($x = 0; $x -lt $wW; $x++) {
        $p = $refImg.GetPixel($wX + $x, $wY + $y)
        $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
        if ($lum -lt 25) {
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round(($lum - 20) / (200 - 20) * 255)))
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
    }
}
$cleanWhite = Crop-Transparent $whiteBmp
$cleanWhite.Save("$outDir\as_logo_white.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cleanWhite.Dispose()
$whiteBmp.Dispose()
Write-Host "Saved clean as_logo_white.png"

# -------------------------------------------------------------------------
# 4. MONOCHROME BLACK SYMBOL -> as_logo_black.png
# -------------------------------------------------------------------------
$bX = 724; $bY = 313; $bW = 88; $bH = 68
$blackBmp = New-Object System.Drawing.Bitmap($bW, $bH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $bH; $y++) {
    for ($x = 0; $x -lt $bW; $x++) {
        $p = $refImg.GetPixel($bX + $x, $bY + $y)
        $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
        if ($lum -gt 235) {
            $blackBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 15, 15, 15))
        } else {
            $alpha = [Math]::Min(255, [Math]::Max(0, [Math]::Round((235 - $lum) / (235 - 50) * 255)))
            $blackBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 15, 15, 15))
        }
    }
}
$cleanBlack = Crop-Transparent $blackBmp
$cleanBlack.Save("$outDir\as_logo_black.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cleanBlack.Dispose()
$blackBmp.Dispose()
Write-Host "Saved clean as_logo_black.png"

$refImg.Dispose()
