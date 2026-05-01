# Generates 24x24 monochrome line-art icons for the plugin suite.
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\tools\generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$strokeColor = [System.Drawing.Color]::FromArgb(255, 58, 74, 90)   # #3A4A5A
$fillColor   = [System.Drawing.Color]::FromArgb(255, 58, 74, 90)
$transparent = [System.Drawing.Color]::Transparent
$pen = New-Object System.Drawing.Pen($strokeColor, 2)
$pen.LineJoin  = [System.Drawing.Drawing2D.LineJoin]::Round
$pen.StartCap  = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap    = [System.Drawing.Drawing2D.LineCap]::Round
$brush = New-Object System.Drawing.SolidBrush($fillColor)

function New-Canvas {
    $bmp = New-Object System.Drawing.Bitmap(24, 24, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode  = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($transparent)
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Icon($canvas, $path) {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Dispose()
    Write-Host "Wrote $path"
}

# --- advWaterfall: cascading horizontal bars (waterfall stepping rightward) ---
$c = New-Canvas
$g = $c.Graphics
$g.FillRectangle($brush,  3,  5,  9, 3)   # top bar
$g.FillRectangle($brush,  9, 10, 10, 3)   # mid bar (offset right)
$g.FillRectangle($brush, 12, 15,  9, 3)   # bottom bar (further right)
$g.FillRectangle($brush, 18, 19,  3, 2)   # final tick / endcap
Save-Icon $c "src\customviz\com-company-advWaterfall\advWaterfallIcon.png"

# --- decompTree: hierarchy fanning right (1 -> 2 -> 4 nodes) ---
$c = New-Canvas
$g = $c.Graphics
# nodes
$g.FillRectangle($brush, 2, 11, 3, 3)     # root
$g.FillRectangle($brush, 10, 6, 3, 3)     # child 1 (top)
$g.FillRectangle($brush, 10, 16, 3, 3)    # child 2 (bottom)
$g.FillRectangle($brush, 19, 3, 3, 3)     # gc top-top
$g.FillRectangle($brush, 19, 9, 3, 3)     # gc top-bot
$g.FillRectangle($brush, 19, 13, 3, 3)    # gc bot-top
$g.FillRectangle($brush, 19, 19, 3, 3)    # gc bot-bot
# connectors
$g.DrawLine($pen, 5, 12, 10, 7)
$g.DrawLine($pen, 5, 13, 10, 17)
$g.DrawLine($pen, 13, 7, 19, 4)
$g.DrawLine($pen, 13, 8, 19, 10)
$g.DrawLine($pen, 13, 17, 19, 14)
$g.DrawLine($pen, 13, 18, 19, 20)
Save-Icon $c "src\customviz\com-company-decompTree\decompTreeIcon.png"

# --- targetBar: 3 horizontal bars with vertical target hash crossing them ---
$c = New-Canvas
$g = $c.Graphics
$g.FillRectangle($brush, 3,  5, 14, 3)    # bar 1
$g.FillRectangle($brush, 3, 11,  9, 3)    # bar 2 (shorter, below target)
$g.FillRectangle($brush, 3, 17, 16, 3)    # bar 3
# vertical target hash
$tickPen = New-Object System.Drawing.Pen($strokeColor, 2)
$tickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$tickPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($tickPen, 14, 3, 14, 22)
Save-Icon $c "src\customviz\com-company-targetBar\targetBarIcon.png"

$pen.Dispose()
$brush.Dispose()
Write-Host "All icons generated."
