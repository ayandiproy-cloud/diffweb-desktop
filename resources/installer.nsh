; DiffWeb keeps running in the tray when its window is closed, so the installer
; closes it by itself before updating (no "DiffWeb cannot be closed" message).
; It first waits up to 8 seconds for DiffWeb to close on its own (that is what happens
; after "Restart now"), then closes any copy still open.
; No /T here: the installer was started by DiffWeb, and /T would close the installer too.
; Relative jumps (+n / -n count instructions) so the macro can be used more than once.
!macro customCheckAppRunning
  StrCpy $R9 0
  nsExec::ExecToStack `cmd /c tasklist /NH /FI "IMAGENAME eq DiffWeb.exe" | find /I "DiffWeb.exe"`
  Pop $R8
  Pop $R7
  StrCmp $R8 "0" 0 +8
  IntOp $R9 $R9 + 1
  IntCmp $R9 16 +3
  Sleep 500
  Goto -7
  nsExec::Exec `taskkill /F /IM "DiffWeb.exe"`
  Pop $R7
  Sleep 800
  Nop
!macroend
