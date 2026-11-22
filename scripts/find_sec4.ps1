Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# Find the exact white subcard in Section 4:
# Let's inspect rows y: 250 to 380 around x = 700 to 830
for ($y = 250; $y -le 380; $y += 20) {
    $p = $img.GetPixel(750, $y)
    Write-Host "Pixel at 750, $y : R=$($p.R), G=$($p.G), B=$($p.B)"
}

for ($x = 680; $x -le 850; $x += 20) {
    $p = $img.GetPixel($x, 300)
    Write-Host "Pixel at $x, 300 : R=$($p.R), G=$($p.G), B=$($p.B)"
}

$img.Dispose()
