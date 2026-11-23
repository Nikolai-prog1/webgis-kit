param([string]$Initdb,[string]$Data,[string]$PasswordFile)
$ErrorActionPreference='Stop'
[IO.File]::WriteAllText($PasswordFile,$env:PG_SUPERUSER_PASSWORD)
try {
  & $Initdb '-D' $Data '-U' 'postgres' '--auth=scram-sha-256' "--pwfile=$PasswordFile" '-E' 'UTF8' '--locale=C'
  if($LASTEXITCODE -ne 0) { throw 'initdb failed; inspect the initialization log.' }
} finally { [IO.File]::WriteAllText($PasswordFile,'') }
