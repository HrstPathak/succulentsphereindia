$ErrorActionPreference = 'Stop'
$targets = @(
  @{ Url = 'http://localhost:3000/'; Name = 'HOME' },
  @{ Url = 'http://localhost:3000/account'; Name = 'ACCOUNT' }
)
foreach ($t in $targets) {
  try {
    $r = Invoke-WebRequest -Uri $t.Url -UseBasicParsing -TimeoutSec 20
    $h = [string]$r.Content
    $pat = [char]47 + '_next' + [char]47 + 'static' + [char]47
    $js = @()
    $i = 0
    while (($i = $h.IndexOf($pat, $i)) -ge 0) {
      $e = $h.IndexOf('.js', $i)
      if ($e -lt 0) { break }
      $js += $h.Substring($i, $e - $i + 3)
      $i = $e + 3
    }
    $admin = $js | Where-Object { $_.Contains('e34e586c5090b9aa') }
    Write-Output ('{0}_STATUS={1}  HTML_BYTES={2}' -f $t.Name, $r.StatusCode, $h.Length)
    Write-Output ('{0}_JS_REFS={1}' -f $t.Name, $js.Count)
    Write-Output ('{0}_REFS_ADMINCHUNK={1}' -f $t.Name, @($admin).Count)
    foreach ($u in ($js | Select-Object -First 12)) { Write-Output ('  CHUNK: ' + $u) }
  } catch {
    Write-Output ('{0}_ERROR={1}' -f $t.Name, $_.Exception.Message)
  }
}
