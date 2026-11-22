Add-Type -AssemblyName System.Drawing
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

for ($y = 0; $y -lt $refImg.Height; $y += 10) {
    $goldCount = 0
    for ($x = 0; $x -lt 350; $x++) {
        $p = $refImg.GetPixel($x, $y)
        $diffRB = $p.R - $p.B
        $diffRG = $p.R - $p.G
        if ($p.R -ge 85 -and $diffRB -ge 30 -and $diffRG -ge 10 -and $p.G -ge 55) {
            $goldCount++
        }
    }
    if ($goldCount -gt 0) {
        Write-Host "Y=$y : goldCount = $goldCount"
    }
}

$refImg.Dispose()
