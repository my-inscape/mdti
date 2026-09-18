# Generate assets/ogp/{CODE}.png and result/{CODE}/index.html
# powershell -ExecutionPolicy Bypass -File tools\generate-ogp-pages.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$site = 'https://muda.my-inscape.com'
$ogpDir = Join-Path $root 'assets\ogp'
$resultRoot = Join-Path $root 'result'
$metaPath = Join-Path $root 'tools\types-meta.json'
New-Item -ItemType Directory -Force -Path $ogpDir | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding $false
$types = Get-Content $metaPath -Encoding UTF8 | ConvertFrom-Json
if ($types.Count -ne 16) { throw "expected 16 types" }

function Min2([double]$a, [double]$b) { if ($a -lt $b) { $a } else { $b } }

function HtmlEnc([string]$s) {
  return [System.Net.WebUtility]::HtmlEncode($s)
}

function New-OgpCard($item) {
  $code = $item.code
  $art = [System.Drawing.Image]::FromFile((Join-Path $root "assets\types\$code.png"))
  $bmp = New-Object System.Drawing.Bitmap 1200, 630
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#FAF8F5'))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $tint = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F4EFEA'))
  $g.FillRectangle($tint, 620, 0, 580, 630)
  $tint.Dispose()

  $boxW = 470.0; $boxH = 480.0
  $scale = Min2 (Min2 ($boxW / $art.Width) ($boxH / $art.Height)) 1.35
  $dw = [int]($art.Width * $scale)
  $dh = [int]($art.Height * $scale)
  $dx = 655 + [int](($boxW - $dw) / 2)
  $dy = 70 + [int](($boxH - $dh) / 2)
  $pad = 18
  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 58, 53, 48))
  $g.FillRectangle($shadow, $dx - $pad + 4, $dy - $pad + 8, $dw + $pad * 2, $dh + $pad * 2)
  $shadow.Dispose()
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillRectangle($white, $dx - $pad, $dy - $pad, $dw + $pad * 2, $dh + $pad * 2)
  $white.Dispose()
  $g.DrawImage($art, $dx, $dy, $dw, $dh)

  $fb = New-Object System.Drawing.Font('Yu Gothic UI', 18)
  $fc = New-Object System.Drawing.Font('Segoe UI', 68, [System.Drawing.FontStyle]::Bold)
  $fn = New-Object System.Drawing.Font('Yu Gothic UI', 22, [System.Drawing.FontStyle]::Bold)
  $ff = New-Object System.Drawing.Font('Yu Gothic UI', 14)
  $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#9A9186'))
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#3A3530'))
  $brand = [System.Text.Encoding]::UTF8.GetString([byte[]](0x4D,0x55,0x44,0x41,0xE3,0x83,0x91,0xE3,0x83,0xBC,0xE3,0x82,0xBD,0xE3,0x83,0x8A,0xE3,0x83,0xAB,0xE8,0xA8,0xBA,0xE6,0x96,0xAD))
  $foot = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE6,0x84,0x9B,0xE3,0x81,0x8A,0xE3,0x81,0x97,0xE3,0x81,0x84,0xE7,0x84,0xA1,0xE9,0xA7,0x84,0xE3,0x82,0x92,0xE8,0xA6,0xB3,0xE6,0xB8,0xAC,0xE3,0x81,0x99,0xE3,0x82,0x8B,0x31,0x36,0xE3,0x82,0xBF,0xE3,0x82,0xA4,0xE3,0x83,0x97))
  $g.DrawString($brand, $fb, $soft, 70, 70)
  $g.DrawString($code, $fc, $ink, 60, 130)
  $g.DrawString([string]$item.name, $fn, $ink, 70, 320)
  $g.DrawString($foot, $ff, $soft, 70, 560)
  foreach ($x in @($fb,$fc,$fn,$ff,$soft,$ink)) { $x.Dispose() }

  $bmp.Save((Join-Path $ogpDir ($code + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $art.Dispose()
}

function New-ResultPage($item) {
  $code = [string]$item.code
  $name = [string]$item.name
  $tagline = [string]$item.tagline

  # Build Japanese templates from UTF-8 byte sequences + dynamic fields
  $p1 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE7,0xA7,0x81,0xE3,0x81,0xAE,0xE6,0x84,0x9B,0xE3,0x81,0x8A,0xE3,0x81,0x97,0xE3,0x81,0x84,0xE7,0x84,0xA1,0xE9,0xA7,0x84,0xE3,0x81,0xAF,0xE3,0x80,0x90))
  $p2 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEF,0xBC,0x88)) # （
  $p3 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEF,0xBC,0x89,0xE3,0x80,0x91,0xE3,0x81,0xA7,0xE3,0x81,0x97,0xE3,0x81,0x9F,0xEF,0xBC,0x81)) # ）】でした！
  $ogTitle = $p1 + $name + $p2 + $code + $p3

  $d1 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE3,0x80,0x9C))
  $d2 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE3,0x80,0x9C,0x20,0xE5,0xBD,0xB9,0xE3,0x81,0xAB,0xE7,0xAB,0x8B,0xE3,0x81,0xA4,0xE8,0x87,0xAA,0xE5,0x88,0x86,0xE3,0x81,0xAF,0xE3,0x80,0x81,0xE5,0xB1,0xA5,0xE6,0xAD,0xB4,0xE6,0x9B,0xB8,0xE3,0x81,0xAB,0xE6,0x9B,0xB8,0xE3,0x81,0x91,0xE3,0x81,0xB0,0xE3,0x81,0x84,0xE3,0x81,0x84,0xE3,0x80,0x82))
  $ogDesc = $d1 + $tagline + $d2

  $t0 = [System.Text.Encoding]::UTF8.GetString([byte[]](0x4D,0x55,0x44,0x41,0xE3,0x83,0x91,0xE3,0x83,0xBC,0xE3,0x82,0xBD,0xE3,0x83,0x8A,0xE3,0x83,0xAB,0xE8,0xA8,0xBA,0xE6,0x96,0xAD,0x20,0x7C,0x20))
  $pageTitle = $t0 + $name + ' (' + $code + ')'

  $showLabel = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE7,0xB5,0x90,0xE6,0x9E,0x9C,0xE3,0x82,0x92,0xE8,0xA1,0xA8,0xE7,0xA4,0xBA,0xE3,0x81,0x99,0xE3,0x82,0x8B))

  $img = $site + '/assets/ogp/' + $code + '.png'
  $pageUrl = $site + '/result/' + $code + '/'
  $redirect = '/?result=' + $code

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('<!DOCTYPE html>')
  [void]$sb.AppendLine('<html lang="ja"><head>')
  [void]$sb.AppendLine('<meta charset="UTF-8">')
  [void]$sb.AppendLine('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
  [void]$sb.AppendLine('<title>' + (HtmlEnc $pageTitle) + '</title>')
  [void]$sb.AppendLine('<meta name="description" content="' + (HtmlEnc $ogDesc) + '">')
  [void]$sb.AppendLine('<meta property="og:type" content="website">')
  [void]$sb.AppendLine('<meta property="og:url" content="' + $pageUrl + '">')
  [void]$sb.AppendLine('<meta property="og:title" content="' + (HtmlEnc $ogTitle) + '">')
  [void]$sb.AppendLine('<meta property="og:description" content="' + (HtmlEnc $ogDesc) + '">')
  [void]$sb.AppendLine('<meta property="og:image" content="' + $img + '">')
  [void]$sb.AppendLine('<meta property="og:image:width" content="1200">')
  [void]$sb.AppendLine('<meta property="og:image:height" content="630">')
  [void]$sb.AppendLine('<meta property="og:image:type" content="image/png">')
  [void]$sb.AppendLine('<meta name="twitter:card" content="summary_large_image">')
  [void]$sb.AppendLine('<meta name="twitter:title" content="' + (HtmlEnc $ogTitle) + '">')
  [void]$sb.AppendLine('<meta name="twitter:description" content="' + (HtmlEnc $ogDesc) + '">')
  [void]$sb.AppendLine('<meta name="twitter:image" content="' + $img + '">')
  [void]$sb.AppendLine('<link rel="canonical" href="' + $pageUrl + '">')
  [void]$sb.AppendLine('<style>body{margin:0;font-family:"Yu Gothic UI","Hiragino Sans",sans-serif;background:#faf8f5;color:#3a3530;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}a{color:#6e665c}.card{max-width:420px}img{width:100%;max-width:360px;height:auto;border-radius:20px;background:#fff}h1{font-size:1.25rem;margin:16px 0 8px}p{font-size:.95rem;line-height:1.7;color:#6e665c}</style>')
  [void]$sb.AppendLine('<script>(function(){var ua=navigator.userAgent||"";if(/Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|Discordbot|WhatsApp/i.test(ua))return;location.replace("' + $redirect + '");})();</script>')
  [void]$sb.AppendLine('<noscript><meta http-equiv="refresh" content="0;url=' + $redirect + '"></noscript>')
  [void]$sb.AppendLine('</head><body><div class="card">')
  [void]$sb.AppendLine('<img src="/assets/ogp/' + $code + '.png" alt="' + (HtmlEnc $name) + ' (' + $code + ')">')
  [void]$sb.AppendLine('<h1>' + (HtmlEnc $name) + ' (' + $code + ')</h1>')
  [void]$sb.AppendLine('<p>' + (HtmlEnc ($d1 + $tagline + $d1)) + '</p>')
  [void]$sb.AppendLine('<p><a href="' + $redirect + '">' + (HtmlEnc $showLabel) + '</a></p>')
  [void]$sb.AppendLine('</div></body></html>')

  $dir = Join-Path $resultRoot $code
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $dir 'index.html'), $sb.ToString(), $utf8)
}

foreach ($item in $types) {
  New-OgpCard $item
  New-ResultPage $item
  Write-Host ('OK ' + $item.code)
}
Write-Host ('done ' + $types.Count)
