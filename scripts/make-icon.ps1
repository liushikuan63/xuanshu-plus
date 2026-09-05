# 生成玄枢五术工作台 App 图标（米色底 + 八卦环 + 太极）
# 输出: 各密度 legacy 图标 + adaptive foreground（透明底居中缩放）+ 更新背景色
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$resBase = 'd:\Java\GitHub\xuanshu-plus\apps\web\android\app\src\main\res'

function New-IconCanvas([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  return @($bmp, $g)
}

function Draw-Master([System.Drawing.Graphics]$g, [double]$s) {
  $w = 1024 * $s
  $c = $w / 2
  $bg  = [System.Drawing.ColorTranslator]::FromHtml('#F5F0E8')
  $brown = [System.Drawing.ColorTranslator]::FromHtml('#6B4F2F')
  $gold = [System.Drawing.ColorTranslator]::FromHtml('#C9A227')

  $g.Clear($bg)

  # 太极
  $r  = 165 * $s
  $r1 = 82.5 * $s
  $pen = New-Object System.Drawing.Pen($brown, [single](12 * $s))
  $solidBrown = New-Object System.Drawing.SolidBrush($brown)
  $solidBg = New-Object System.Drawing.SolidBrush($bg)
  $solidGold = New-Object System.Drawing.SolidBrush($gold)

  $left = New-Object System.Drawing.Drawing2D.GraphicsPath
  $left.AddArc([single]($c - $r), [single]($c - $r), [single](2 * $r), [single](2 * $r), 90, 180)
  $left.CloseFigure()
  $g.FillPath($solidBrown, $left)
  $g.FillEllipse($solidBg, [single]($c), [single]($c - $r), [single](2 * $r), [single](2 * $r))
  $g.DrawEllipse($pen, [single]($c - $r), [single]($c - $r), [single](2 * $r), [single](2 * $r))
  $g.FillEllipse($solidBg, [single]($c - $r), [single]($c - $r1), [single](2 * $r1), [single](2 * $r1))
  $g.FillEllipse($solidGold, [single]($c - 4 * $s), [single]($c - 4 * $s), [single](8 * $s), [single](8 * $s))
  $g.FillEllipse($solidBrown, [single]($c), [single]($c - $r1), [single](2 * $r1), [single](2 * $r1))
  $g.FillEllipse($solidGold, [single]($c - 4 * $s), [single]($c - 4 * $s), [single](8 * $s), [single](8 * $s))

  # 八卦外环
  $rr = 375 * $s
  $ringPen = New-Object System.Drawing.Pen($brown, [single](14 * $s))
  $g.DrawEllipse($ringPen, [single]($c - $rr), [single]($c - $rr), [single](2 * $rr), [single](2 * $rr))

  # 八卦三爻（外缘径向短线，阳爻长/阴爻短）
  $trigrams = @('111','110','101','100','011','010','001','000')
  $longBar = 74 * $s; $shortBar = 40 * $s; $barW = 15 * $s
  $barPen = New-Object System.Drawing.Pen($brown, [single]$barW)
  $barPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $barPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  for ($i = 0; $i -lt 8; $i++) {
    $angle = $i * 45
    $tg = $trigrams[$i]
    $t = [System.Drawing.Drawing2D.Matrix]::new()
    $t.Translate([single]$c, [single]$c)
    $t.Rotate($angle)
    $g.Transform = $t
    for ($j = 0; $j -lt 3; $j++) {
      $len = if ($tg[$j] -eq '1') { $longBar } else { $shortBar }
      $y1 = -($rr + 90 * $s) + $j * (34 * $s)
      $y2 = $y1 + $len
      $g.DrawLine($barPen, [single]0, [single]$y1, [single]0, [single]$y2)
    }
    $g.ResetTransform()
  }
  $g.Dispose()
}

# 1) legacy 图标
$legacy = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
foreach ($k in $legacy.Keys) {
  $size = $legacy[$k]
  foreach ($file in @('ic_launcher.png', 'ic_launcher_round.png')) {
    $b, $g = New-IconCanvas $size
    Draw-Master $g ($size / 1024.0)
    $out = Join-Path (Join-Path $resBase "mipmap-$k") $file
    $b.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $b.Dispose()
    Write-Host "OK legacy $k/$file"
  }
}

# 2) adaptive foreground（108dp 画布，内容居中 66%）
$fg = @{ mdpi = 108; hdpi = 162; xhdpi = 216; xxhdpi = 324; xxxhdpi = 432 }
foreach ($k in $fg.Keys) {
  $size = $fg[$k]
  $b, $g = New-IconCanvas $size
  $g.Clear([System.Drawing.Color]::Transparent)
  $draw = [single]($size * 0.66)
  $g.TranslateTransform(($size - $draw) / 2, ($size - $draw) / 2)
  $g.ScaleTransform($draw / 1024.0, $draw / 1024.0)
  Draw-Master $g 1.0
  $out = Join-Path (Join-Path $resBase "mipmap-$k") 'ic_launcher_foreground.png'
  $b.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  Write-Host "OK fg $k"
}

# 3) 背景色主题化
$colorFile = Join-Path $resBase 'values\ic_launcher_background.xml'
[System.IO.File]::WriteAllText($colorFile, "<?xml version=`"1.0`" encoding=`"utf-8`"?>`n<resources>`n    <color name=`"ic_launcher_background`">#F5F0E8</color>`n</resources>`n", (New-Object System.Text.UTF8Encoding($true)))

Write-Host 'ALL DONE'