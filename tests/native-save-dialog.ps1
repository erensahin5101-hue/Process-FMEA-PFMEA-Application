param(
  [ValidateSet('direct_dxf', 'direct_xlsx', 'xlsx', 'pfmea_xlsx', 'process_library_xlsx', 'operation_codes_xlsx', 'control_pdf', 'pfmea_pdf', 'flow_pdf', 'instruction_pdf', 'all_instructions_pdf', 'dxf')]
  [string]$ExportKind = 'direct_dxf',
  [string]$OutputPath,
  [string]$ExecutablePath,
  [switch]$ForceStopExisting,
  [int]$CdpPort = 9223,
  [int]$DialogTimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$defaultInstalledExe = Join-Path $env:LOCALAPPDATA 'TYANA Q-Flow\tyana-qflow-desktop.exe'
$cargoTargetRoot = if ($env:CARGO_TARGET_DIR) {
  [System.IO.Path]::GetFullPath($env:CARGO_TARGET_DIR)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'TYANA\QFlow\cargo-target'))
}
$releaseExe = [System.IO.Path]::GetFullPath((Join-Path $cargoTargetRoot 'x86_64-pc-windows-msvc\release\tyana-qflow-desktop.exe'))
if ($ExecutablePath) {
  $installedExe = [System.IO.Path]::GetFullPath($ExecutablePath)
  if (-not $installedExe.Equals($releaseExe, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Kabul testi yalnız derlenen TYANA masaüstü çalıştırılabilirini kullanabilir: $releaseExe"
  }
} else {
  $installedExe = $defaultInstalledExe
}
if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  throw "TYANA uygulaması bulunamadı: $installedExe"
}

$extensions = @{
  direct_dxf = 'dxf'
  direct_xlsx = 'xlsx'
  xlsx = 'xlsx'
  pfmea_xlsx = 'xlsx'
  process_library_xlsx = 'xlsx'
  operation_codes_xlsx = 'xlsx'
  control_pdf = 'pdf'
  pfmea_pdf = 'pdf'
  flow_pdf = 'pdf'
  instruction_pdf = 'pdf'
  all_instructions_pdf = 'pdf'
  dxf = 'dxf'
}
$extension = $extensions[$ExportKind]
if (-not $OutputPath) {
  $OutputPath = Join-Path $repoRoot "output\native-acceptance\$ExportKind.$extension"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$allowedRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'output\native-acceptance'))
if (-not $OutputPath.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Kabul testi yalnız $allowedRoot altında çıktı yazabilir."
}
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath)) | Out-Null
if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TyanaNativeWindow {
  public delegate bool EnumWindowProc(IntPtr handle, IntPtr parameter);
  public delegate bool EnumChildProc(IntPtr handle, IntPtr parameter);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr FindWindow(string className, string windowName);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool EnumWindows(EnumWindowProc callback, IntPtr parameter);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool EnumChildWindows(IntPtr parent, EnumChildProc callback, IntPtr parameter);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int GetClassName(IntPtr handle, StringBuilder className, int capacity);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern int GetDlgCtrlID(IntPtr handle);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
  public static extern IntPtr SendMessageBuffer(IntPtr handle, uint message, IntPtr wParam, StringBuilder text);
  [DllImport("user32.dll", EntryPoint = "SendMessageW")]
  public static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", EntryPoint = "PostMessageW", SetLastError = true)]
  public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SetFocus(IntPtr handle);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr GetFocus();
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool BringWindowToTop(IntPtr handle);
  [DllImport("user32.dll")]
  public static extern void SwitchToThisWindow(IntPtr handle, bool altTab);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SetActiveWindow(IntPtr handle);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool AttachThreadInput(uint attachThreadId, uint attachToThreadId, bool attach);
  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  private static uint attachedFromThreadId = 0;
  private static uint attachedToThreadId = 0;

  public static bool BeginControlInput(IntPtr dialog, IntPtr control) {
    uint processId;
    uint targetThreadId = GetWindowThreadProcessId(dialog, out processId);
    uint currentThreadId = GetCurrentThreadId();
    bool attached = currentThreadId != targetThreadId && AttachThreadInput(currentThreadId, targetThreadId, true);
    if (attached) {
      attachedFromThreadId = currentThreadId;
      attachedToThreadId = targetThreadId;
    }
    SwitchToThisWindow(dialog, true);
    SetForegroundWindow(dialog);
    SetActiveWindow(dialog);
    BringWindowToTop(dialog);
    SetFocus(control);
    bool focused = GetFocus() == control;
    if (!focused) EndControlInput();
    return focused;
  }

  public static void EndControlInput() {
    if (attachedFromThreadId != 0 && attachedToThreadId != 0) {
      AttachThreadInput(attachedFromThreadId, attachedToThreadId, false);
      attachedFromThreadId = 0;
      attachedToThreadId = 0;
    }
  }

  public static IntPtr FindDescendant(IntPtr parent, string className, int controlId) {
    IntPtr found = IntPtr.Zero;
    EnumChildProc callback = (handle, _) => {
      var currentClass = new StringBuilder(128);
      GetClassName(handle, currentClass, currentClass.Capacity);
      if (currentClass.ToString() == className && GetDlgCtrlID(handle) == controlId) {
        found = handle;
        return false;
      }
      return true;
    };
    EnumChildWindows(parent, callback, IntPtr.Zero);
    GC.KeepAlive(callback);
    return found;
  }

  public static string ReadWindowText(IntPtr handle) {
    var text = new StringBuilder(32768);
    SendMessageBuffer(handle, 0x000D, new IntPtr(text.Capacity), text);
    return text.ToString();
  }

  public static IntPtr FindTopLevel(uint processId, string className) {
    IntPtr found = IntPtr.Zero;
    EnumWindowProc callback = (handle, _) => {
      uint ownerProcessId;
      GetWindowThreadProcessId(handle, out ownerProcessId);
      var currentClass = new StringBuilder(128);
      GetClassName(handle, currentClass, currentClass.Capacity);
      if (ownerProcessId == processId && currentClass.ToString() == className && IsWindowVisible(handle)) {
        found = handle;
        return false;
      }
      return true;
    };
    EnumWindows(callback, IntPtr.Zero);
    GC.KeepAlive(callback);
    return found;
  }
}
'@

function Get-DesktopWindows {
  return [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )
}

function Set-NativeSaveDialogPath([IntPtr]$DialogHandle, [string]$Path) {
  $nativeFileName = [TyanaNativeWindow]::FindDescendant($DialogHandle, 'Edit', 1001)
  $nativeSave = [TyanaNativeWindow]::FindDescendant($DialogHandle, 'Button', 1)
  $script:lastNativeDialogState = "edit=$nativeFileName;save=$nativeSave"
  if ($nativeFileName -eq [IntPtr]::Zero -or $nativeSave -eq [IntPtr]::Zero) { return $false }

  # WM_CHAR, ortak dosya diyaloğunun doğal Edit değişiklik zincirini tetikler.
  if (-not [TyanaNativeWindow]::BeginControlInput($DialogHandle, $nativeFileName)) {
    $script:lastNativeDialogState = "edit=$nativeFileName;save=$nativeSave;focus=false"
    return $false
  }
  try {
    [void][TyanaNativeWindow]::SendMessage($nativeFileName, 0x00B1, [IntPtr]::Zero, [IntPtr](-1)) # EM_SETSEL
    [void][TyanaNativeWindow]::SendMessage($nativeFileName, 0x0303, [IntPtr]::Zero, [IntPtr]::Zero) # WM_CLEAR
    foreach ($character in $Path.ToCharArray()) {
      [void][TyanaNativeWindow]::PostMessage($nativeFileName, 0x0102, [IntPtr][int][char]$character, [IntPtr]::Zero) # WM_CHAR
    }
    Start-Sleep -Milliseconds 200
    $enteredPath = [TyanaNativeWindow]::ReadWindowText($nativeFileName)
    $script:lastNativeDialogState = "edit=$nativeFileName;save=$nativeSave;text=$enteredPath"
    if ($enteredPath -ne $Path) { return $false }
    [void][TyanaNativeWindow]::SendMessage($nativeSave, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
    return $true
  } finally {
    [TyanaNativeWindow]::EndControlInput()
  }
}

function Set-SaveDialogPath([System.Windows.Automation.AutomationElement]$Window, [string]$Path) {
  $fileNameControl = $Window.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.AndCondition]::new(
      [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        '1001'
      ),
      [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ClassNameProperty,
        'Edit'
      )
    )
  )
  if (-not $fileNameControl) { return $false }
  $nativeHandle = [IntPtr]$Window.Current.NativeWindowHandle
  if ($nativeHandle -ne [IntPtr]::Zero) { [void][TyanaNativeWindow]::SetForegroundWindow($nativeHandle) }
  $fileNameControl.SetFocus()
  Start-Sleep -Milliseconds 100
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait($Path)
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  return $true
}

$existingProcesses = @(Get-Process -Name 'tyana-qflow-desktop' -ErrorAction SilentlyContinue)
if ($existingProcesses.Count -gt 0 -and -not $ForceStopExisting) {
  throw 'Açık bir TYANA oturumu var. Kullanıcı verisini korumak için test durduruldu; yalnız test oturumunu kapatmak için -ForceStopExisting kullanın.'
}
if ($existingProcesses.Count -gt 0) { $existingProcesses | Stop-Process -Force }
$previousWebViewArguments = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$CdpPort"
$env:CDP_PORT = [string]$CdpPort
$appProcess = Start-Process -FilePath $installedExe -PassThru

try {
  & node (Join-Path $PSScriptRoot 'native-desktop-cdp.mjs') prepare
  if ($LASTEXITCODE -ne 0) { throw 'Kurulu uygulama kabul testi verisi hazırlanamadı.' }
  $fileNameOutput = @(& node (Join-Path $PSScriptRoot 'native-desktop-cdp.mjs') filename $ExportKind)
  if ($LASTEXITCODE -ne 0) { throw "$ExportKind önerilen dosya adı alınamadı." }
  $fileNamePayload = $fileNameOutput[-1] | ConvertFrom-Json
  $suggestedFileName = [string]$fileNamePayload.fileName
  if (-not $suggestedFileName -or $suggestedFileName -match '[\\/:*?"<>|]') { throw 'Kabul testi dosya adı güvenli değil.' }
  $dialogOutputPath = $OutputPath
  & node (Join-Path $PSScriptRoot 'native-desktop-cdp.mjs') start $ExportKind
  if ($LASTEXITCODE -ne 0) { throw "$ExportKind dışa aktarma işlemi başlatılamadı." }

  $deadline = [DateTime]::UtcNow.AddSeconds($DialogTimeoutSeconds)
  $dialogHandled = $false
  $nativeDialogSeenCount = 0
  $lastNativeDialogState = 'not-seen'
  $seenWindows = [System.Collections.Generic.List[string]]::new()
  while ([DateTime]::UtcNow -lt $deadline -and -not $dialogHandled) {
    $dialogHandle = [TyanaNativeWindow]::FindTopLevel([uint32]$appProcess.Id, '#32770')
    if ($dialogHandle -ne [IntPtr]::Zero) {
      $nativeDialogSeenCount++
      $dialogHandled = Set-NativeSaveDialogPath -DialogHandle $dialogHandle -Path $dialogOutputPath
      if ($dialogHandled) {
        Start-Sleep -Milliseconds 500
        if ([TyanaNativeWindow]::FindTopLevel([uint32]$appProcess.Id, '#32770') -eq [IntPtr]::Zero) { break }
        $dialogHandled = $false
      }
    }
    foreach ($window in (Get-DesktopWindows)) {
      $description = "$($window.Current.Name) [$($window.Current.ClassName)] PID=$($window.Current.ProcessId)"
      if (($window.Current.ProcessId -eq $appProcess.Id -or $window.Current.Name -match '^TYANA .*kaydet$') -and -not $seenWindows.Contains($description)) { $seenWindows.Add($description) }
      $isTyanaDialog = $window.Current.Name -match '^TYANA .*kaydet$'
      $isOwnedDialog = $window.Current.ProcessId -eq $appProcess.Id -and $window.Current.ClassName -eq '#32770'
      if ($isTyanaDialog -or $isOwnedDialog) {
        $dialogHandled = Set-SaveDialogPath -Window $window -Path $dialogOutputPath
        if ($dialogHandled) {
          Start-Sleep -Milliseconds 500
          if ([TyanaNativeWindow]::FindTopLevel([uint32]$appProcess.Id, '#32770') -eq [IntPtr]::Zero) { break }
          $dialogHandled = $false
        }
      }
    }
    if (-not $dialogHandled) { Start-Sleep -Milliseconds 100 }
  }
  if (-not $dialogHandled) {
    throw "Windows kayıt diyaloğu işlenemedi. Native görülme: $nativeDialogSeenCount; durum: $lastNativeDialogState; görülen pencereler: $($seenWindows -join '; ')"
  }

  $checkOutput = @(& node (Join-Path $PSScriptRoot 'native-desktop-cdp.mjs') check $ExportKind)
  if ($LASTEXITCODE -ne 0) { throw "$ExportKind Tauri kayıt sonucu doğrulanamadı." }
  $checkPayload = $checkOutput[-1] | ConvertFrom-Json
  $selectedFileName = [System.IO.Path]::GetFileName($dialogOutputPath)
  if ($checkPayload.result.value.fileName -ne $selectedFileName) { throw 'Rust kayıt sonucu seçilen dosya adıyla uyuşmuyor.' }

  $fileDeadline = [DateTime]::UtcNow.AddSeconds(10)
  while ([DateTime]::UtcNow -lt $fileDeadline -and -not (Test-Path -LiteralPath $dialogOutputPath -PathType Leaf)) {
    Start-Sleep -Milliseconds 100
  }
  if (-not (Test-Path -LiteralPath $dialogOutputPath -PathType Leaf)) { throw "Dosya diskte oluşmadı: $dialogOutputPath" }
  $nativeFile = Get-Item -LiteralPath $dialogOutputPath
  if ($nativeFile.Length -le 0 -or $nativeFile.Length -ne [long]$checkPayload.result.value.bytesWritten) { throw "Dosya boyutu Rust yazım sonucuyla uyuşmuyor: $dialogOutputPath" }
  $file = Get-Item -LiteralPath $OutputPath
  $pdfPageCount = $null
  $portraitPageCount = $null
  $landscapePageCount = $null
  if ($ExportKind -eq 'flow_pdf') {
    $pdfBytes = [System.IO.File]::ReadAllBytes($dialogOutputPath)
    if ([System.Text.Encoding]::ASCII.GetString($pdfBytes, 0, [Math]::Min(5, $pdfBytes.Length)) -ne '%PDF-') { throw 'Proses akış PDF imzası geçersiz.' }
    $pdfText = [System.Text.Encoding]::GetEncoding(28591).GetString($pdfBytes)
    if ($pdfText -notmatch '%%EOF\s*$') { throw 'Proses akış PDF EOF işaretçisi eksik.' }
    $pdfPageCount = [regex]::Matches($pdfText, '/Type\s*/Page\b').Count
    $mediaBoxes = [regex]::Matches($pdfText, '/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]')
    $portraitPageCount = @($mediaBoxes | Where-Object { [double]$_.Groups[2].Value -gt [double]$_.Groups[1].Value }).Count
    $landscapePageCount = @($mediaBoxes | Where-Object { [double]$_.Groups[1].Value -gt [double]$_.Groups[2].Value }).Count
    if ($pdfPageCount -lt 4) { throw "Proses akış PDF sayfa sayısı yetersiz: $pdfPageCount" }
    if ($portraitPageCount -lt 3) { throw "Proses akış PDF portre sayfa sayısı yetersiz: $portraitPageCount" }
    if ($landscapePageCount -lt 1) { throw 'Proses akış PDF yatay izlenebilirlik matrisi içermiyor.' }
  }

  [PSCustomObject]@{
    ExportKind = $ExportKind
    Path = $file.FullName
    Bytes = $file.Length
    DialogHandled = $dialogHandled
    AppVersion = $appProcess.MainModule.FileVersionInfo.FileVersion
    PdfPages = $pdfPageCount
    PortraitPages = $portraitPageCount
    LandscapePages = $landscapePageCount
  } | ConvertTo-Json -Compress
}
finally {
  Get-Process -Id $appProcess.Id -ErrorAction SilentlyContinue | Stop-Process -Force
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousWebViewArguments
  Remove-Item Env:CDP_PORT -ErrorAction SilentlyContinue
}
