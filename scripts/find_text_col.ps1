Add-Type -AssemblyName System.Drawing
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find any non-background pixels in x: 40..350, y: 300..450
for ($y = 300; $y -lt 450; $y += 5) {
    for ($x = 40; $x -lt 350; $x += 10) {
        $p = $refImg.GetPixel($x, $y)
        if ($p.R -gt 60 -or $p.G -gt 60 -or $p.B -gt 60) {
            Write-Host "Found non-bg at $x, $y: R=$($p.R), G=$($p.G), B=$($p.B)"
            break
        }
    }
}
$refImg.Dispose()
