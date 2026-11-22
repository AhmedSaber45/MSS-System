Add-Type -AssemblyName System.Drawing

# 1. Check Gold Symbol vertical bounds:
# In the previous script: $gX = 60; $gY = 84; $gW = 270; $gH = 215
# On the original image:
$refImg = [System.Drawing.Bitmap]::FromFile("C:\Users\Administrator\.gemini\antigravity\brain\2abc8ef4-ddb6-4386-8a52-2355496b89dd\.user_uploaded\media_1795347808372_41534e81.jpg")

# The AS symbol in Section 1 is from Y=84 down to where?
# Between Y=265 and 320, where does the symbol end?
# Let's inspect rows Y from 250 to 350 across X from 60 to 300
for ($y = 250; $y -le 350; $y += 5) {
    $goldPixCount = 0
    for ($x = 60; $x -le 300; $x++) {
        $p = $refImg.GetPixel($x, $y)
        $diffRB = $p.R - $p.B
        $diffRG = $p.R - $p.G
        if ($p.R -ge 85 -and $diffRB -ge 30 -and $diffRG -ge 10 -and $p.G -ge 55) {
            $goldPixCount++
        }
    }
    Write-Host "Sec 1 Y=$y : gold pixel count = $goldPixCount"
}

# 2. Check Bronze Symbol in Section 3:
# Let's inspect rows Y from 170 to 320 across X from 440 to 600
for ($y = 170; $y -le 320; $y += 5) {
    $bronzePixCount = 0
    for ($x = 440; $x -le 600; $x++) {
        $p = $refImg.GetPixel($x, $y)
        if ($p.R -lt 185 -and $p.G -lt 165 -and ($p.R -gt 25 -or $p.G -gt 20)) {
            $bronzePixCount++
        }
    }
    Write-Host "Sec 3 Y=$y : bronze pixel count = $bronzePixCount"
}

$refImg.Dispose()
