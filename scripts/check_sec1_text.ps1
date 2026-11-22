Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find the gold "COMPU MSS" text in Section 1:
$tMinX = 9999; $tMaxX = 0; $tMinY = 9999; $tMaxY = 0
for ($y = 300; $y -lt 405; $y++) {
    for ($x = 40; $x -lt 360; $x++) {
        $p = $img.GetPixel($x, $y)
        # Gold text has high R, G, low B
        if ($p.R -gt 150 -and $p.G -gt 100 -and ($p.R - $p.B) -gt 60) {
            if ($x -lt $tMinX) { $tMinX = $x }
            if ($x -gt $tMaxX) { $tMaxX = $x }
            if ($y -lt $tMinY) { $tMinY = $y }
            if ($y -gt $tMaxY) { $tMaxY = $y }
        }
    }
}
Write-Host "Gold text in Sec 1: X=$tMinX..$tMaxX (W=$($tMaxX-$tMinX+1)), Y=$tMinY..$tMaxY (H=$($tMaxY-$tMinY+1))"

$img.Dispose()
