# =========================================
# SCRIPT PARA CORRIGIR ENCODING UTF-8
# =========================================

$arquivos = @(
    "js\app.js",
    "js\generator.js",
    "js\config.js",
    "js\supabase.js",
    "js\storage.js",
    "js\history.js",
    "js\dashboard.js",
    "js\export.js"
)

Write-Host "🔧 Corrigindo encoding UTF-8 dos arquivos JS..." -ForegroundColor Cyan

foreach ($arquivo in $arquivos) {
    if (Test-Path $arquivo) {
        Write-Host "  📝 Processando: $arquivo" -ForegroundColor Yellow
        
        # Ler conteúdo
        $content = Get-Content $arquivo -Raw -Encoding UTF8
        
        # Criar encoding UTF-8 sem BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        
        # Salvar com UTF-8 correto
        [System.IO.File]::WriteAllText("$PWD\$arquivo", $content, $utf8NoBom)
        
        Write-Host "  ✅ Corrigido!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Não encontrado: $arquivo" -ForegroundColor Red
    }
}

Write-Host "`n✅ Encoding corrigido para todos os arquivos!" -ForegroundColor Green
Write-Host "   Recarregue a página (Ctrl+Shift+R)" -ForegroundColor Cyan
