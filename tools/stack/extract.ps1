param([string]$Archive,[string]$Destination,[string]$Kind)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$targetRoot=[IO.Path]::GetFullPath($Destination).TrimEnd('\')+'\'
[IO.Directory]::CreateDirectory($targetRoot) | Out-Null
$zip=[IO.Compression.ZipFile]::OpenRead($Archive)
try {
  foreach($entry in $zip.Entries) {
    if($Kind -eq 'postgresql' -and $entry.FullName -notmatch '^pgsql/(bin|lib|share)/') { continue }
    $target=[IO.Path]::GetFullPath([IO.Path]::Combine($targetRoot,$entry.FullName.Replace('/','\')))
    if(-not $target.StartsWith($targetRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive entry escapes its runtime directory.' }
    if($entry.FullName.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null }
    else {
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)
    }
  }
} finally { $zip.Dispose() }
