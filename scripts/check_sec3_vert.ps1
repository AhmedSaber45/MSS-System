Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# In Section 3, background is cream: R ~ 251, G ~ 248, B ~ 243
# Let's inspect vertical slice at x: 520, y from 160 to 350
for ($y = 160; $y -le 350; $y += 5) {
    $p = $img.GetPixel(520, $y)
    Write-Host "Y=$y : R=$($p.R), G=$($p.G), B=$($p.B)"
}

$img.Dispose()
