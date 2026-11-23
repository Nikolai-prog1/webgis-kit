param([string]$Launcher)
$ErrorActionPreference='Stop'
$process=Start-Process -FilePath $Launcher -WindowStyle Hidden -PassThru
Write-Output $process.Id
