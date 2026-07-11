$ErrorActionPreference = "Stop"

$subject = $env:COMMIT_SUBJECT
if ([string]::IsNullOrWhiteSpace($subject)) {
  exit 0
}

$prefix = [string][char]0x7B2C
$changeWord = -join ([char]0x4FEE, [char]0x6539)
$updateWord = -join ([char]0x66F4, [char]0x65B0)
$versionWord = [string][char]0x7248

$isChineseMajorVersion =
  $subject.Contains($prefix) -and
  ($subject.Contains($changeWord) -or $subject.Contains($updateWord) -or $subject.Contains($versionWord))

$isEnglishMajorVersion = $subject -match '(?i)\b(major|version|release)\b'

if ($isChineseMajorVersion -or $isEnglishMajorVersion) {
  & (Join-Path $PSScriptRoot "sync-major-change.ps1") -Message $subject
}
