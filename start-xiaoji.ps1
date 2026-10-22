$ErrorActionPreference = "Stop"
$port = 4173
$root = $PSScriptRoot
$prefix = "http://localhost:$port/"
$listener = [System.Net.HttpListener]::new()

try {
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    Start-Process $prefix

    Write-Host ""
    Write-Host "Bing Xiaoji is running:" -ForegroundColor Green
    Write-Host $prefix
    Write-Host ""
    Write-Host "Keep this window open. Press Ctrl+C to stop."

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart("/")
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = "index.html"
        }

        $relativePath = $relativePath -replace "/", "\"
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))

        if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
        }

        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = switch ($extension) {
            ".html" { "text/html; charset=utf-8" }
            ".css" { "text/css; charset=utf-8" }
            ".js" { "text/javascript; charset=utf-8" }
            ".webmanifest" { "application/manifest+json; charset=utf-8" }
            ".svg" { "image/svg+xml" }
            default { "application/octet-stream" }
        }

        $content = [System.IO.File]::ReadAllBytes($filePath)
        $context.Response.ContentType = $contentType
        $context.Response.ContentLength64 = $content.Length
        $context.Response.OutputStream.Write($content, 0, $content.Length)
        $context.Response.Close()
    }
}
catch {
    Write-Host ""
    Write-Host "Could not start Bing Xiaoji: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "If Bing Xiaoji is already open, close its previous console window and try again."
    Read-Host "Press Enter to close"
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
