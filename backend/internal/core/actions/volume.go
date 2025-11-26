package actions

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// VolumeController handles volume control operations
type VolumeController struct{}

// NewVolumeController creates a new VolumeController
func NewVolumeController() *VolumeController {
	return &VolumeController{}
}

// VolumeUp increases volume by the specified percentage
func (v *VolumeController) VolumeUp(step int) error {
	if runtime.GOOS == "linux" {
		return v.volumeUpLinux(step)
	}
	return v.volumeUpWindows(step)
}

// VolumeDown decreases volume by the specified percentage
func (v *VolumeController) VolumeDown(step int) error {
	if runtime.GOOS == "linux" {
		return v.volumeDownLinux(step)
	}
	return v.volumeDownWindows(step)
}

// SetVolume sets the volume to a specific percentage
func (v *VolumeController) SetVolume(level int) error {
	if level < 0 {
		level = 0
	}
	if level > 100 {
		level = 100
	}

	if runtime.GOOS == "linux" {
		return v.setVolumeLinux(level)
	}
	return v.setVolumeWindows(level)
}

// GetVolume returns the current volume level (0-100)
func (v *VolumeController) GetVolume() (int, error) {
	if runtime.GOOS == "linux" {
		return v.getVolumeLinux()
	}
	return v.getVolumeWindows()
}

// ToggleMute toggles the volume mute state
func (v *VolumeController) ToggleMute() error {
	if runtime.GOOS == "linux" {
		return v.toggleMuteLinux()
	}
	return v.toggleMuteWindows()
}

// Linux implementations using pactl (PulseAudio)
func (v *VolumeController) volumeUpLinux(step int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("+%d%%", step))
	return cmd.Run()
}

func (v *VolumeController) volumeDownLinux(step int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("-%d%%", step))
	return cmd.Run()
}

func (v *VolumeController) setVolumeLinux(level int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("%d%%", level))
	return cmd.Run()
}

func (v *VolumeController) getVolumeLinux() (int, error) {
	cmd := exec.Command("pactl", "get-sink-volume", "@DEFAULT_SINK@")
	output, err := cmd.Output()
	if err != nil {
		// Fallback to pacmd
		return v.getVolumeLinuxFallback()
	}

	// Parse output like: "Volume: front-left: 65536 / 100% / 0.00 dB,   front-right: 65536 / 100% / 0.00 dB"
	outputStr := string(output)
	parts := strings.Split(outputStr, "/")
	if len(parts) >= 2 {
		percentStr := strings.TrimSpace(parts[1])
		percentStr = strings.TrimSuffix(percentStr, "%")
		if vol, err := strconv.Atoi(percentStr); err == nil {
			return vol, nil
		}
	}

	return 50, nil // Default fallback
}

func (v *VolumeController) getVolumeLinuxFallback() (int, error) {
	cmd := exec.Command("amixer", "get", "Master")
	output, err := cmd.Output()
	if err != nil {
		return 50, err
	}

	// Parse output like: "[50%]"
	outputStr := string(output)
	start := strings.Index(outputStr, "[")
	end := strings.Index(outputStr, "%]")
	if start != -1 && end != -1 && end > start {
		percentStr := outputStr[start+1 : end]
		if vol, err := strconv.Atoi(percentStr); err == nil {
			return vol, nil
		}
	}

	return 50, nil
}

func (v *VolumeController) toggleMuteLinux() error {
	cmd := exec.Command("pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle")
	return cmd.Run()
}

// Windows implementations
func (v *VolumeController) volumeUpWindows(step int) error {
	// Using nircmd or PowerShell
	script := fmt.Sprintf(`
$obj = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt %d; $i++) {
    $obj.SendKeys([char]175)
}
`, step/2)
	cmd := exec.Command("powershell", "-Command", script)
	return cmd.Run()
}

func (v *VolumeController) volumeDownWindows(step int) error {
	script := fmt.Sprintf(`
$obj = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt %d; $i++) {
    $obj.SendKeys([char]174)
}
`, step/2)
	cmd := exec.Command("powershell", "-Command", script)
	return cmd.Run()
}

func (v *VolumeController) setVolumeWindows(level int) error {
	// Using PowerShell with audio API
	script := fmt.Sprintf(`
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int f(); int g(); int h(); int i();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int j();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int k(); int l(); int m(); int n();
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
    int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int f();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
    static IAudioEndpointVolume Vol() {
        var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
        IMMDevice dev = null;
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
        IAudioEndpointVolume epv = null;
        var epvid = typeof(IAudioEndpointVolume).GUID;
        Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
        return epv;
    }
    public static float Volume {
        get {float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v;}
        set {Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty));}
    }
    public static bool Mute {
        get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
        set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
    }
}
"@
[Audio]::Volume = %f
`, float64(level)/100.0)
	cmd := exec.Command("powershell", "-Command", script)
	return cmd.Run()
}

func (v *VolumeController) getVolumeWindows() (int, error) {
	script := `
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int f(); int g(); int h(); int i();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int j();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int k(); int l(); int m(); int n();
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
    int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int f();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
    static IAudioEndpointVolume Vol() {
        var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
        IMMDevice dev = null;
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
        IAudioEndpointVolume epv = null;
        var epvid = typeof(IAudioEndpointVolume).GUID;
        Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
        return epv;
    }
    public static float Volume {
        get {float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v;}
        set {Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty));}
    }
}
"@
[int]([Audio]::Volume * 100)
`
	cmd := exec.Command("powershell", "-Command", script)
	output, err := cmd.Output()
	if err != nil {
		return 50, err
	}

	volStr := strings.TrimSpace(string(output))
	if vol, err := strconv.Atoi(volStr); err == nil {
		return vol, nil
	}

	return 50, nil
}

func (v *VolumeController) toggleMuteWindows() error {
	script := `$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)`
	cmd := exec.Command("powershell", "-Command", script)
	return cmd.Run()
}
