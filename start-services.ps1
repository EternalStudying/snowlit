$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$localEnvFile = Join-Path $projectRoot '.env.local'

if (Test-Path -LiteralPath $localEnvFile) {
    Get-Content -LiteralPath $localEnvFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith('#')) {
            return
        }

        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -le 0) {
            return
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1)
        if ($name.Length -gt 0) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

if (-not [string]::IsNullOrWhiteSpace($env:LOCAL_MINIO_ACCESS_KEY)) {
    $env:MINIO_ACCESS_KEY = $env:LOCAL_MINIO_ACCESS_KEY
}

if (-not [string]::IsNullOrWhiteSpace($env:LOCAL_MINIO_SECRET_KEY)) {
    $env:MINIO_SECRET_KEY = $env:LOCAL_MINIO_SECRET_KEY
}

if ([string]::IsNullOrWhiteSpace($env:LOCAL_DB_PASSWORD)) {
    Write-Host 'Backend local MySQL password is not configured.'
    Write-Host "You can create $localEnvFile with LOCAL_DB_PASSWORD=your_password, or enter it now."

    $securePassword = Read-Host 'Local MySQL root password' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $env:LOCAL_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($env:LOCAL_DB_PASSWORD)) {
    Write-Host ''
    Write-Host 'Backend was not started because LOCAL_DB_PASSWORD is empty.'
    exit 1
}

$frontendPath = Join-Path $projectRoot 'frontend'
$backendPath = Join-Path $projectRoot 'backend'

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $frontendPath -ArgumentList '/k', 'npm exec vite -- --host 0.0.0.0 --port 5173' -WindowStyle Normal
Start-Process -FilePath 'cmd.exe' -WorkingDirectory $backendPath -ArgumentList '/k', 'mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8080"' -WindowStyle Normal
