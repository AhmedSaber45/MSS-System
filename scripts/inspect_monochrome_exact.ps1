Add-Type -AssemblyName System.Drawing
$bmpW = [System.Drawing.Bitmap]::FromFile("c:\Users\Administrator\Desktop\System\scripts\crops\box_white.png")
$bmpB = [System.Drawing.Bitmap]::FromFile("c:\Users\Administrator\Desktop\System\scripts\crops\box_black.png")

# Let's inspect box_black (white symbol on black bg)
# Black bg is around (10, 10, 10)
# White symbol has R > 150, G > 150, B > 150
$minX = 999; $maxX = 0; $minY = 999; $maxY = 0
for ($y = 0; $y -lt $bmpB.Height; $y++) {
    for ($x = 0; $x -lt $bmpB.Width; $x++) {
        $p = $bmpB.GetPixel($x, $y)
        if ($p.R -gt 150 -and $p.G -gt 150 -and $p.B -gt 150) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "box_black White Symbol: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Save cropped clean white symbol
$wSym = New-Object System.Drawing.Bitmap(($maxX-$minX+1), ($maxY-$minY+1))
$g = [System.Drawing.Graphics]::FromImage($wSym)
$g.DrawImage($bmpB, [System.Drawing.Rectangle]::new(0, 0, $wSym.Width, $wSym.Height), [System.Drawing.Rectangle]::new($minX, $minY, $wSym.Width, $wSym.Height), [System.Drawing.GraphicsUnit]::Pixel)
$wSym.Save("c:\Users\Administrator\Desktop\System\scripts\crops\clean_white_symbol.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $wSym.Dispose()

# Now inspect box_white (black symbol on white bg)
# White bg is around (250, 250, 250)
# Black symbol has R < 80, G < 80, B < 80
$bMinX = 999; $bMaxX = 0; $bMinY = 999; $bMaxY = 0
for ($y = 0; $y -lt $bmpW.Height; $y++) {
    for ($x = 0; $x -lt $bmpW.Width; $x++) {
        $p = $bmpW.GetPixel($x, $y)
        if ($p.R -lt 80 -and $p.G -lt 80 -and $p.B -lt 80) {
            if ($x -lt $bMinX) { $bMinX = $x }
            if ($x -gt $bMaxX) { $bMaxX = $x }
            if ($y -lt $bMinY) { $bMinY = $y }
            if ($y -gt $bMaxY) { $bMaxY = $y }
        }
    }
}
Write-Host "box_white Black Symbol: X=$bMinX..$bMaxX (W=$($bMaxX-$bMinX+1)), Y=$bMinY..$bMaxY (H=$($bMaxY-$bMinY+1))"

# Save cropped clean black symbol
$bSym = New-Object System.Drawing.Bitmap(($bMaxX-$bMinX+1), ($bMaxY-$bMinY+1))
$gb = [System.Drawing.Graphics]::FromImage($bSym)
$gb.DrawImage($bmpW, [System.Drawing.Rectangle]::new(0, 0, $bSym.Width, $bSym.Height), [System.Drawing.Rectangle]::new($bMinX, $bMinY, $bSym.Width, $bSym.Height), [System.Drawing.GraphicsUnit]::Pixel)
$bSym.Save("c:\Users\Administrator\Desktop\System\scripts\crops\clean_black_symbol.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gb.Dispose(); $bSym.Dispose()

$bmpW.Dispose(); $bmpB.Dispose()
