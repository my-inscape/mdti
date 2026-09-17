<#
  16タイプ一覧シートから各キャラクターを切り出して assets/types/ に保存する。

    powershell -ExecutionPolicy Bypass -File tools\crop-sprites.ps1
#>
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class Sheet {
  static byte[] buf; static int stride, W, H;

  public static void Load(string path) {
    Bitmap bmp = new Bitmap(path);
    W = bmp.Width; H = bmp.Height;
    BitmapData d = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    stride = d.Stride;
    buf = new byte[stride * H];
    Marshal.Copy(d.Scan0, buf, 0, buf.Length);
    bmp.UnlockBits(d);
    bmp.Dispose();
  }

  static bool Ink(int x, int y, int th) {
    int i = y * stride + x * 4;
    if (buf[i+3] < 16) return false;
    int lum = (buf[i+2]*299 + buf[i+1]*587 + buf[i]*114) / 1000;
    return lum < th;
  }

  public static string Bounds(int wx0, int wy0, int wx1, int wy1, int th) {
    int minX = int.MaxValue, minY = int.MaxValue, maxX = -1, maxY = -1;
    for (int y = wy0; y <= wy1; y++)
      for (int x = wx0; x <= wx1; x++)
        if (Ink(x,y,th)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    return minX + " " + minY + " " + maxX + " " + maxY;
  }
}
"@ -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root 'assets\mdti-sheet.png'
$outDir = Join-Path $root 'assets\types'
if (-not (Test-Path $src)) { throw "source sheet not found: $src" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# 印刷順（行優先）
$codes = @(
  @('ORSK','ORAK','IRSD','ICSD'),
  @('IRAK','ICAK','ICSK','IRSK'),
  @('ORSD','ORAD','OCSD','OCSK'),
  @('ICAD','OCAD','OCAK','IRAD')
)

# 左サイドバー（GROUP帯）を除外した4列。行境界はシートの余白帯から計測
$colBands = @(
  @{ x = @(136, 309) },
  @{ x = @(352, 532) },
  @{ x = @(576, 752) },
  @{ x = @(787, 993) }
)
$rowEdges = @(3, 191, 360, 519, 670)

[Sheet]::Load($src)
$img = [System.Drawing.Image]::FromFile($src)

$pad = 6
$targetRatio = 4 / 3
$scale = 2

for ($c = 0; $c -lt 4; $c++) {
  $x0 = $colBands[$c].x[0]; $x1 = $colBands[$c].x[1]
  for ($r = 0; $r -lt 4; $r++) {
    $gy0 = $rowEdges[$r]; $gy1 = $rowEdges[$r + 1] - 1
    $b = ([Sheet]::Bounds($x0, $gy0, $x1, $gy1, 246)) -split ' '
    $bx0 = [int]$b[0]; $by0 = [int]$b[1]; $bx1 = [int]$b[2]; $by1 = [int]$b[3]
    if ($bx0 -gt $bx1) { Write-Host "EMPTY $($codes[$r][$c])"; continue }

    $cx0 = [math]::Max($x0, $bx0 - $pad)
    $cy0 = [math]::Max($gy0, $by0 - $pad)
    $cx1 = [math]::Min($x1, $bx1 + $pad)
    $cy1 = [math]::Min($gy1, $by1 + $pad)
    $cw = $cx1 - $cx0 + 1
    $chh = $cy1 - $cy0 + 1

    if (($cw / $chh) -lt $targetRatio) {
      $tw = [int][math]::Ceiling($chh * $targetRatio); $th = $chh
    } else {
      $tw = $cw; $th = [int][math]::Ceiling($cw / $targetRatio)
    }

    $bmp = New-Object System.Drawing.Bitmap ($tw * $scale), ($th * $scale)
    $g2 = [System.Drawing.Graphics]::FromImage($bmp)
    $g2.Clear([System.Drawing.Color]::White)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $dest = New-Object System.Drawing.Rectangle `
      ([int](($tw - $cw) / 2 * $scale)), ([int](($th - $chh) / 2 * $scale)), `
      ($cw * $scale), ($chh * $scale)
    $g2.DrawImage($img, $dest, $cx0, $cy0, $cw, $chh, [System.Drawing.GraphicsUnit]::Pixel)
    $g2.Dispose()

    $code = $codes[$r][$c]
    $bmp.Save((Join-Path $outDir "$code.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("{0}: src({1},{2}) {3}x{4}" -f $code, $cx0, $cy0, $cw, $chh)
  }
}

$img.Dispose()
Write-Host "done → assets/types/*.png"
