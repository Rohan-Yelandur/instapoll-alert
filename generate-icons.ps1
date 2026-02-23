Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)
$outDir = "c:\APP\Github Workspace\instapoll-alert\icons"

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    
    # Background
    $g.Clear([System.Drawing.Color]::FromArgb(26, 26, 46))
    
    # Colors
    $orange = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(191, 87, 0))
    $lightOrange = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212, 112, 10))
    $yellow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
    $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
    
    $s = $size
    $barW = [Math]::Max([int]($s * 0.14), 1)
    $gap = [Math]::Max([int]($s * 0.06), 1)
    $baseY = [int]($s * 0.75)
    $startX = [int]($s * 0.15)
    
    # Bar chart - 3 bars
    $g.FillRectangle($orange, $startX, $baseY - [int]($s * 0.2), $barW, [int]($s * 0.2))
    $g.FillRectangle($lightOrange, $startX + $barW + $gap, $baseY - [int]($s * 0.35), $barW, [int]($s * 0.35))
    $g.FillRectangle($orange, $startX + 2 * ($barW + $gap), $baseY - [int]($s * 0.5), $barW, [int]($s * 0.5))
    
    # Bell shape (simplified as circle + rect)
    $bellX = [int]($s * 0.58)
    $bellY = [int]($s * 0.12)
    $bellW = [Math]::Max([int]($s * 0.32), 3)
    $bellH = [Math]::Max([int]($s * 0.38), 3)
    $g.FillEllipse($yellow, $bellX, $bellY, $bellW, $bellH)
    $rectH = [Math]::Max([int]($bellH * 0.3), 1)
    $rectW = [Math]::Max([int]($bellW * 0.5), 1)
    $g.FillRectangle($yellow, $bellX + [int]($bellW * 0.25), $bellY + [int]($bellH * 0.6), $rectW, $rectH)
    
    # Red notification dot
    $dotR = [Math]::Max([int]($s * 0.09), 1)
    $g.FillEllipse($red, $bellX + $bellW - $dotR, $bellY, $dotR * 2, $dotR * 2)
    
    $g.Dispose()
    $path = Join-Path $outDir "icon$size.png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $path"
}
