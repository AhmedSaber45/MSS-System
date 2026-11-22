Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("c:\Users\Administrator\Desktop\System\scripts\crops\section_5_left.png")

# Let's scan for the dark rounded tile in section_5_left
# Background is cream: R > 240, G > 240, B > 230
# Dark tile has R < 50, G < 50, B < 50
$tileMinX = 999; $tileMaxX = 0; $tileMinY = 999; $tileMaxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt 150; $x++) { # first tile is on the left
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -lt 60 -and $p.G -lt 60 -and $p.B -lt 60) {
            if ($x -lt $tileMinX) { $tileMinX = $x }
            if ($x -gt $tileMaxX) { $tileMaxX = $x }
            if ($y -lt $tileMinY) { $tileMinY = $y }
            if ($y -gt $tileMaxY) { $tileMaxY = $y }
        }
    }
}

Write-Host "Tile 1 in section_5_left: MinX=$tileMinX, MinY=$tileMinY, MaxX=$tileMaxX, MaxY=$tileMaxY, W=$($tileMaxX-$tileMinX+1), H=$($tileMaxY-$tileMinY+1)"

# Inside tile 1, find the gold symbol:
# Tile background is dark (R < 60), gold symbol is warm amber/gold (R > 140, G > 90, B < 80)
$goldMinX = 999; $goldMaxX = 0; $goldMinY = 999; $goldMaxY = 0
for ($y = $tileMinY; $y -le $tileMaxY; $y++) {
    for ($x = $tileMinX; $x -le $tileMaxX; $x++) {
        $p = $bmp.GetPixel($x, $y)
        # Gold check: R > 120 and G > 70
        if ($p.R -gt 100 -and $p.G -gt 60) {
            if ($x -lt $goldMinX) { $goldMinX = $x }
            if ($x -gt $goldMaxX) { $goldMaxX = $x }
            if ($y -lt $goldMinY) { $goldMinY = $y }
            if ($y -gt $goldMaxY) { $goldMaxY = $y }
        }
    }
}
Write-Host "Gold symbol in Tile 1: MinX=$goldMinX, MinY=$goldMinY, MaxX=$goldMaxX, MaxY=$goldMaxY, W=$($goldMaxX-$goldMinX+1), H=$($goldMaxY-$goldMinY+1)"

$bmp.Dispose()
