Add-Type -AssemblyName System.Drawing

# Let's inspect the exact dimensions and aspect ratios:
# Monochrome black symbol:
# MinX=724..811 (W=88), Y=313..380 (H=68) -> Aspect ratio = 88/68 = 1.2941
# Section 1 symbol:
# MinX=70..329 (W=260), Y=100..298 (H=199) -> 260/199 = 1.3065
# Section 3 bronze symbol:
# MinX=440..592 (W=153), Y=184..295 (H=112) -> 153/112 = 1.366 (or let's check exact)

Write-Host "Checking Section 1 Gold Symbol exact boundary..."
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find exact bounds of the gold symbol in Section 1 where (R - B) > 50 and R > 100
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 80; $y -lt 310; $y++) {
    for ($x = 60; $x -lt 340; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 100 -and ($p.R - $p.B) -gt 45) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Sec 1 Gold Symbol exact: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1)), Ratio=$([Math]::Round(($maxX-$minX+1)/($maxY-$minY+1), 4))"

# Check Bronze symbol exact bounds with same color logic:
# Bronze symbol in Sec 3 has R > 40, G > 30, B > 20, but not background cream (R > 230)
$bMinX = 9999; $bMaxX = 0; $bMinY = 9999; $bMaxY = 0
for ($y = 180; $y -lt 300; $y++) {
    for ($x = 440; $x -lt 600; $x++) {
        $p = $img.GetPixel($x, $y)
        # Background is cream: R > 230, G > 220, B > 210
        # Blueprint line is faint gray: R > 200, G > 190, B > 180
        # Bronze symbol has dark bronze colors (R < 180 and G < 160)
        if ($p.R -lt 180 -and $p.G -lt 160) {
            if ($x -lt $bMinX) { $bMinX = $x }
            if ($x -gt $bMaxX) { $bMaxX = $x }
            if ($y -lt $bMinY) { $bMinY = $y }
            if ($y -gt $bMaxY) { $bMaxY = $y }
        }
    }
}
Write-Host "Sec 3 Bronze Symbol exact: X=$bMinX..$bMaxX (W=$($bMaxX-$bMinX+1)), Y=$bMinY..$bMaxY (H=$($bMaxY-$bMinY+1)), Ratio=$([Math]::Round(($bMaxX-$bMinX+1)/($maxY-$minY+1), 4))"

$img.Dispose()
