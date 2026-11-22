Add-Type -AssemblyName System.Drawing

function Analyze-Image($filename, $originX, $originY) {
    $path = "c:\Users\Administrator\Desktop\System\scripts\crops\$filename"
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    Write-Host "=== Analyzing $filename (Origin: $originX, $originY, Size: $($bmp.Width)x$($bmp.Height)) ==="
    
    # Sample 4 corners
    $cTL = $bmp.GetPixel(5, 5)
    $cBR = $bmp.GetPixel($bmp.Width - 6, $bmp.Height - 6)
    Write-Host "Top-Left color: R=$($cTL.R), G=$($cTL.G), B=$($cTL.B)"
    Write-Host "Bottom-Right color: R=$($cBR.R), G=$($cBR.G), B=$($cBR.B)"
    $bmp.Dispose()
}

Analyze-Image "section_4_monochrome.png" 680 240
Analyze-Image "section_5_left.png" 20 410
Analyze-Image "section_5_center.png" 380 410
Analyze-Image "section_3_light.png" 390 160
