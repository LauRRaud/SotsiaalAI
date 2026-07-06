param(
    [Alias("m")]
    [string]$Message,
    [switch]$SkipDeploy,
    [switch]$SkipBuild,
    [switch]$AllowSecrets
)

$script = Join-Path $PSScriptRoot "scripts\ai-deploy.mjs"
$deployArgs = @()

if ($Message) {
    $deployArgs += @("--message", $Message)
}

if ($SkipDeploy) {
    $deployArgs += "--skip-deploy"
}

if ($SkipBuild) {
    $deployArgs += "--skip-build"
}

if ($AllowSecrets) {
    $deployArgs += "--allow-secrets"
}

node $script @deployArgs
exit $LASTEXITCODE
