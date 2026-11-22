Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

# Save the white box exactly: 680 to 852, 255 to 400
$cropW = New-Object System.Drawing.Bitmap(172, 145)
$gW = [System.Drawing.Graphics]::FromImage($cropW)
$gW.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,172,145), [System.Drawing.Rectangle]::new(680,255,172,145), [System.Drawing.GraphicsUnit]::Pixel)
$cropW.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_white.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gW.Dispose(); $cropW.Dispose()

# Save the black box exactly: 852 to 1024, 255 to 400
$cropB = New-Object System.Drawing.Bitmap(172, 145)
$gB = [System.Drawing.Graphics]::FromImage($cropB)
$gB.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,172,145), [System.Drawing.Rectangle]::new(852,255,172,145), [System.Drawing.GraphicsUnit]::Pixel)
$cropB.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_black.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gB.Dispose(); $cropB.Dispose()

# Also let's inspect the light background variation in Section 3:
# Let's save Section 3 symbol
$crop3 = New-Object System.Drawing.Bitmap(260, 200)
$g3 = [System.Drawing.Graphics]::FromImage($crop3)
$g3.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,260,200), [System.Drawing.Rectangle]::new(400,165,260,200), [System.Drawing.GraphicsUnit]::Pixel)
$crop3.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_section3.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g3.Dispose(); $crop3.Dispose()

# Also let's inspect Section 1 gold symbol and Section 2 gold symbol:
$crop1 = New-Object System.Drawing.Bitmap(260, 200)
$g1 = [System.Drawing.Graphics]::FromImage($crop1)
$g1.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,260,200), [System.Drawing.Rectangle]::new(80,100,260,200), [System.Drawing.GraphicsUnit]::Pixel)
$crop1.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_section1.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g1.Dispose(); $crop1.Dispose()

$crop2 = New-Object System.Drawing.Bitmap(260, 200)
$g2 = [System.Drawing.Graphics]::FromImage($crop2)
$g2.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,260,200), [System.Drawing.Rectangle]::new(700,100,260,200), [System.Drawing.GraphicsUnit]::Pixel)
$crop2.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_section2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $crop2.Dispose()

# And the app icon tiles in Section 5:
# Tile 1: x: 30 to 140, y: 440 to 550
$cropTile1 = New-Object System.Drawing.Bitmap(120, 120)
$gT1 = [System.Drawing.Graphics]::FromImage($cropTile1)
$gT1.DrawImage($img, [System.Drawing.Rectangle]::new(0,0,120,120), [System.Drawing.Rectangle]::new(30,440,120,120), [System.Drawing.GraphicsUnit]::Pixel)
$cropTile1.Save("c:\Users\Administrator\Desktop\System\scripts\crops\box_tile1.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gT1.Dispose(); $cropTile1.Dispose()

$img.Dispose()
Write-Host "All boxes saved"
