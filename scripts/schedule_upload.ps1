$TaskName = "MOM Inventory Upload"
$ActionExecutable = "python.exe"
$ActionArguments = "scripts\upload.py"
$WorkingDirectory = "c:\projects\supabase\mom\mom-app"
$StartTime = (Get-Date "23:30:00")
$DaysOfWeek = @("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday")

# Check if task already exists and remove it to update
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Existing task '$TaskName' removed for update."
}

# Create Task Trigger
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DaysOfWeek -At $StartTime

# Create Task Action
$Action = New-ScheduledTaskAction -Execute $ActionExecutable -Argument $ActionArguments -WorkingDirectory $WorkingDirectory

# Create Task Principal (Run as current user, with limited privilege if needed, but usually local is fine)
$Principal = New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive

# Create Task Settings
$Settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the Task
Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Principal $Principal -Settings $Settings

Write-Host "Task '$TaskName' has been scheduled to run Sun-Fri at 23:30."
Write-Host "You can verify this in Task Scheduler (taskschd.msc)."
