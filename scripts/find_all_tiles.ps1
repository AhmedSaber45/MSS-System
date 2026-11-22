Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

# Section 5 left is from y = 400 to 570
# Let's inspect rows around y = 450 to 520, across x from 0 to 400
# Find dark regions
Write-Host "Image size: $($img.Width)x$($img.Height)"

# Let's find the tile bounds on the original image:
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 400; $y -lt $img.Height; $y++) {
    for ($x = 0; $x -lt 250; $x++) {
        $p = $img.GetPixel($x, $y)
        # dark tile: R < 50, G < 50, B < 50
        if ($p.R -lt 50 -and $p.G -lt 50 -and $p.B -lt 50) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Tile 1 on original: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Inside Tile 1, find the gold symbol:
# Dark tile color around the center is approx (30, 26, 23)
# Gold color has high R (>140) and high G (>90)
$sMinX = 9999; $sMaxX = 0; $sMinY = 9999; $sMaxY = 0
for ($y = $minY; $y -le $maxY; $y++) {
    for ($x = $minX; $x -le $maxX; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 100 -and $p.G -gt 70 -and $p.B -lt 80) {
            if ($x -lt $sMinX) { $sMinX = $x }
            if ($x -gt $sMaxX) { $sMaxX = $x }
            if ($y -lt $sMinY) { $sMinY = $y }
            if ($y -gt $sMaxY) { $sMaxY = $y }
        }
    }
}
Write-Host "Gold symbol inside Tile 1: X=$sMinX..$sMaxX (W=$($sMaxX-$sMinX+1)), Y=$sMinY..$sMaxY (H=$($sMaxY-$sMinY+1))"

# Now let's check Tile 2 (right of tile 1)
$t2MinX = 9999; $t2MaxX = 0; $t2MinY = 9999; $t2MaxY = 0
for ($y = 400; $y -lt $img.Height; $y++) {
    for ($x = ($maxX + 10); $x -lt 300; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 50 -and $p.G -lt 50 -and $p.B -lt 50) {
            if ($x -lt $t2MinX) { $t2MinX = $x }
            if ($x -gt $t2MaxX) { $t2MaxX = $x }
            if ($y -lt $t2MinY) { $t2MinY = $y }
            if ($y -gt $t2MaxY) { $t2MaxY = $y }
        }
    }
}
Write-Host "Tile 2 on original: X=$t2MinX..$t2MaxX (W=$($t2MaxX-$t2MinX+1)), Y=$t2MinY..$t2MaxY (H=$($t2MaxY-$t2MinY+1))"

# Check Tile 3 in center area (x: 380 to 550)
$t3MinX = 9999; $t3MaxX = 0; $t3MinY = 9999; $t3MaxY = 0
for ($y = 400; $y -lt $img.Height; $y++) {
    for ($x = 380; $x -lt 550; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 50 -and $p.G -lt 50 -and $p.B -lt 50) {
            if ($x -lt $t3MinX) { $t3MinX = $x }
            if ($x -gt $t3MaxX) { $t3MaxX = $x }
            if ($y -lt $t3MinY) { $t3MinY = $y }
            if ($y -gt $t3MaxY) { $t3MaxY = $y }
        }
    }
}
Write-Host "Tile 3 (center) on original: X=$t3MinX..$t3MaxX (W=$($t3MaxX-$t3MinX+1)), Y=$t3MinY..$t3MaxY (H=$($t3MaxY-$t3MinY+1))"

$img.Dispose()
