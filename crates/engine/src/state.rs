//! Global singleton state for the WASM environment.
//!
//! The engine runs in a single-threaded WASM context. We use `thread_local!`
//! with `RefCell` to provide mutable access to the shared scene graph and
//! command history without requiring `unsafe` code.

use std::cell::RefCell;

use crate::command::{CommandHistory, SceneCommand};
use crate::scene::Scene;

thread_local! {
    static SCENE: RefCell<Scene> = RefCell::new(Scene::new());
    static HISTORY: RefCell<CommandHistory> = RefCell::new(CommandHistory::default());
}

/// Access the global scene immutably.
pub(crate) fn with_scene<F, R>(f: F) -> R
where
    F: FnOnce(&Scene) -> R,
{
    SCENE.with(|s| f(&s.borrow()))
}

/// Access the global scene mutably.
pub(crate) fn with_scene_mut<F, R>(f: F) -> R
where
    F: FnOnce(&mut Scene) -> R,
{
    SCENE.with(|s| f(&mut s.borrow_mut()))
}

/// Execute a command on the scene with history tracking.
pub(crate) fn execute_command(cmd: SceneCommand) -> Result<(), String> {
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.execute(&mut scene, cmd)
        })
    })
}

/// Reset the scene and clear command history.
pub(crate) fn reset_scene() {
    SCENE.with(|s| {
        *s.borrow_mut() = Scene::new();
    });
    HISTORY.with(|h| {
        h.borrow_mut().clear();
    });
}

/// Undo the last scene command.
pub(crate) fn undo() -> Result<bool, String> {
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.undo(&mut scene)
        })
    })
}

/// Redo the last undone command.
pub(crate) fn redo() -> Result<bool, String> {
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.redo(&mut scene)
        })
    })
}
