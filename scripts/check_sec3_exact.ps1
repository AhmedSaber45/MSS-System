Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 180; $y -le 295; $y++) {
    for ($x = 440; $x -le 610; $x++) {
        $p = $img.GetPixel($x, $y)
        # Background is cream: R > 220, G > 220, B > 210
        # Symbol is darker:
        if ($p.R -lt 210 -or $p.G -lt 210 -or $p.B -lt 200) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Bronze symbol exact bounds: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

$img.Dispose()
