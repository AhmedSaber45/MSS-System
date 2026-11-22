Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg"
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

# Section 4 spans x: 680..1024, y: 250..400
# In Section 4:
# Left half is white box (x approx 680 to 850) with black symbol
# Right half is black box (x approx 850 to 1024) with white symbol

# Find the white box boundary:
$wBoxMinX = 9999; $wBoxMaxX = 0; $wBoxMinY = 9999; $wBoxMaxY = 0
for ($y = 250; $y -lt 400; $y++) {
    for ($x = 680; $x -lt 855; $x++) {
        $p = $img.GetPixel($x, $y)
        # White background in the box has R > 240, G > 240, B > 240
        if ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240) {
            if ($x -lt $wBoxMinX) { $wBoxMinX = $x }
            if ($x -gt $wBoxMaxX) { $wBoxMaxX = $x }
            if ($y -lt $wBoxMinY) { $wBoxMinY = $y }
            if ($y -gt $wBoxMaxY) { $wBoxMaxY = $y }
        }
    }
}
Write-Host "White box: X=$wBoxMinX..$wBoxMaxX, Y=$wBoxMinY..$wBoxMaxY"

# Inside white box, find the black symbol (R < 50, G < 50, B < 50)
$bSymMinX = 9999; $bSymMaxX = 0; $bSymMinY = 9999; $bSymMaxY = 0
for ($y = $wBoxMinY; $y -le $wBoxMaxY; $y++) {
    for ($x = $wBoxMinX; $x -le $wBoxMaxX; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 50 -and $p.G -lt 50 -and $p.B -lt 50) {
            if ($x -lt $bSymMinX) { $bSymMinX = $x }
            if ($x -gt $bSymMaxX) { $bSymMaxX = $x }
            if ($y -lt $bSymMinY) { $bSymMinY = $y }
            if ($y -gt $bSymMaxY) { $bSymMaxY = $y }
        }
    }
}
Write-Host "Black symbol: X=$bSymMinX..$bSymMaxX (W=$($bSymMaxX-$bSymMinX+1)), Y=$bSymMinY..$bSymMaxY (H=$($bSymMaxY-$bSymMinY+1))"

# Now find the black box boundary (x approx 850 to 1024)
# Inside black box, find the white symbol (R > 200, G > 200, B > 200)
$wSymMinX = 9999; $wSymMaxX = 0; $wSymMinY = 9999; $wSymMaxY = 0
for ($y = 250; $y -lt 400; $y++) {
    for ($x = 850; $x -lt 1020; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 200 -and $p.G -gt 200 -and $p.B -gt 200) {
            if ($x -lt $wSymMinX) { $wSymMinX = $x }
            if ($x -gt $wSymMaxX) { $wSymMaxX = $x }
            if ($y -lt $wSymMinY) { $wSymMinY = $y }
            if ($y -gt $wSymMaxY) { $wSymMaxY = $y }
        }
    }
}
Write-Host "White symbol: X=$wSymMinX..$wSymMaxX (W=$($wSymMaxX-$wSymMinX+1)), Y=$wSymMinY..$wSymMaxY (H=$($wSymMaxY-$wSymMinY+1))"

$img.Dispose()
