use std::sync::Mutex;
use tauri::State; // used to manage the apps state

struct AppState {
    click_count: Mutex<i32>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
const RANDOM_TITLES: [&str; 3] = ["hi","hello","greetings"];

#[tauri::command]
fn get_title(state: State<AppState>) -> String {
    let mut count = state.click_count.lock().unwrap(); // re-locks when function ends RAII
    *count = (*count + 1) % (RANDOM_TITLES.len() as i32); // .len() is u32
    format!("{}",RANDOM_TITLES[(*count) as usize])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // tells the process what to put in AppState at compile time 
        .manage(AppState {
            click_count: Mutex::new(0),
        })
        // file reading
        .plugin(tauri_plugin_opener::init())
        // allows us to use these functions from front end
        .invoke_handler(tauri::generate_handler![get_title])
        // generate OS window 
        .run(tauri::generate_context!())
        // crash handling
        .expect("error while running tauri application");
}
