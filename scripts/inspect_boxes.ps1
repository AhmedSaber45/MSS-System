Add-Type -AssemblyName System.Drawing

function Inspect-Box($name, $darkThreshold, $brightThreshold) {
    $bmp = [System.Drawing.Bitmap]::FromFile("c:\Users\Administrator\Desktop\System\scripts\crops\$name")
    Write-Host "--- $name ($($bmp.Width)x$($bmp.Height)) ---"
    
    # Find bounding box of content
    $minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $isTarget = $false
            if ($brightThreshold -ne $null) {
                # Looking for bright symbol on dark background
                if ($p.R -gt $brightThreshold -and $p.G -gt $brightThreshold -and $p.B -gt $brightThreshold) {
                    $isTarget = $true
                }
            } elseif ($darkThreshold -ne $null) {
                # Looking for dark symbol on bright background
                if ($p.R -lt $darkThreshold -and $p.G -lt $darkThreshold -and $p.B -lt $darkThreshold) {
                    $isTarget = $true
                }
            }
            if ($isTarget) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    Write-Host "Bounds: X=$minX..$maxX (W=$($maxX-$minX+1)), Y=$minY..$maxY (H=$($maxY-$minY+1))"
    $bmp.Dispose()
    return @{ MinX=$minX; MaxX=$maxX; MinY=$minY; MaxY=$maxY; W=($maxX-$minX+1); H=($maxY-$minY+1) }
}

# box_white: black symbol on white background
Inspect-Box "box_white.png" 100 $null

# box_black: white symbol on black background
Inspect-Box "box_black.png" $null 150

# box_tile1: rounded tile (dark) with gold symbol
Inspect-Box "box_tile1.png" 60 $null
