param(
  [int]$Port = 8000,
  [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd("\", "/")
$rootPrefix = $rootPath + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.Sockets.TcpListener]::new(
  [System.Net.IPAddress]::Loopback,
  $Port
)

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8",
    [bool]$IncludeBody = $true
  )

  $header = @(
    "HTTP/1.1 $StatusCode $StatusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Cache-Control: no-cache"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($IncludeBody -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

try {
  $listener.Start()
  Write-Output "Shopping list server: http://localhost:$Port/"

  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new(
        $stream,
        [System.Text.Encoding]::ASCII,
        $false,
        1024,
        $true
      )
      $requestLine = $reader.ReadLine()

      while ($reader.ReadLine()) {
        # Read and discard request headers.
      }

      if ($requestLine -notmatch "^(GET|HEAD)\s+([^\s]+)\s+HTTP/") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
        Write-Response $stream 400 "Bad Request" $body
        continue
      }

      $method = $Matches[1]
      $requestPath = [System.Uri]::UnescapeDataString(($Matches[2] -split "\?")[0])
      if ($requestPath.EndsWith("/")) {
        $requestPath += "index.html"
      }

      $relativePath = $requestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $relativePath))
      $isInsideRoot = $filePath.StartsWith(
        $rootPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
      )

      if (-not $isInsideRoot -or -not [System.IO.File]::Exists($filePath)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Write-Response $stream 404 "Not Found" $body -IncludeBody ($method -eq "GET")
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($filePath)
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = $contentTypes[$extension]
      if (-not $contentType) {
        $contentType = "application/octet-stream"
      }

      Write-Response $stream 200 "OK" $body $contentType -IncludeBody ($method -eq "GET")
    }
    catch {
      if ($stream -and $stream.CanWrite) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
        Write-Response $stream 500 "Internal Server Error" $body
      }
    }
    finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Dispose()
    }
  }
}
finally {
  $listener.Stop()
}
