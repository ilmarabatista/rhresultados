@echo off
setlocal EnableExtensions
title RH Resultados - inicializacao
cd /d "%~dp0"

rem ================================================================
rem  Liga o banco local (porta 5433) e o sistema (porta 3000) e abre
rem  o navegador. Pode rodar de novo a qualquer momento: o que ja
rem  estiver no ar e reaproveitado.
rem
rem  - O banco fica em segundo plano, fora desta janela, para nao cair
rem    quando ela fechar.
rem  - Se o banco estiver ligado mas travado, ele e reiniciado.
rem  - Se o codigo mudou desde o ultimo build, recompila antes de subir.
rem ================================================================

set "RAIZ=%~dp0"
set "RAIZ=%RAIZ:~0,-1%"
set "PGBIN=%RAIZ%\node_modules\@embedded-postgres\windows-x64\native\bin"
set "PGDATA=%RAIZ%\.localdb"
set "LOGDIR=%RAIZ%\logs"
set "PGLOG=%LOGDIR%\postgres.log"
set "URL_APP=http://localhost:3000"

echo.
echo  RH Resultados
echo  =============
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js nao encontrado. Instale em https://nodejs.org e tente de novo.
  goto erro
)
if not exist ".env" (
  echo  Arquivo .env nao encontrado. Copie o .env.example para .env e preencha.
  goto erro
)
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

rem ---------------------------------------------------------- 1
echo  [1/4] Conferindo dependencias...
if not exist "%PGBIN%\pg_ctl.exe" goto instalar
if not exist "%RAIZ%\node_modules\next\package.json" goto instalar
if not exist "%RAIZ%\node_modules\.prisma\client\index.js" goto instalar
goto dependencias_ok
:instalar
echo        Faltam arquivos em node_modules. Rodando npm ci...
call npm ci
if errorlevel 1 goto erro
:dependencias_ok

rem ---------------------------------------------------------- 2
echo  [2/4] Banco de dados...
set "PRIMEIRA_VEZ="
if not exist "%PGDATA%\PG_VERSION" (
  call :criar_banco
  if errorlevel 1 goto erro
)
call :garantir_banco
if errorlevel 1 goto erro

rem Com o sistema aberto, a mudanca no banco fica para quando ele for
rem reiniciado: migrar agora deixaria o codigo antigo, que esta rodando,
rem conversando com o banco novo.
curl -s -o nul -m 5 "%URL_APP%/login"
if not errorlevel 1 (
  echo        O sistema ja esta aberto: o banco sera atualizado quando ele for reiniciado.
  goto migracoes_ok
)
echo        Aplicando migracoes pendentes...
call npx prisma migrate deploy >"%LOGDIR%\migracoes.log" 2>&1
if errorlevel 1 (
  type "%LOGDIR%\migracoes.log"
  goto erro
)
:migracoes_ok

if defined PRIMEIRA_VEZ (
  echo        Primeira vez: criando administrador e catalogo de servicos...
  call npm run db:seed
  if errorlevel 1 goto erro
  call npm run db:servicos
  if errorlevel 1 goto erro
)

rem ---------------------------------------------------------- 3
echo  [3/4] Sistema...
curl -s -o nul -m 5 "%URL_APP%/login"
if not errorlevel 1 (
  echo        Ja estava no ar.
  call :precisa_build
  if errorlevel 1 (
    echo        Aviso: o codigo mudou desde o ultimo build. Para ver a versao nova,
    echo        feche a janela do sistema e rode este arquivo de novo.
  )
  goto abrir
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 3000 -EA 0) {exit 1} else {exit 0}"
if errorlevel 1 (
  echo        A porta 3000 esta ocupada, mas o sistema nao responde.
  echo        Feche a janela antiga do sistema e rode este arquivo de novo.
  goto erro
)

call :precisa_build
if errorlevel 1 (
  echo        O codigo mudou desde o ultimo build. Recompilando, leva alguns minutos...
  call npm run build
  if errorlevel 1 goto erro
)

echo        Ligando o sistema...
start "RH Resultados - sistema - feche esta janela para desligar" /min cmd /k "npx next start -p 3000"

for /l %%i in (1,1,90) do (
  curl -s -o nul -m 2 "%URL_APP%/login" && goto abrir
  ping -n 2 127.0.0.1 >nul
)
echo        O sistema nao respondeu. Veja a janela "RH Resultados - sistema".
goto erro

rem ---------------------------------------------------------- 4
:abrir
echo  [4/4] Abrindo %URL_APP%/login
if not defined RH_SEM_NAVEGADOR start "" "%URL_APP%/login"
echo.
echo  Tudo pronto. Esta janela fecha sozinha.
echo  O banco segue ligado em segundo plano. O sistema roda na janela minimizada.
ping -n 6 127.0.0.1 >nul
exit /b 0

:erro
echo.
echo  Algo deu errado. Leia as mensagens acima.
echo  Logs em: %LOGDIR%
pause
exit /b 1


rem ================================================================
rem  Sub-rotinas
rem ================================================================

rem Login de verdade no banco com SELECT 1. So ver a porta aberta nao
rem basta: o banco ja travou aceitando conexao sem responder.
:testar_banco
node --env-file=.env -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();setTimeout(()=>process.exit(2),8000);p.$queryRawUnsafe('select 1').then(()=>process.exit(0),()=>process.exit(1))" >nul 2>&1
exit /b %errorlevel%

:garantir_banco
call :testar_banco
if not errorlevel 1 (
  echo        Ja estava no ar.
  exit /b 0
)
"%PGBIN%\pg_ctl.exe" status -D "%PGDATA%" >nul 2>&1
if errorlevel 1 goto subir_banco

echo        O banco esta ligado mas nao responde. Nova tentativa em 5 segundos...
ping -n 6 127.0.0.1 >nul
call :testar_banco
if not errorlevel 1 exit /b 0

echo        Continua travado. Reiniciando o banco, os dados sao preservados...
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m immediate -t 15 >nul 2>&1
"%PGBIN%\pg_ctl.exe" status -D "%PGDATA%" >nul 2>&1
if errorlevel 1 goto subir_banco
set /p PGPID=<"%PGDATA%\postmaster.pid"
taskkill /pid %PGPID% /t /f >nul 2>&1
ping -n 3 127.0.0.1 >nul

:subir_banco
if exist "%PGDATA%\postmaster.pid" del /f /q "%PGDATA%\postmaster.pid"
echo        Ligando o banco...
rem Criado via WMI para o Postgres nao ficar preso a esta janela.
powershell -NoProfile -Command "$q=[char]34; $cl=$q+$env:PGBIN+'\pg_ctl.exe'+$q+' start -D '+$q+$env:PGDATA+$q+' -o '+$q+'-p 5433'+$q+' -l '+$q+$env:PGLOG+$q; $r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$cl; CurrentDirectory=$env:RAIZ}; exit ([int]$r.ReturnValue)" >nul
if errorlevel 1 exit /b 1
for /l %%i in (1,1,30) do (
  call :testar_banco
  if not errorlevel 1 (
    echo        Banco no ar.
    exit /b 0
  )
  ping -n 2 127.0.0.1 >nul
)
echo        O banco nao subiu em 30 segundos. Ultimas linhas do log:
powershell -NoProfile -Command "Get-Content -Tail 20 $env:PGLOG"
exit /b 1

:criar_banco
echo        O banco ainda nao existe. Criando pela primeira vez...
node -e "import('embedded-postgres').then(async({default:E})=>{const pg=new E({databaseDir:require('path').join(process.cwd(),'.localdb'),user:'rh',password:'rh',port:5433,persistent:true});await pg.initialise();await pg.start();await pg.createDatabase('rhresultados');await pg.stop();process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
if errorlevel 1 exit /b 1
rem Garante que o Postgres usado na criacao desligou: a seguir ele e
rem ligado de novo em segundo plano, solto desta janela.
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast -w >nul 2>&1
set "PRIMEIRA_VEZ=1"
exit /b 0

rem Sai com 1 se nao ha build ou se algum arquivo do codigo e mais novo que ele.
:precisa_build
powershell -NoProfile -Command "$b=Get-Item '.next\BUILD_ID' -EA 0; if (-not $b) {exit 1}; $f=@(Get-ChildItem src,prisma -Recurse -File -EA 0) + @(Get-Item next.config.ts,package.json,package-lock.json,postcss.config.mjs,tsconfig.json -EA 0); if ($f.Where({$_.LastWriteTime -gt $b.LastWriteTime}).Count) {exit 1}; exit 0"
exit /b %errorlevel%
