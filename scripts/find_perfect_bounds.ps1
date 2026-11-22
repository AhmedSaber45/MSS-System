Add-Type -AssemblyName System.Drawing
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")
$testDir = "c:\Users\Administrator\Desktop\System\scripts\extracted"

# 1. Clean Bronze Symbol (Section 3)
# Exact bounds: X from 440 to 600, Y from 195 to 310
# Bounding box of the symbol inside Section 3:
$brMinX = 9999; $brMaxX = 0; $brMinY = 9999; $brMaxY = 0
for ($y = 193; $y -le 310; $y++) {
    for ($x = 440; $x -le 600; $x++) {
        $p = $refImg.GetPixel($x, $y)
        # Symbol is dark bronze (R < 170 and G < 145 and B < 130)
        # Blueprint lines and cream background have R > 190
        if ($p.R -lt 170 -and $p.G -lt 145 -and $p.B -lt 130) {
            if ($x -lt $brMinX) { $brMinX = $x }
            if ($x -gt $brMaxX) { $brMaxX = $x }
            if ($y -lt $brMinY) { $brMinY = $y }
            if ($y -gt $brMaxY) { $brMaxY = $y }
        }
    }
}
Write-Host "Exact Bronze Symbol: X=$brMinX..$brMaxX (W=$($brMaxX-$brMinX+1)), Y=$brMinY..$brMaxY (H=$($brMaxY-$brMinY+1))"

# 2. Clean Gold Symbol (Section 1)
# Exact bounds: X from 80 to 320, Y from 65 to 250
$gMinX = 9999; $gMaxX = 0; $gMinY = 9999; $gMaxY = 0
for ($y = 65; $y -le 250; $y++) {
    for ($x = 80; $x -le 320; $x++) {
        $p = $refImg.GetPixel($x, $y)
        # Gold symbol: warm amber/gold, R >= 110, G >= 70, (R - B) >= 35
        # Blueprint lines: gray (R - B < 20)
        # Background: dark (R < 45)
        if ($p.R -ge 110 -and $p.G -ge 70 -and ($p.R - $p.B) -ge 35) {
            if ($x -lt $gMinX) { $gMinX = $x }
            if ($x -gt $gMaxX) { $gMaxX = $x }
            if ($y -lt $gMinY) { $gMinY = $y }
            if ($y -gt $gMaxY) { $gMaxY = $y }
        }
    }
}
Write-Host "Exact Gold Symbol: X=$gMinX..$gMaxX (W=$($gMaxX-$gMinX+1)), Y=$gMinY..$gMaxY (H=$($gMaxY-$gMinY+1))"

$refImg.Dispose()
