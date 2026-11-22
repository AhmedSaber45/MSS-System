Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find exact bounds of the white card in Section 4:
$cardLeft = 0; $cardRight = 0; $cardTop = 0; $cardBottom = 0

# Check vertical extent at x=750:
for ($y = 260; $y -lt 400; $y++) {
    $p = $img.GetPixel(750, $y)
    if ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240 -and $cardTop -eq 0) {
        $cardTop = $y
    }
    if ($cardTop -gt 0 -and ($p.R -lt 200 -or $p.G -lt 200) -and $y -gt 380) {
        $cardBottom = $y - 1
        break
    }
}

# Check horizontal extent of the white card at y=300:
for ($x = 670; $x -lt 860; $x++) {
    $p = $img.GetPixel($x, 300)
    if ($p.R -gt 250 -and $p.G -gt 250 -and $p.B -gt 250 -and $cardLeft -eq 0) {
        $cardLeft = $x
    }
    if ($cardLeft -gt 0 -and ($p.R -lt 250 -or $p.G -lt 250) -and $x -gt 800) {
        $cardRight = $x - 1
        break
    }
}

Write-Host "White card exact bounds: X=$cardLeft..$cardRight (W=$($cardRight-$cardLeft+1)), Y=$cardTop..$cardBottom (H=$($cardBottom-$cardTop+1))"

# Inside this exact white card, find the black symbol (R < 100):
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = $cardTop; $y -le ($cardTop + 110); $y++) {
    for ($x = $cardLeft; $x -le $cardRight; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 100 -and $p.G -lt 100 -and $p.B -lt 100) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Black symbol exact bounds: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

# Now let's check the black card right next to it:
# Starts at x = cardRight + 1 to 1024, same vertical extent cardTop..cardBottom
# Inside this black card, find the white symbol (R > 180):
$wMinX = 9999; $wMaxX = 0; $wMinY = 9999; $wMaxY = 0
for ($y = $cardTop; $y -le ($cardTop + 110); $y++) {
    for ($x = ($cardRight + 1); $x -lt 1024; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 180 -and $p.G -gt 180 -and $p.B -gt 180) {
            if ($x -lt $wMinX) { $wMinX = $x }
            if ($x -gt $wMaxX) { $wMaxX = $x }
            if ($y -lt $wMinY) { $wMinY = $y }
            if ($y -gt $wMaxY) { $wMaxY = $y }
        }
    }
}
Write-Host "White symbol exact bounds: X=$wMinX..$wMaxX (W=$($wMaxX-$wMinX+1)), Y=$wMinY..$wMaxY (H=$($wMaxY-$wMinY+1))"

$img.Dispose()
