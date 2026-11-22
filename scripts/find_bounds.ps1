Add-Type -AssemblyName System.Drawing

function Find-SymbolBounds($bmp, $isDarkBg) {
    $minX = $bmp.Width; $minY = $bmp.Height; $maxX = 0; $maxY = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $isSymbol = $false
            if ($isDarkBg) {
                # Dark background: look for bright pixels (R > 80 or G > 80 or B > 80)
                if ($p.R -gt 80 -or $p.G -gt 80 -or $p.B -gt 80) { $isSymbol = $true }
            } else {
                # Light background: look for dark pixels (R < 180 and G < 180 and B < 180)
                if ($p.R -lt 180 -and $p.G -lt 180 -and $p.B -lt 180) { $isSymbol = $true }
            }
            if ($isSymbol) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    return [PSCustomObject]@{ MinX = $minX; MinY = $minY; MaxX = $maxX; MaxY = $maxY; Width = ($maxX - $minX + 1); Height = ($maxY - $minY + 1) }
}

$files = @(
    @{ Name = "mono_black.png"; Dark = $false },
    @{ Name = "mono_white.png"; Dark = $true },
    @{ Name = "icon_tile_1.png"; Dark = $true },
    @{ Name = "bronze_symbol.png"; Dark = $false }
)

foreach ($f in $files) {
    $path = "c:\Users\Administrator\Desktop\System\scripts\crops\$($f.Name)"
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $b = Find-SymbolBounds $bmp $f.Dark
    Write-Host "$($f.Name): MinX=$($b.MinX), MinY=$($b.MinY), MaxX=$($b.MaxX), MaxY=$($b.MaxY), W=$($b.Width), H=$($b.Height)"
    $bmp.Dispose()
}
