$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "scripts/ai-deploy.mjs") @args
exit $LASTEXITCODE
