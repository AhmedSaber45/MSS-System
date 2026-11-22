Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)
$outputDir = "c:\Users\Administrator\Desktop\System\scripts\crops"

# Crop the whole Section 4 (Monochrome Variations)
$s4 = New-Object System.Drawing.Bitmap(340, 160)
$g = [System.Drawing.Graphics]::FromImage($s4)
$g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, 340, 160), [System.Drawing.Rectangle]::new(680, 240, 340, 160), [System.Drawing.GraphicsUnit]::Pixel)
$s4.Save("$outputDir\section_4_monochrome.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $s4.Dispose()

# Crop the whole Section 5 Left (App & Taskbar Icon Preview)
$s5 = New-Object System.Drawing.Bitmap(350, 160)
$g = [System.Drawing.Graphics]::FromImage($s5)
$g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, 350, 160), [System.Drawing.Rectangle]::new(20, 410, 350, 160), [System.Drawing.GraphicsUnit]::Pixel)
$s5.Save("$outputDir\section_5_left.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $s5.Dispose()

# Crop Section 5 Center (App & Taskbar Icon Preview on light bg)
$s5c = New-Object System.Drawing.Bitmap(300, 160)
$g = [System.Drawing.Graphics]::FromImage($s5c)
$g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, 300, 160), [System.Drawing.Rectangle]::new(380, 410, 300, 160), [System.Drawing.GraphicsUnit]::Pixel)
$s5c.Save("$outputDir\section_5_center.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $s5c.Dispose()

# Crop Section 3 (Light background variation)
$s3 = New-Object System.Drawing.Bitmap(280, 240)
$g = [System.Drawing.Graphics]::FromImage($s3)
$g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, 280, 240), [System.Drawing.Rectangle]::new(390, 160, 280, 240), [System.Drawing.GraphicsUnit]::Pixel)
$s3.Save("$outputDir\section_3_light.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $s3.Dispose()

$img.Dispose()
Write-Host "Saved wide sections"
