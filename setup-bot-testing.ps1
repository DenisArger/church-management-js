# PowerShell script for Telegram bot testing with ngrok

Write-Host "Setting up Church Telegram Bot testing..." -ForegroundColor Green

# Check if local server is running
Write-Host "Checking local server..." -ForegroundColor Yellow
$serverRunning = netstat -ano | Select-String ":8888"
if ($serverRunning) {
    Write-Host "Local server is running on port 8888" -ForegroundColor Green
} else {
    Write-Host "Local server is not running. Start with: yarn netlify:dev" -ForegroundColor Red
    exit 1
}

# Start ngrok in background
Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
$ngrokPath = "C:\ProgramData\chocolatey\bin\ngrok.exe"
$ngrokJob = Start-Job -ScriptBlock { param($path) & $path http 8888 --log=stdout } -ArgumentList $ngrokPath

# Wait for ngrok to start
Write-Host "Waiting for ngrok to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Get tunnel URL
Write-Host "Getting tunnel URL..." -ForegroundColor Yellow
try {
    $tunnelResponse = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $tunnelUrl = $tunnelResponse.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if (-not $tunnelUrl) {
        Write-Host "Failed to get tunnel URL" -ForegroundColor Red
        Stop-Job $ngrokJob
        Remove-Job $ngrokJob
        exit 1
    }
    
    Write-Host "Ngrok tunnel created: $tunnelUrl" -ForegroundColor Green
} catch {
    Write-Host "Error getting tunnel URL: $($_.Exception.Message)" -ForegroundColor Red
    Stop-Job $ngrokJob
    Remove-Job $ngrokJob
    exit 1
}

# Form webhook URL
$webhookUrl = "$tunnelUrl/.netlify/functions/telegram-webhook"
Write-Host "Webhook URL: $webhookUrl" -ForegroundColor Cyan

# Get bot token from .env
$envContent = Get-Content .env -Raw
$botTokenMatch = [regex]::Match($envContent, 'TELEGRAM_BOT_TOKEN=(.+)')
$botToken = $botTokenMatch.Groups[1].Value.Trim('"')

if (-not $botToken) {
    Write-Host "TELEGRAM_BOT_TOKEN not found in .env file" -ForegroundColor Red
    Stop-Job $ngrokJob
    Remove-Job $ngrokJob
    exit 1
}

Write-Host "Setting up webhook for bot..." -ForegroundColor Yellow

# Set webhook
$webhookPayload = @{
    url = $webhookUrl
} | ConvertTo-Json

try {
    $webhookResponse = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Method Post -Body $webhookPayload -ContentType "application/json"
    Write-Host "Telegram API response: $($webhookResponse | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Error setting webhook: $($_.Exception.Message)" -ForegroundColor Red
}

# Check webhook status
Write-Host "Checking webhook status..." -ForegroundColor Yellow
try {
    $webhookInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo" -Method Get
    Write-Host "Webhook info: $($webhookInfo | ConvertTo-Json)" -ForegroundColor Cyan
} catch {
    Write-Host "Error getting webhook info: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Setup completed!" -ForegroundColor Green
Write-Host "Now you can test the bot in Telegram:" -ForegroundColor Yellow
Write-Host "  - Write to bot: @GomelGraceBot" -ForegroundColor White
Write-Host "  - Try commands: /create_poll, /request_pray, /daily_scripture" -ForegroundColor White
Write-Host ""
Write-Host "Ngrok URL: $tunnelUrl" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red

# Wait for termination signal
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "Termination signal received..." -ForegroundColor Yellow
} finally {
    Write-Host "Stopping ngrok..." -ForegroundColor Yellow
    Stop-Job $ngrokJob
    Remove-Job $ngrokJob
}
