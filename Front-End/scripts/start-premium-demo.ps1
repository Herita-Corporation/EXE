[CmdletBinding()]
param([System.Net.IPAddress]$LanIp)

$ErrorActionPreference = 'Stop'

$frontEnd = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $frontEnd
$runtime = Join-Path $frontEnd 'node_modules/.cache/disa-premium-sdk'
$stack = Join-Path $runtime 'stack'
$testSettings = Join-Path $stack 'test.env'
$dotnet = Join-Path $runtime 'dotnet.exe'
$taskWorkdir = Join-Path $runtime 'voucher-artifacts/bin/Task.Presentation/debug'
$taskDll = Join-Path $workspace 'Disa-App/Task.Presentation/bin/Debug/net8.0/Task.Presentation.dll'
$aiTourWorkdir = Join-Path $runtime 'artifacts/bin/AITour.Presentation/debug'

if (-not (Test-Path -LiteralPath $taskDll -PathType Leaf)) {
    $taskDll = Join-Path $taskWorkdir 'Task.Presentation.dll'
}
foreach ($requiredFile in @($testSettings, $dotnet, $taskDll, (Join-Path $aiTourWorkdir 'AITour.Presentation.dll'))) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Missing a file from the existing Premium demo setup: $requiredFile"
    }
}

if (-not $LanIp) {
    $adapters = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -in 'Wireless80211', 'Ethernet' } |
        Sort-Object { $_.NetworkInterfaceType -ne 'Wireless80211' }
    $LanIp = foreach ($adapter in $adapters) {
        $network = $adapter.GetIPProperties()
        if (-not ($network.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' })) { continue }
        $address = $network.UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
        if ($address) { $address.Address; break }
    }
}
if (-not $LanIp -or $LanIp.AddressFamily -ne 'InterNetwork') {
    throw 'Connect this computer to Wi-Fi or pass its IPv4 address using -LanIp.'
}

$docker = (Get-Command docker.exe).Source
$node = (Get-Command node.exe).Source

function Wait-DemoReady($Name, [scriptblock]$Ready) {
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        if (& $Ready) { return }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Name is not ready. Check the demo logs in $stack."
}

function Test-DockerReady {
    try {
        $null = & $docker info --format '{{.ServerVersion}}' 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Start-DemoContainer($Name) {
    $running = & $docker inspect --format '{{.State.Running}}' $Name
    if ($LASTEXITCODE -ne 0) { throw "The existing demo container $Name is missing." }
    if ($running -ne 'true') {
        $null = & $docker start $Name
        if ($LASTEXITCODE -ne 0) { throw "Could not start $Name." }
    }
}

function Test-DemoUrl($Url, $ExpectedText) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -eq 200 -and (!$ExpectedText -or $response.Content.Contains($ExpectedText))
    } catch {
        return $false
    }
}

function Start-DemoProcess($Name, $Executable, [string[]]$Arguments, $WorkingDirectory, $HealthUrl, $ExpectedText) {
    if (Test-DemoUrl $HealthUrl $ExpectedText) { return }
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stack "start-$Name.out.log") `
        -RedirectStandardError (Join-Path $stack "start-$Name.err.log")
    Wait-DemoReady $Name {
        if ($process.HasExited) { throw "$Name stopped. Check start-$Name.err.log and start-$Name.out.log in $stack." }
        Test-DemoUrl $HealthUrl $ExpectedText
    }
}

Write-Host 'Starting the demo APIs...'
if (-not (Test-DockerReady)) {
    & $docker desktop start --detach
    if ($LASTEXITCODE -ne 0) { throw 'Could not start Docker Desktop.' }
    Wait-DemoReady 'Docker Desktop' { Test-DockerReady }
}

$sqlContainer = 'disa-premium-test-sql-1'
$itineraryDb = 'disa-premium-test-itinerary-db-1'
Start-DemoContainer $sqlContainer
Start-DemoContainer $itineraryDb
Wait-DemoReady 'Demo SQL Server' { (& $docker inspect --format '{{.State.Health.Status}}' $sqlContainer) -eq 'healthy' }
Start-DemoContainer 'disa-premium-test-iam-1'
Wait-DemoReady 'Demo sign-in' { Test-DemoUrl 'http://127.0.0.1:15195/swagger/index.html' }
Wait-DemoReady 'Demo itinerary database' { (& $docker inspect --format '{{.State.Health.Status}}' $itineraryDb) -eq 'healthy' }
Start-DemoContainer 'disa-premium-test-itinerary-1'
Wait-DemoReady 'Demo itinerary API' { Test-DemoUrl 'http://127.0.0.1:18000/health' }

$settings = @{}
Get-Content -LiteralPath $testSettings | ForEach-Object {
    if ($_ -match '^(DISA_TEST_SQL_PASSWORD|DISA_TEST_JWT)=(.*)$') {
        $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
if (-not $settings.DISA_TEST_SQL_PASSWORD -or -not $settings.DISA_TEST_JWT) {
    throw 'The saved demo settings are incomplete.'
}

$connection = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
$connection['Data Source'] = '127.0.0.1,15433'
$connection['Initial Catalog'] = 'TaskDb'
$connection['User ID'] = 'sa'
$connection['Password'] = $settings.DISA_TEST_SQL_PASSWORD
$connection['TrustServerCertificate'] = $true
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_ENVIRONMENT = 'Development'
$env:Logging__EventLog__LogLevel__Default = 'None'
$env:Jwt__Key = $settings.DISA_TEST_JWT
$env:Jwt__Issuer = 'IAMService'
$env:Jwt__Audience = 'IAMClient'
$env:Premium__DemoCheckoutEnabled = 'true'
$env:ConnectionStrings__TaskDb = $connection.ConnectionString
$env:ASPNETCORE_URLS = 'http://0.0.0.0:15020'
Start-DemoProcess 'task' $dotnet ('"{0}"' -f $taskDll) $taskWorkdir 'http://127.0.0.1:15020/api/premium/plans' 'premium-1m'
Remove-Item Env:ConnectionStrings__TaskDb

$env:ASPNETCORE_URLS = 'http://0.0.0.0:15289'
$env:AIItinerary__BaseUrl = 'http://127.0.0.1:18000'
$env:AIItinerary__TimeoutSeconds = '120'
$env:PremiumTasks__BaseUrl = 'http://127.0.0.1:15020'
Start-DemoProcess 'aitour' $dotnet 'AITour.Presentation.dll' $aiTourWorkdir 'http://127.0.0.1:15289/swagger/index.html'
Remove-Item Env:Jwt__Key

Write-Host 'Starting Expo Go for the demo...'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanIp.IPAddressToString
$env:EXPO_PUBLIC_DISA_PREMIUM_TEST_API_URL = "http://${LanIp}:8082/__disa-test"
$expoArgs = @('node_modules/expo/bin/cli', 'start', '--go', '--port', '8082', '--offline')
Start-DemoProcess 'expo' $node $expoArgs $frontEnd "http://${LanIp}:8082/__disa-test/task/api/premium/plans" 'premium-1m'

Write-Host "Ready. Open exp://${LanIp}:8082 in Expo Go on the same Wi-Fi network."
