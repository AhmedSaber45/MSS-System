Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

# Section 1 is from x: 80 to 330, y: 120 to 370
# Background color of the canvas in section 1:
$bgCol = $img.GetPixel(30, 30)
Write-Host "Canvas dark BG: R=$($bgCol.R), G=$($bgCol.G), B=$($bgCol.B)"

# Find the gold symbol in Section 1:
# Gold has R > 120, G > 80, B < 90
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 100; $y -lt 360; $y++) {
    for ($x = 70; $x -lt 330; $x++) {
        $p = $img.GetPixel($x, $y)
        # Gold check: warm color, R > 110, G > 70
        if ($p.R -gt 110 -and $p.G -gt 70 -and ($p.R - $p.B) -gt 40) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Section 1 Gold symbol: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Section 2 Gold symbol (x: 700 to 950, y: 100 to 300)
$s2MinX = 9999; $s2MaxX = 0; $s2MinY = 9999; $s2MaxY = 0
for ($y = 100; $y -lt 300; $y++) {
    for ($x = 700; $x -lt 950; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 110 -and $p.G -gt 70 -and ($p.R - $p.B) -gt 40) {
            if ($x -lt $s2MinX) { $s2MinX = $x }
            if ($x -gt $s2MaxX) { $s2MaxX = $x }
            if ($y -lt $s2MinY) { $s2MinY = $y }
            if ($y -gt $s2MaxY) { $s2MaxY = $y }
        }
    }
}
Write-Host "Section 2 Gold symbol: X=$s2MinX..$s2MaxX (W=$($s2MaxX-$s2MinX+1)), Y=$s2MinY..$s2MaxY (H=$($s2MaxY-$s2MinY+1))"

# Section 3 Bronze symbol (x: 430 to 620, y: 170 to 320)
# Background is cream: R ~ 251, G ~ 248, B ~ 243
# Bronze symbol has dark bronze colors (R: 40-120, G: 30-100, B: 20-80)
$s3MinX = 9999; $s3MaxX = 0; $s3MinY = 9999; $s3MaxY = 0
for ($y = 170; $y -lt 300; $y++) {
    for ($x = 440; $x -lt 620; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 200 -and $p.G -lt 200 -and $p.B -lt 200) {
            if ($x -lt $s3MinX) { $s3MinX = $x }
            if ($x -gt $s3MaxX) { $s3MaxX = $x }
            if ($y -lt $s3MinY) { $s3MinY = $y }
            if ($y -gt $s3MaxY) { $s3MaxY = $y }
        }
    }
}
Write-Host "Section 3 Bronze symbol: X=$s3MinX..$s3MaxX (W=$($s3MaxX-$s3MinX+1)), Y=$s3MinY..$s3MaxY (H=$($s3MaxY-$s3MinY+1))"

$img.Dispose()
