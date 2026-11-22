Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# In Section 1, dark canvas background is ~ (29, 25, 22)
# Text "COMPU MSS" is below the symbol
for ($y = 280; $y -le 460; $y += 5) {
    $p = $img.GetPixel(180, $y)
    Write-Host "Sec 1 Y=$y : R=$($p.R), G=$($p.G), B=$($p.B)"
}

$img.Dispose()
