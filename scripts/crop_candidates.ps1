Add-Type -AssemblyName System.Drawing
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# In Section 1, let's crop X from 80 to 320, and test Y ranges:
# Let's save slices:
# Y: 50 to 220 (symbol)
# Y: 220 to 320 (text)

$symCrop = New-Object System.Drawing.Bitmap(240, 160)
$g = [System.Drawing.Graphics]::FromImage($symCrop)
$g.DrawImage($refImg, [System.Drawing.Rectangle]::new(0,0,240,160), [System.Drawing.Rectangle]::new(80,50,240,160), [System.Drawing.GraphicsUnit]::Pixel)
$symCrop.Save("c:\Users\Administrator\Desktop\System\scripts\crops\sec1_symbol_only.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $symCrop.Dispose()

# Also let's check Section 2 (THE GEOMETRIC SYMBOL (Standalone))
# Section 2 is at the top right: x ~ 700 to 950, y ~ 50 to 220
$sec2Crop = New-Object System.Drawing.Bitmap(250, 160)
$g2 = [System.Drawing.Graphics]::FromImage($sec2Crop)
$g2.DrawImage($refImg, [System.Drawing.Rectangle]::new(0,0,250,160), [System.Drawing.Rectangle]::new(700,50,250,160), [System.Drawing.GraphicsUnit]::Pixel)
$sec2Crop.Save("c:\Users\Administrator\Desktop\System\scripts\crops\sec2_symbol_only.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $sec2Crop.Dispose()

# Also let's crop Section 3 symbol only (y from 180 to 280)
$sec3Crop = New-Object System.Drawing.Bitmap(200, 100)
$g3 = [System.Drawing.Graphics]::FromImage($sec3Crop)
$g3.DrawImage($refImg, [System.Drawing.Rectangle]::new(0,0,200,100), [System.Drawing.Rectangle]::new(430,185,200,100), [System.Drawing.GraphicsUnit]::Pixel)
$sec3Crop.Save("c:\Users\Administrator\Desktop\System\scripts\crops\sec3_symbol_only.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g3.Dispose(); $sec3Crop.Dispose()

$refImg.Dispose()
Write-Host "Saved candidate symbol-only crops"
