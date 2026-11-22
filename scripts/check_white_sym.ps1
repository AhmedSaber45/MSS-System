Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# The white symbol is centered horizontally in the black card (x: 852 to 1024, card center ~ 938)
# If black symbol is W=88, H=68, the white symbol should be identical size!
# Let's check x: 880 to 980, y: 300 to 390
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 300; $y -lt 390; $y++) {
    for ($x = 880; $x -lt 980; $x++) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -gt 200 -and $p.G -gt 200 -and $p.B -gt 200) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "White symbol centered: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"

$img.Dispose()
