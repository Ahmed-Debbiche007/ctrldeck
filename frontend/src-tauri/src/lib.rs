use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;

// Store the sidecar process handle to manage its lifecycle
struct SidecarState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .setup(|app| {
            // Spawn the backend server as a sidecar process
            let shell = app.shell();
            
            match shell.sidecar("streamdeck-server") {
                Ok(command) => {
                    match command.spawn() {
                        Ok((mut rx, child)) => {
                            // Store the child process handle
                            let state = app.state::<SidecarState>();
                            *state.child.lock().unwrap() = Some(child);
                            
                            // Spawn a task to handle sidecar output
                            tauri::async_runtime::spawn(async move {
                                use tauri_plugin_shell::process::CommandEvent;
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stdout(line) => {
                                            println!("[Backend] {}", String::from_utf8_lossy(&line));
                                        }
                                        CommandEvent::Stderr(line) => {
                                            eprintln!("[Backend Error] {}", String::from_utf8_lossy(&line));
                                        }
                                        CommandEvent::Terminated(payload) => {
                                            println!("[Backend] Process terminated with code: {:?}", payload.code);
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                            });
                            
                            println!("Backend server started successfully");
                        }
                        Err(e) => {
                            eprintln!("Failed to spawn backend server: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to create sidecar command: {}", e);
                }
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let child = {
                    let state = window.state::<SidecarState>();
                    state.child.lock().unwrap().take()
                };
            
                if let Some(child) = child {
                    let _ = child.kill();
                    println!("Backend server stopped");
                }
            }
        })     
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
