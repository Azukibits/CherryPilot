Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ForegroundWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@

$buffer = New-Object System.Text.StringBuilder 1024
$handle = [ForegroundWindow]::GetForegroundWindow()
[void][ForegroundWindow]::GetWindowText($handle, $buffer, $buffer.Capacity)
$buffer.ToString()
