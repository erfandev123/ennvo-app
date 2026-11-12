Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path (Get-Location) 'public\images\ennvo-circle.png'
$res = Join-Path (Get-Location) 'android\app\src\main\res'
$src = [System.Drawing.Image]::FromFile($srcPath)

function New-Canvas {
    param([int]$w, [int]$h)
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    return @($bmp, $g)
}

function Save-Canvas {
    param($bmp, $g, [string]$out)
    $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# ---------------------------------------------------------------------------
# 1. The white Ennvo mark (the "e" with the two small arcs) is cut out of the
#    logo. It is used for the launcher foreground, for the launcher icon and
#    for the splash, so all of them look like the same flat symbol.
# ---------------------------------------------------------------------------
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

# The mark itself, white on transparent, at a high resolution.
$markSize = 1024
$mark = New-Object System.Drawing.Bitmap($markSize, $markSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$mg = [System.Drawing.Graphics]::FromImage($mark)
$mg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$mg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$mg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$mg.Clear([System.Drawing.Color]::Transparent)
$scale = [Math]::Min(920.0 / $cropW, 920.0 / $cropH)
$dw = [int]($cropW * $scale)
$dh = [int]($cropH * $scale)
$dx = [int](($markSize - $dw) / 2)
$dy = [int](($markSize - $dh) / 2)
$mg.DrawImage($bitmap, (New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)), $minX, $minY, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel)
$mg.Dispose()
for ($y = 0; $y -lt $markSize; $y++) {
    for ($x = 0; $x -lt $markSize; $x++) {
        $c = $mark.GetPixel($x, $y)
        if ($c.A -lt 40 -or $c.R -lt 180) {
            $mark.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        } else {
            $mark.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, 255, 255, 255))
        }
    }
}

# ---------------------------------------------------------------------------
# 2. The launcher icon: a flat blue gradient with the white mark on it.
#    No circle inside a circle - the icon is one clean, flat symbol.
# ---------------------------------------------------------------------------
function Save-FlatIcon {
    param([int]$size, [string]$out, [switch]$Round)
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($size, $size)),
        [System.Drawing.Color]::FromArgb(255, 127, 212, 255),
        [System.Drawing.Color]::FromArgb(255, 20, 121, 214))
    $g.FillRectangle($brush, 0, 0, $size, $size)

    $inner = [int]($size * 0.62)
    $off = [int](($size - $inner) / 2)
    $g.DrawImage($mark, (New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)))

    if ($Round) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $size, $size)
        $clip = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $cg = [System.Drawing.Graphics]::FromImage($clip)
        $cg.SetClip($path)
        $cg.DrawImage($bmp, 0, 0)
        $cg.Dispose()
        $g.Dispose()
        $bmp.Dispose()
        $bmp = $clip
        $g = [System.Drawing.Graphics]::FromImage($bmp)
    }
    $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($key in $sizes.Keys) {
    $size = $sizes[$key]
    $dir = Join-Path $res "mipmap-$key"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Save-FlatIcon -size $size -out (Join-Path $dir 'ic_launcher.png')
    Save-FlatIcon -size $size -out (Join-Path $dir 'ic_launcher_round.png') -Round

    # Adaptive foreground: the 108dp launcher canvas with the mark in the
    # middle 62%. Filling the whole canvas is what made the home screen icon
    # look zoomed in and cropped.
    $fg = [int]($size * 2.25)
    $fbmp = New-Object System.Drawing.Bitmap($fg, $fg, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $fgp = [System.Drawing.Graphics]::FromImage($fbmp)
    $fgp.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $fgp.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fgp.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $fgp.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $fgp.Clear([System.Drawing.Color]::Transparent)
    $inner = [int]($fg * 0.58)
    $off = [int](($fg - $inner) / 2)
    $fgp.DrawImage($mark, (New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)))
    $fgp.Dispose()
    $fbmp.Save((Join-Path $dir 'ic_launcher_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $fbmp.Dispose()
}

# ---------------------------------------------------------------------------
# 3. The splash symbol: the flat white mark on black, one file per density so
#    it stays sharp on every screen.
# ---------------------------------------------------------------------------
function Save-JpegOnBlack {
    param([int]$w, [int]$h, [string]$out)
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)
    $inner = [int]($w * 0.62)
    $off = [int](($w - $inner) / 2)
    $g.DrawImage($mark, (New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)))
    $g.Dispose()
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)
    $bmp.Save($out, $codec, $params)
    $bmp.Dispose()
}

$splashSizes = @{ 'mdpi' = 288; 'hdpi' = 432; 'xhdpi' = 576; 'xxhdpi' = 864; 'xxxhdpi' = 1152 }
foreach ($key in $splashSizes.Keys) {
    $size = $splashSizes[$key]
    $dir = Join-Path $res "drawable-$key"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Save-JpegOnBlack -w $size -h $size -out (Join-Path $dir 'splash_logo.jpg')
}
Get-ChildItem -Path $res -Recurse -Filter 'splash_logo.png' -ErrorAction SilentlyContinue | Remove-Item -Force

# ---------------------------------------------------------------------------
# 4. The status bar icon: the same white mark, small and crisp.
# ---------------------------------------------------------------------------
$drawable = Join-Path $res 'drawable-nodpi'
New-Item -ItemType Directory -Force -Path $drawable | Out-Null
$notify = New-Object System.Drawing.Bitmap(96, 96, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ng = [System.Drawing.Graphics]::FromImage($notify)
$ng.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$ng.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ng.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ng.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$ng.Clear([System.Drawing.Color]::Transparent)
$inner = 84
$off = [int]((96 - $inner) / 2)
$ng.DrawImage($mark, (New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)))
$ng.Dispose()
$notify.Save((Join-Path $drawable 'ic_stat_notify.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$notify.Dispose()

$mark.Dispose()
$bitmap.Dispose()
$src.Dispose()

Write-Output 'Android icons generated.'
