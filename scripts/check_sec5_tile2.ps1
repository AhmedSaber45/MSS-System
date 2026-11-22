Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find the second icon in Section 5 (x: 140..260, y: 440..550)
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 440; $y -lt 550; $y++) {
    for ($x = 140; $x -lt 260; $x++) {
        $p = $img.GetPixel($x, $y)
        # dark tile: R < 60, G < 60, B < 60
        if ($p.R -lt 60 -and $p.G -lt 60 -and $p.B -lt 60) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Tile 2 in Section 5: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Check gold symbol in Tile 2
$sMinX = 9999; $sMaxX = 0; $sMinY = 9999; $sMaxY = 0
for ($y = $minY; $y -le $maxY; $y++) {
    for ($x = $minX; $x -le $maxX; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 110 -and $p.G -gt 70 -and ($p.R - $p.B) -gt 40) {
            if ($x -lt $sMinX) { $sMinX = $x }
            if ($x -gt $sMaxX) { $sMaxX = $x }
            if ($y -lt $sMinY) { $sMinY = $y }
            if ($y -gt $sMaxY) { $sMaxY = $y }
        }
    }
}
Write-Host "Gold symbol in Tile 2: X=$sMinX..$sMaxX (W=$($sMaxX-$sMinX+1)), Y=$sMinY..$sMaxY (H=$($sMaxY-$sMinY+1))"

$img.Dispose()
