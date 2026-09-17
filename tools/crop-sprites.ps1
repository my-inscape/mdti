Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

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

  // "x0 y0 x1 y1" tight ink bounds inside the given window
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

  // non-empty row runs (merged across gaps <= gap) inside an x range
  public static string RowGroups(int x0, int x1, int th, int gap) {
    bool[] hit = new bool[H];
    for (int y = 0; y < H; y++)
      for (int x = x0; x <= x1; x++)
        if (Ink(x,y,th)) { hit[y] = true; break; }

    StringBuilder sb = new StringBuilder();
    int start = -1, lastOn = -1;
    for (int y = 0; y < H; y++) {
      if (hit[y]) {
        if (start < 0) start = y;
        lastOn = y;
      } else if (start >= 0 && y - lastOn > gap) {
        sb.Append(start + ":" + lastOn + ";");
        start = -1;
      }
    }
    if (start >= 0) sb.Append(start + ":" + lastOn + ";");
    return sb.ToString();
  }
}
"@ -ReferencedAssemblies System.Drawing

$src = "C:\Users\ds231k10085\.cursor\projects\c-Users-ds231k10085-Desktop-mdti\assets\c__Users_ds231k10085_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_S__181346306-294ec7db-7d0d-4dd2-b18f-814f8a4e9f7c.png"
$outDir = "C:\Users\ds231k10085\Desktop\mdti\assets\types"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# codes in the printed order of the source sheet (row major)
$codes = @(
  @('ORSK','ORAK','IRSD','ICSD'),
  @('IRAK','ICAK','ICSK','IRSK'),
  @('ORSD','ORAD','OCSD','OCSK'),
  @('ICAD','OCAD','OCAK','IRAD')
)
# x range of each column + the three row split lines found in the sheet's
# whitespace gaps (rows are not evenly pitched, and artwork overhangs vary)
$colBands = @(
  @{ x = @(16, 242);   splits = @(199, 343, 496) },
  @{ x = @(266, 497);  splits = @(183, 343, 494) },
  @{ x = @(520, 756);  splits = @(196, 343, 495) },
  @{ x = @(778, 1006); splits = @(197, 341, 496) }
)

[Sheet]::Load($src)
$img = [System.Drawing.Image]::FromFile($src)

$pad = 8          # breathing room around the artwork, in source px
$targetRatio = 4 / 3
$scale = 2

for ($c = 0; $c -lt 4; $c++) {
  $x0 = $colBands[$c].x[0]; $x1 = $colBands[$c].x[1]
  $edges = @(0) + $colBands[$c].splits + @(681)

  for ($r = 0; $r -lt 4; $r++) {
    $gy0 = $edges[$r]; $gy1 = $edges[$r + 1]
    $b = ([Sheet]::Bounds($x0, $gy0, $x1, $gy1, 246)) -split ' '
    $bx0 = [int]$b[0]; $by0 = [int]$b[1]; $bx1 = [int]$b[2]; $by1 = [int]$b[3]

    # pad the artwork, but never reach past the column gutter into a neighbour
    $cx0 = [math]::Max($x0 - $pad, $bx0 - $pad)
    $cy0 = [math]::Max($gy0, $by0 - $pad)
    $cx1 = [math]::Min($x1 + $pad, $bx1 + $pad)
    $cy1 = [math]::Min($gy1, $by1 + $pad)
    $cw = $cx1 - $cx0 + 1
    $chh = $cy1 - $cy0 + 1

    # centre it on a white canvas so every tile shares one aspect ratio
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

# keep the full sheet for the gallery / OG image
Copy-Item $src "C:\Users\ds231k10085\Desktop\mdti\assets\mdti-sheet.png" -Force
Write-Host "done"
