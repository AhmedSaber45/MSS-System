Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

$outputDir = "c:\Users\Administrator\Desktop\System\scripts\crops"
if (!(Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force }

# Let's crop sample regions to inspect
# 1. Monochome White on Dark (section 4)
# 2. Monochrome Black on Light (section 4)
# 3. Bronze on light (section 3)
# 4. App icon rounded tile (section 5)
# 5. Standalone gold symbol (section 2)

function Save-Crop($rect, $name) {
    $bmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save("$outputDir\$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Saved $name : $($rect.X),$($rect.Y) - $($rect.Width)x$($rect.Height)"
}

# Estimated coordinates based on 1024x571:
# Section 4: Monochrome variations
# Black symbol on white
Save-Crop ([System.Drawing.Rectangle]::new(690, 275, 150, 115)) "mono_black"
# White symbol on black
Save-Crop ([System.Drawing.Rectangle]::new(855, 275, 150, 115)) "mono_white"

# Section 5: App icon previews (bottom left)
Save-Crop ([System.Drawing.Rectangle]::new(35, 430, 105, 105)) "icon_tile_1"
Save-Crop ([System.Drawing.Rectangle]::new(165, 440, 75, 75)) "icon_tile_2"

# Section 3: Light variation bronze symbol
Save-Crop ([System.Drawing.Rectangle]::new(450, 190, 150, 105)) "bronze_symbol"

# Section 2: Gold standalone symbol (with grid)
Save-Crop ([System.Drawing.Rectangle]::new(730, 60, 210, 160)) "gold_standalone"

# Section 1: Main lockup gold symbol
Save-Crop ([System.Drawing.Rectangle]::new(100, 60, 200, 160)) "gold_main"

$img.Dispose()
