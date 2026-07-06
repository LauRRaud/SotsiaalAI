param(
    [string]$Message = "",
    [string]$SshTarget = "sotsiaalai"
)

if (-not $Message -or $Message -eq "") {
    $Message = "SotsiaalAI full deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

Write-Host "Git commit ja push (kohalik)..." 
git add .

try {
    git commit -m $Message
} catch {
    Write-Host "Ei olnud midagi committida, jätkan deployga..."
}

git push origin main

Write-Host "Täis deploy serverisse (backend + frontend + Prisma)..." 

ssh $SshTarget 'cd /home/ubuntu/apps/sotsiaalai; git pull; npm ci; npm run prisma:prepare:prod; npm run build; sudo systemctl restart sotsiaalai-rag.service; sudo systemctl status sotsiaalai-rag.service --no-pager; sudo systemctl restart sotsiaalai-frontend.service; sudo systemctl status sotsiaalai-frontend.service --no-pager'

Write-Host "Valmis."
