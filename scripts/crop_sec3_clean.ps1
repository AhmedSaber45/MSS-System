Add-Type -AssemblyName System.Drawing
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Crop X: 450..595 (W=145), Y: 212..308 (H=96)
$bmp = New-Object System.Drawing.Bitmap(145, 96)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($refImg, [System.Drawing.Rectangle]::new(0,0,145,96), [System.Drawing.Rectangle]::new(450,212,145,96), [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save("c:\Users\Administrator\Desktop\System\scripts\crops\sec3_bronze_clean.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
$refImg.Dispose()
