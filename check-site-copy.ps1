$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensions = @("*.html", "*.js", "*.css")
$ignoredDirs = @("\.cursor\", "\node_modules\", "\legacy-import\")

$patterns = @(
  @{
    Label = "Mention d'experimentation"
    Regex = "(?i)\b(exp[eé]riment|exp[eé]rimental|exp[eé]rimentation)\b"
  },
  @{
    Label = "Mention de test visible"
    Regex = "(?i)\b(en test|test en cours|site de test|version test)\b"
  },
  @{
    Label = "Mention beta/prototype"
    Regex = "(?i)\b(b[eê]ta|beta|prototype|maquette|brouillon)\b"
  },
  @{
    Label = "Commentaire meta sur le site"
    Regex = "(?i)\ble site est (maintenant )?(pens[eé]|con[cç]u|optimis[eé]|am[eé]lior[eé])\b"
  },
  @{
    Label = "Commentaire UX interne"
    Regex = "(?i)\b(parcours de conversion|message lisible|visuels premium)\b"
  }
)

$files = Get-ChildItem -Path $root -Recurse -File -Include $extensions | Where-Object {
  $fullName = $_.FullName
  -not ($ignoredDirs | Where-Object { $fullName -like "*$_*" })
}

$matchesFound = @()

foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw
  foreach ($pattern in $patterns) {
    $matches = [regex]::Matches($content, $pattern.Regex)
    foreach ($match in $matches) {
      $lineNumber = ($content.Substring(0, $match.Index) -split "`r?`n").Count
      $line = ($content -split "`r?`n")[$lineNumber - 1].Trim()
      $matchesFound += [PSCustomObject]@{
        File = $file.FullName.Replace("$root\", "")
        Line = $lineNumber
        Rule = $pattern.Label
        Text = $line
      }
    }
  }
}

if ($matchesFound.Count -gt 0) {
  Write-Host "Texte interne detecte dans le site :" -ForegroundColor Red
  $matchesFound | ForEach-Object {
    Write-Host "- [$($_.Rule)] $($_.File):$($_.Line)" -ForegroundColor Yellow
    Write-Host "  $($_.Text)" -ForegroundColor Gray
  }
  exit 1
}

Write-Host "Controle du contenu OK : aucune formulation interne detectee." -ForegroundColor Green
