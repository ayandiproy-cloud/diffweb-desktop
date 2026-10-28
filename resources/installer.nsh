; DiffWeb keeps running in the tray when its window is closed, so the installer
; closes it by itself before updating (no "DiffWeb cannot be closed" message).
!macro customCheckAppRunning
  nsExec::Exec `taskkill /F /T /IM "DiffWeb.exe"`
  Sleep 1000
!macroend
