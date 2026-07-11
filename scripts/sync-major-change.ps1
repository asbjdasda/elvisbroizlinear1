param(
  [Parameter(Mandatory = $false)]
  [string]$Message = "Brozien major update"
)

$ErrorActionPreference = "Stop"

$sourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$targetRoot = "E:\Tatol_files_personal\Brozien web\GitHub Elvis\Elvis BIN"
$targetResolved = Resolve-Path $targetRoot
$distRoot = Join-Path $sourceRoot "dist"

if (-not (Test-Path (Join-Path $targetResolved ".git"))) {
  throw "Target is not a Git repository: $targetResolved"
}

Push-Location $sourceRoot
try {
  npm run build
}
finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $distRoot "index.html"))) {
  throw "Build output missing: $distRoot"
}

$preserve = @(".git", ".gitattributes", "README.md")
$items = Get-ChildItem -LiteralPath $targetResolved -Force
foreach ($item in $items) {
  if ($preserve -contains $item.Name) {
    continue
  }

  $full = Resolve-Path -LiteralPath $item.FullName
  if (-not $full.Path.StartsWith($targetResolved.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside target repo: $full"
  }

  Remove-Item -LiteralPath $item.FullName -Recurse -Force
}

Get-ChildItem -LiteralPath $distRoot -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $targetResolved -Recurse -Force
}

Push-Location $targetResolved
try {
  git add -A
  $status = git status --porcelain
  if ($status) {
    git commit -m $Message
    Write-Host "Synced and committed to Elvis BIN: $Message"
  }
  else {
    Write-Host "Elvis BIN already matches the latest build. No commit created."
  }
}
finally {
  Pop-Location
}
