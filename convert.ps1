Add-Type -AssemblyName PresentationCore
$src = "C:\Users\erfan\Downloads\IMG_7517.HEIC"
$uri = New-Object System.Uri($src, "Absolute")
$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
    $uri,
    [System.Windows.Media.Imaging.BitmapCreateOptions]::None,
    [System.Windows.Media.Imaging.BitmapCacheOption]::Default)
Write-Output ("HEIC frames: " + $decoder.Frames.Count)
$frame = $decoder.Frames[0]

foreach ($encType in @("PngBitmapEncoder","JpegBitmapEncoder")) {
    try {
        $encoder = New-Object System.Windows.Media.Imaging.$encType
        if ($encType -eq "JpegBitmapEncoder") { $encoder.QualityLevel = 90 }
        $encoder.Frames.Add($frame)
        $ext = if($encType -eq "PngBitmapEncoder"){"png"}else{"jpg"}
        $out = "public/images/erfan.$ext"
        $stream = New-Object System.IO.FileStream($out, [System.IO.FileMode]::Create)
        $encoder.Save($stream)
        $stream.Close()
        Write-Output "Saved $out"
        break
    } catch {
        Write-Output ($encType + " failed: " + $_.Exception.Message)
    }
}
