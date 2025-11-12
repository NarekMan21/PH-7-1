# Скрипт для добавления переменных окружения в Vercel
# Запустите: powershell -ExecutionPolicy Bypass -File add-env-vars.ps1

Write-Host "Добавление переменных окружения в Vercel..." -ForegroundColor Green

# SUPABASE_URL
Write-Host "`nДобавление SUPABASE_URL для Production..." -ForegroundColor Yellow
echo "https://dxbvnmvgrxsgexwtrhoh.supabase.co" | vercel env add SUPABASE_URL production

Write-Host "Добавление SUPABASE_URL для Preview..." -ForegroundColor Yellow
echo "https://dxbvnmvgrxsgexwtrhoh.supabase.co" | vercel env add SUPABASE_URL preview

Write-Host "Добавление SUPABASE_URL для Development..." -ForegroundColor Yellow
echo "https://dxbvnmvgrxsgexwtrhoh.supabase.co" | vercel env add SUPABASE_URL development

# SUPABASE_KEY
Write-Host "`nДобавление SUPABASE_KEY для Production..." -ForegroundColor Yellow
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4YnZubXZncnhzZ2V4d3RyaG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTI0ODIsImV4cCI6MjA3ODUyODQ4Mn0.MyjcP2BptexI_u3djyNUMdE9sxEDEbuZdPnmMIaFSXI" | vercel env add SUPABASE_KEY production

Write-Host "Добавление SUPABASE_KEY для Preview..." -ForegroundColor Yellow
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4YnZubXZncnhzZ2V4d3RyaG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTI0ODIsImV4cCI6MjA3ODUyODQ4Mn0.MyjcP2BptexI_u3djyNUMdE9sxEDEbuZdPnmMIaFSXI" | vercel env add SUPABASE_KEY preview

Write-Host "Добавление SUPABASE_KEY для Development..." -ForegroundColor Yellow
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4YnZubXZncnhzZ2V4d3RyaG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTI0ODIsImV4cCI6MjA3ODUyODQ4Mn0.MyjcP2BptexI_u3djyNUMdE9sxEDEbuZdPnmMIaFSXI" | vercel env add SUPABASE_KEY development

Write-Host "`n✅ Переменные окружения добавлены!" -ForegroundColor Green
Write-Host "Теперь выполните: vercel --prod" -ForegroundColor Cyan

