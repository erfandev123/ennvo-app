Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path (Get-Location) 'public\images\ennvo-circle.png'
$res = Join-Path (Get-Location) 'android\app\src\main\res'
$src = [System.Drawing.Image]::FromFile($srcPath)

function Save-Resized {
    param([System.Drawing.Image]$image, [int]$w, [int]$h, [string]$out, [switch]$Round)
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    if ($Round) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $w, $h)
        $g.SetClip($path)
    }
    $g.DrawImage($image, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($key in $sizes.Keys) {
    $size = $sizes[$key]
    $dir = Join-Path $res "mipmap-$key"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Save-Resized -image $src -w $size -h $size -out (Join-Path $dir 'ic_launcher.png')
    Save-Resized -image $src -w $size -h $size -out (Join-Path $dir 'ic_launcher_round.png') -Round
    $fg = [int]($size * 2.25)
    Save-Resized -image $src -w $fg -h $fg -out (Join-Path $dir 'ic_launcher_foreground.png')
}

# High quality native splash symbol
$drawable = Join-Path $res 'drawable-nodpi'
New-Item -ItemType Directory -Force -Path $drawable | Out-Null
Save-Resized -image $src -w 512 -h 512 -out (Join-Path $drawable 'splash_logo.png')

# White "e" silhouette for the status bar. Android masks the alpha channel of
# small icons, so a white-on-transparent crop keeps the logo crisp at 24dp.
$bitmap = New-Object System.Drawing.Bitmap($srcPath)
$minX = $bitmap.Width; $minY = $bitmap.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $bitmap.Height; $y += 2) {
    for ($x = 0; $x -lt $bitmap.Width; $x += 2) {
        $c = $bitmap.GetPixel($x, $y)
        if ($c.A -gt 120 -and $c.R -gt 235 -and $c.G -gt 235 -and $c.B -gt 235) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
$cropW = [Math]::Max(1, $maxX - $minX + 1)
$cropH = [Math]::Max(1, $maxY - $minY + 1)
$notify = New-Object System.Drawing.Bitmap(96, 96, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ng = [System.Drawing.Graphics]::FromImage($notify)
$ng.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$ng.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ng.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$ng.Clear([System.Drawing.Color]::Transparent)
$scale = [Math]::Min(84.0 / $cropW, 84.0 / $cropH)
$dw = [int]($cropW * $scale)
$dh = [int]($cropH * $scale)
$dx = [int]((96 - $dw) / 2)
$dy = [int]((96 - $dh) / 2)
$ng.DrawImage($bitmap, (New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)), $minX, $minY, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel)
$ng.Dispose()
# Keep only the white pixels; everything else becomes transparent.
for ($y = 0; $y -lt 96; $y++) {
    for ($x = 0; $x -lt 96; $x++) {
        $c = $notify.GetPixel($x, $y)
        if ($c.A -lt 40 -or $c.R -lt 180) {
            $notify.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        } else {
            $notify.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, 255, 255, 255))
        }
    }
}
$notify.Save((Join-Path $drawable 'ic_stat_notify.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$notify.Dispose()
$bitmap.Dispose()
$src.Dispose()

Write-Output 'Android icons generated.'
