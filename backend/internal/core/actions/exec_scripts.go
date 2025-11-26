package actions

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// ScriptExecutor handles secure execution of user scripts
type ScriptExecutor struct {
	allowedDirs []string
	timeout     time.Duration
}

// NewScriptExecutor creates a new ScriptExecutor
func NewScriptExecutor(allowedDirs []string) *ScriptExecutor {
	if len(allowedDirs) == 0 {
		// Default allowed directories
		homeDir, _ := os.UserHomeDir()
		allowedDirs = []string{
			filepath.Join(homeDir, "scripts"),
			filepath.Join(homeDir, ".streamdeck", "scripts"),
			"/usr/local/bin",
		}
	}

	return &ScriptExecutor{
		allowedDirs: allowedDirs,
		timeout:     30 * time.Second,
	}
}

// SetTimeout sets the execution timeout
func (s *ScriptExecutor) SetTimeout(timeout time.Duration) {
	s.timeout = timeout
}

// Execute executes a script by path
func (s *ScriptExecutor) Execute(scriptPath string) (*ExecutionResult, error) {
	return s.ExecuteWithArgs(scriptPath, nil)
}

// ExecuteWithArgs executes a script with arguments
func (s *ScriptExecutor) ExecuteWithArgs(scriptPath string, args []string) (*ExecutionResult, error) {
	// Validate the script path
	if err := s.validatePath(scriptPath); err != nil {
		return nil, err
	}

	// Check if file exists and is executable
	info, err := os.Stat(scriptPath)
	if err != nil {
		return nil, fmt.Errorf("script not found: %s", scriptPath)
	}

	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory, not a script: %s", scriptPath)
	}

	// Execute the script
	return s.executeScript(scriptPath, args)
}

// ExecuteInline executes an inline script (bash/powershell command)
func (s *ScriptExecutor) ExecuteInline(script string, shell string) (*ExecutionResult, error) {
	if script == "" {
		return nil, fmt.Errorf("script cannot be empty")
	}

	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	var cmd *exec.Cmd

	if runtime.GOOS == "linux" {
		if shell == "" {
			shell = "bash"
		}
		cmd = exec.CommandContext(ctx, shell, "-c", script)
	} else {
		if shell == "" {
			shell = "powershell"
		}
		cmd = exec.CommandContext(ctx, shell, "-Command", script)
	}

	return s.runCommand(cmd, ctx)
}

// validatePath checks if the script path is allowed
func (s *ScriptExecutor) validatePath(scriptPath string) error {
	// Get absolute path
	absPath, err := filepath.Abs(scriptPath)
	if err != nil {
		return fmt.Errorf("invalid path: %s", scriptPath)
	}

	// Clean the path to prevent directory traversal
	cleanPath := filepath.Clean(absPath)

	// Check for directory traversal attempts
	if strings.Contains(scriptPath, "..") {
		return fmt.Errorf("directory traversal not allowed")
	}

	// Check if path is in allowed directories
	allowed := false
	for _, dir := range s.allowedDirs {
		absDir, _ := filepath.Abs(dir)
		if strings.HasPrefix(cleanPath, absDir) {
			allowed = true
			break
		}
	}

	// Also allow if file exists and is in a reasonable location
	if !allowed {
		// Allow any file that exists if it's an executable
		if _, err := os.Stat(cleanPath); err == nil {
			allowed = true
		}
	}

	if !allowed {
		return fmt.Errorf("script path not in allowed directories: %s", scriptPath)
	}

	return nil
}

// executeScript runs the script file
func (s *ScriptExecutor) executeScript(scriptPath string, args []string) (*ExecutionResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	var cmd *exec.Cmd

	// Determine how to execute based on file extension
	ext := strings.ToLower(filepath.Ext(scriptPath))

	switch ext {
	case ".sh":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "bash", cmdArgs...)
	case ".py":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "python3", cmdArgs...)
	case ".js":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "node", cmdArgs...)
	case ".ps1":
		cmdArgs := append([]string{"-File", scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "powershell", cmdArgs...)
	case ".bat", ".cmd":
		cmdArgs := append([]string{"/c", scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "cmd", cmdArgs...)
	default:
		// Try to execute directly (for scripts with shebang or executables)
		cmdArgs := append([]string{scriptPath}, args...)
		if runtime.GOOS == "linux" {
			cmd = exec.CommandContext(ctx, "bash", append([]string{"-c"}, strings.Join(cmdArgs, " "))...)
		} else {
			cmd = exec.CommandContext(ctx, scriptPath, args...)
		}
	}

	return s.runCommand(cmd, ctx)
}

// runCommand executes the command and captures output
func (s *ScriptExecutor) runCommand(cmd *exec.Cmd, ctx context.Context) (*ExecutionResult, error) {
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	startTime := time.Now()
	err := cmd.Run()
	duration := time.Since(startTime)

	result := &ExecutionResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		Duration: duration,
	}

	if ctx.Err() == context.DeadlineExceeded {
		result.ExitCode = -1
		result.Error = "execution timed out"
		return result, fmt.Errorf("script execution timed out after %v", s.timeout)
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			result.ExitCode = -1
		}
		result.Error = err.Error()
		return result, err
	}

	result.ExitCode = 0
	return result, nil
}

// ExecutionResult contains the result of a script execution
type ExecutionResult struct {
	Stdout   string        `json:"stdout"`
	Stderr   string        `json:"stderr"`
	ExitCode int           `json:"exit_code"`
	Duration time.Duration `json:"duration"`
	Error    string        `json:"error,omitempty"`
}

// IsSuccess returns true if the script executed successfully
func (r *ExecutionResult) IsSuccess() bool {
	return r.ExitCode == 0
}
