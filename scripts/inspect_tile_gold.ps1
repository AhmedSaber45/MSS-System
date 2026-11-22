Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("c:\Users\Administrator\Desktop\System\scripts\crops\box_tile1.png")

# Inspect pixels inside tile: x: 7..105, y: 9..103
# The tile background color:
$tileBg = $bmp.GetPixel(15, 15)
Write-Host "Tile BG at 15,15: R=$($tileBg.R), G=$($tileBg.G), B=$($tileBg.B)"

# Find gold symbol inside tile (pixels where R > 120, G > 70)
$minX = 999; $maxX = 0; $minY = 999; $maxY = 0
for ($y = 10; $y -le 100; $y++) {
    for ($x = 10; $x -le 100; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -gt 100 -and $p.G -gt 60 -and $p.B -lt 80) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Gold symbol in Tile 1: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Let's crop and save just the gold symbol
$symBmp = New-Object System.Drawing.Bitmap(($maxX-$minX+1), ($maxY-$minY+1))
$g = [System.Drawing.Graphics]::FromImage($symBmp)
$g.DrawImage($bmp, [System.Drawing.Rectangle]::new(0, 0, $symBmp.Width, $symBmp.Height), [System.Drawing.Rectangle]::new($minX, $minY, $symBmp.Width, $symBmp.Height), [System.Drawing.GraphicsUnit]::Pixel)
$symBmp.Save("c:\Users\Administrator\Desktop\System\scripts\crops\gold_symbol_from_tile.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $symBmp.Dispose()

# Also save the entire tile
$tileBmp = New-Object System.Drawing.Bitmap(99, 95)
$gt = [System.Drawing.Graphics]::FromImage($tileBmp)
$gt.DrawImage($bmp, [System.Drawing.Rectangle]::new(0,0,99,95), [System.Drawing.Rectangle]::new(7,9,99,95), [System.Drawing.GraphicsUnit]::Pixel)
$tileBmp.Save("c:\Users\Administrator\Desktop\System\scripts\crops\app_icon_tile.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gt.Dispose(); $tileBmp.Dispose()

$bmp.Dispose()
