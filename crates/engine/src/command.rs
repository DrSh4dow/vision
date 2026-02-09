//! Undo/redo command system for scene graph mutations.
//!
//! Every scene mutation goes through the command system so it can be reversed.
//! Commands store minimal before/after state for efficient undo/redo.

use crate::Color;
use crate::path::PathCommand;
use crate::scene::{
    Node, NodeId, NodeKind, ObjectRoutingOverrides, Scene, ShapeSequencerMeta, Transform,
};
use crate::shapes::ShapeData;

/// A reversible scene mutation.
#[derive(Debug, Clone)]
pub(crate) enum SceneCommand {
    /// Add a node to the scene.
    AddNode {
        id: NodeId,
        name: String,
        kind: NodeKind,
        parent: Option<NodeId>,
        transform: Transform,
    },
    /// Remove a node (stores the full subtree for undo).
    RemoveNode {
        /// Snapshot of all removed nodes (node + its descendants) in depth-first order.
        snapshot: Vec<NodeSnapshot>,
        /// Parent of the removed root node.
        parent: Option<NodeId>,
        /// Index within parent's children list.
        index: usize,
    },
    /// Update a node's transform.
    UpdateTransform {
        id: NodeId,
        old: Transform,
        new: Transform,
    },
    /// Update a node's kind (fill, stroke, shape, visibility, etc).
    UpdateKind {
        id: NodeId,
        old: NodeKind,
        new: NodeKind,
    },
    /// Move a node to a different parent.
    MoveNode {
        id: NodeId,
        old_parent: Option<NodeId>,
        old_index: usize,
        new_parent: Option<NodeId>,
        new_index: usize,
    },
    /// Reorder a node within its parent.
    ReorderChild {
        id: NodeId,
        old_index: usize,
        new_index: usize,
    },
    /// Reorder a shape in sequencer execution order.
    ReorderSequencer {
        id: NodeId,
        old_index: usize,
        new_index: usize,
    },
    /// Update object-level routing overrides for a shape.
    SetObjectRoutingOverrides {
        id: NodeId,
        old: ObjectRoutingOverrides,
        new: ObjectRoutingOverrides,
    },
    /// Update a shape node's path commands.
    SetPathCommands {
        id: NodeId,
        old_commands: Vec<PathCommand>,
        old_closed: bool,
        new_commands: Vec<PathCommand>,
        new_closed: bool,
    },
    /// Update a node's name.
    Rename {
        id: NodeId,
        old_name: String,
        new_name: String,
    },
    /// Update a shape node's fill color.
    SetFill {
        id: NodeId,
        old: Option<Color>,
        new: Option<Color>,
    },
    /// Update a shape node's stroke color.
    SetStroke {
        id: NodeId,
        old: Option<Color>,
        new: Option<Color>,
    },
    /// Update a shape node's stroke width.
    SetStrokeWidth { id: NodeId, old: f64, new: f64 },
}

/// Snapshot of a single node for undo restore.
#[derive(Debug, Clone)]
pub(crate) struct NodeSnapshot {
    pub(crate) node: Node,
    pub(crate) shape_meta: Option<ShapeSequencerMeta>,
}

/// Manages the undo/redo history for a scene.
#[derive(Debug)]
pub(crate) struct CommandHistory {
    undo_stack: Vec<SceneCommand>,
    redo_stack: Vec<SceneCommand>,
    /// Maximum number of undo steps.
    max_history: usize,
}

impl CommandHistory {
    /// Create a new command history.
    pub fn new(max_history: usize) -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_history,
        }
    }

    /// Execute a command on the scene and record it for undo.
    pub fn execute(&mut self, scene: &mut Scene, cmd: SceneCommand) -> Result<(), String> {
        apply_command(scene, &cmd, false)?;
        self.undo_stack.push(cmd);
        self.redo_stack.clear();

        // Trim oldest commands if over limit
        if self.undo_stack.len() > self.max_history {
            self.undo_stack.remove(0);
        }

        Ok(())
    }

    /// Undo the last command. Returns true if something was undone.
    pub fn undo(&mut self, scene: &mut Scene) -> Result<bool, String> {
        let Some(cmd) = self.undo_stack.pop() else {
            return Ok(false);
        };
        apply_command(scene, &cmd, true)?;
        self.redo_stack.push(cmd);
        Ok(true)
    }

    /// Redo the last undone command. Returns true if something was redone.
    pub fn redo(&mut self, scene: &mut Scene) -> Result<bool, String> {
        let Some(cmd) = self.redo_stack.pop() else {
            return Ok(false);
        };
        apply_command(scene, &cmd, false)?;
        self.undo_stack.push(cmd);
        Ok(true)
    }

    /// Returns how many undo steps are available.
    #[allow(dead_code)]
    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    /// Returns how many redo steps are available.
    #[allow(dead_code)]
    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    /// Clear all history.
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

impl Default for CommandHistory {
    fn default() -> Self {
        Self::new(crate::constants::DEFAULT_MAX_HISTORY)
    }
}

/// Apply a command to the scene (forward or reverse).
fn apply_command(scene: &mut Scene, cmd: &SceneCommand, reverse: bool) -> Result<(), String> {
    match cmd {
        SceneCommand::AddNode {
            id,
            name,
            kind,
            parent,
            transform,
        } => {
            if reverse {
                // Undo: remove the node
                scene.remove_node(*id)?;
            } else {
                // Forward: add the node
                scene.add_node_with_id(*id, name, kind.clone(), *parent, *transform)?;
            }
        }
        SceneCommand::RemoveNode {
            snapshot,
            parent,
            index,
        } => {
            if reverse {
                // Undo: restore all nodes from snapshot
                restore_snapshot(scene, snapshot, *parent, *index)?;
            } else {
                // Forward: remove the root node (cascades to children)
                if let Some(first) = snapshot.first() {
                    scene.remove_node(first.node.id)?;
                }
            }
        }
        SceneCommand::UpdateTransform { id, old, new } => {
            let t = if reverse { old } else { new };
            let node = scene
                .get_node_mut(*id)
                .ok_or_else(|| format!("Node {:?} not found", id))?;
            node.transform = *t;
        }
        SceneCommand::UpdateKind { id, old, new } => {
            let k = if reverse { old } else { new };
            {
                let node = scene
                    .get_node_mut(*id)
                    .ok_or_else(|| format!("Node {:?} not found", id))?;
                node.kind = k.clone();
            }
            scene.sync_shape_stitch_plan_state(*id);
        }
        SceneCommand::MoveNode {
            id,
            old_parent,
            old_index,
            new_parent,
            new_index,
        } => {
            if reverse {
                scene.move_node(*id, *old_parent, Some(*old_index))?;
            } else {
                scene.move_node(*id, *new_parent, Some(*new_index))?;
            }
        }
        SceneCommand::ReorderChild {
            id,
            old_index,
            new_index,
        } => {
            let idx = if reverse { *old_index } else { *new_index };
            scene.reorder_child(*id, idx)?;
        }
        SceneCommand::ReorderSequencer {
            id,
            old_index,
            new_index,
        } => {
            let idx = if reverse { *old_index } else { *new_index };
            scene.reorder_sequencer_shape(*id, idx)?;
        }
        SceneCommand::SetObjectRoutingOverrides { id, old, new } => {
            let overrides = if reverse { old } else { new };
            scene.set_object_routing_overrides(*id, overrides.clone())?;
        }
        SceneCommand::SetPathCommands {
            id,
            old_commands,
            old_closed,
            new_commands,
            new_closed,
        } => {
            let (cmds, closed) = if reverse {
                (old_commands, *old_closed)
            } else {
                (new_commands, *new_closed)
            };
            {
                let node = scene
                    .get_node_mut(*id)
                    .ok_or_else(|| format!("Node {:?} not found", id))?;
                if let NodeKind::Shape {
                    shape: ShapeData::Path(ref mut path),
                    ..
                } = node.kind
                {
                    *path =
                        crate::path::VectorPath::from_commands_with_closed(cmds.clone(), closed);
                } else {
                    return Err(format!("Node {:?} is not a Path shape", id));
                }
            }
            scene.sync_shape_stitch_plan_state(*id);
        }
        SceneCommand::Rename {
            id,
            old_name,
            new_name,
        } => {
            let n = if reverse { old_name } else { new_name };
            let node = scene
                .get_node_mut(*id)
                .ok_or_else(|| format!("Node {:?} not found", id))?;
            node.name.clone_from(n);
        }
        SceneCommand::SetFill { id, old, new } => {
            let fill = if reverse { old } else { new };
            {
                let node = scene
                    .get_node_mut(*id)
                    .ok_or_else(|| format!("Node {:?} not found", id))?;
                if let NodeKind::Shape {
                    fill: ref mut f, ..
                } = node.kind
                {
                    *f = *fill;
                } else {
                    return Err(format!("Node {:?} is not a Shape", id));
                }
            }
            scene.sync_shape_stitch_plan_state(*id);
        }
        SceneCommand::SetStroke { id, old, new } => {
            let stroke = if reverse { old } else { new };
            {
                let node = scene
                    .get_node_mut(*id)
                    .ok_or_else(|| format!("Node {:?} not found", id))?;
                if let NodeKind::Shape {
                    stroke: ref mut s, ..
                } = node.kind
                {
                    *s = *stroke;
                } else {
                    return Err(format!("Node {:?} is not a Shape", id));
                }
            }
            scene.sync_shape_stitch_plan_state(*id);
        }
        SceneCommand::SetStrokeWidth { id, old, new } => {
            let sw = if reverse { *old } else { *new };
            {
                let node = scene
                    .get_node_mut(*id)
                    .ok_or_else(|| format!("Node {:?} not found", id))?;
                if let NodeKind::Shape {
                    stroke_width: ref mut w,
                    ..
                } = node.kind
                {
                    *w = sw;
                } else {
                    return Err(format!("Node {:?} is not a Shape", id));
                }
            }
            scene.sync_shape_stitch_plan_state(*id);
        }
    }
    Ok(())
}

/// Restore a snapshot of removed nodes back into the scene.
fn restore_snapshot(
    scene: &mut Scene,
    snapshot: &[NodeSnapshot],
    parent: Option<NodeId>,
    index: usize,
) -> Result<(), String> {
    // First pass: re-insert all nodes
    for snap in snapshot {
        let node = &snap.node;
        scene.restore_node(node.clone())?;
        if let Some(meta) = &snap.shape_meta {
            scene.restore_shape_meta(node.id, meta.clone());
        }
    }

    // Re-attach the root node to its parent at the original index
    if let Some(first) = snapshot.first() {
        let root_id = first.node.id;
        scene.reattach_node(root_id, parent, index)?;
    }

    scene.sync_all_stitch_plan_state();

    Ok(())
}

/// Helper to build a RemoveNode command by snapshotting the subtree first.
pub(crate) fn build_remove_command(scene: &Scene, id: NodeId) -> Result<SceneCommand, String> {
    let node = scene
        .get_node(id)
        .ok_or_else(|| format!("Node {:?} not found", id))?;

    let parent = node.parent;

    // Find the index of this node in its parent's children
    let index = if let Some(pid) = parent {
        let parent_node = scene
            .get_node(pid)
            .ok_or_else(|| format!("Parent {:?} not found", pid))?;
        parent_node
            .children
            .iter()
            .position(|c| *c == id)
            .unwrap_or(0)
    } else {
        scene
            .root_children()
            .iter()
            .position(|c| *c == id)
            .unwrap_or(0)
    };

    // Snapshot the whole subtree
    let mut snapshot = Vec::new();
    snapshot_subtree(scene, id, &mut snapshot);

    Ok(SceneCommand::RemoveNode {
        snapshot,
        parent,
        index,
    })
}

/// Recursively snapshot a node and all its descendants.
fn snapshot_subtree(scene: &Scene, id: NodeId, out: &mut Vec<NodeSnapshot>) {
    if let Some(node) = scene.get_node(id) {
        out.push(NodeSnapshot {
            node: node.clone(),
            shape_meta: scene.get_shape_meta(id).cloned(),
        });
        let children: Vec<NodeId> = node.children.clone();
        for child_id in children {
            snapshot_subtree(scene, child_id, out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path::VectorPath;
    use crate::shapes::RectShape;

    fn make_scene_with_layer() -> (Scene, NodeId) {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Layer 1",
                NodeKind::Layer {
                    name: "Layer 1".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();
        (scene, layer)
    }

    #[test]
    fn test_command_add_undo() {
        let mut scene = Scene::new();
        let mut history = CommandHistory::new(100);

        let id = scene.alloc_next_id();
        let cmd = SceneCommand::AddNode {
            id,
            name: "Rect".to_string(),
            kind: NodeKind::Shape {
                shape: ShapeData::Rect(RectShape::new(10.0, 5.0, 0.0)),
                fill: None,
                stroke: None,
                stroke_width: 0.0,
                stitch: crate::StitchParams::default(),
            },
            parent: None,
            transform: Transform::identity(),
        };

        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.node_count(), 1);

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.node_count(), 0);

        history.redo(&mut scene).unwrap();
        assert_eq!(scene.node_count(), 1);
    }

    #[test]
    fn test_command_remove_undo() {
        let (mut scene, layer) = make_scene_with_layer();
        let rect_id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        assert_eq!(scene.node_count(), 2);

        let mut history = CommandHistory::new(100);
        let cmd = build_remove_command(&scene, rect_id).unwrap();
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.node_count(), 1);
        assert!(scene.get_node(layer).unwrap().children.is_empty());

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.node_count(), 2);
        assert_eq!(scene.get_node(layer).unwrap().children.len(), 1);
    }

    #[test]
    fn test_command_remove_subtree_undo() {
        let (mut scene, layer) = make_scene_with_layer();
        let group = scene
            .add_node("Group", NodeKind::Group, Some(layer))
            .unwrap();
        let _child1 = scene
            .add_node(
                "C1",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(group),
            )
            .unwrap();
        let _child2 = scene
            .add_node(
                "C2",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(3.0, 3.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(group),
            )
            .unwrap();

        assert_eq!(scene.node_count(), 4);

        let mut history = CommandHistory::new(100);
        let cmd = build_remove_command(&scene, group).unwrap();
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.node_count(), 1); // only layer remains

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.node_count(), 4);
        assert_eq!(scene.get_node(group).unwrap().children.len(), 2);
    }

    #[test]
    fn test_command_update_transform() {
        let (mut scene, _layer) = make_scene_with_layer();
        let id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let old = scene.get_node(id).unwrap().transform;
        let new = Transform::translate(50.0, 25.0);

        let mut history = CommandHistory::new(100);
        let cmd = SceneCommand::UpdateTransform { id, old, new };
        history.execute(&mut scene, cmd).unwrap();

        let node = scene.get_node(id).unwrap();
        assert!((node.transform.x - 50.0).abs() < 1e-10);
        assert!((node.transform.y - 25.0).abs() < 1e-10);

        history.undo(&mut scene).unwrap();
        let node = scene.get_node(id).unwrap();
        assert!((node.transform.x - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_command_rename() {
        let (mut scene, layer) = make_scene_with_layer();
        let mut history = CommandHistory::new(100);

        let cmd = SceneCommand::Rename {
            id: layer,
            old_name: "Layer 1".to_string(),
            new_name: "Background".to_string(),
        };
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.get_node(layer).unwrap().name, "Background");

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.get_node(layer).unwrap().name, "Layer 1");
    }

    #[test]
    fn test_command_set_fill() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let mut history = CommandHistory::new(100);
        let red = Color::new(255, 0, 0, 255);
        let cmd = SceneCommand::SetFill {
            id,
            old: None,
            new: Some(red),
        };
        history.execute(&mut scene, cmd).unwrap();

        if let NodeKind::Shape { fill, .. } = &scene.get_node(id).unwrap().kind {
            assert!(fill.is_some());
            assert_eq!(fill.unwrap().r, 255);
        } else {
            panic!("Expected shape");
        }

        history.undo(&mut scene).unwrap();
        if let NodeKind::Shape { fill, .. } = &scene.get_node(id).unwrap().kind {
            assert!(fill.is_none());
        } else {
            panic!("Expected shape");
        }
    }

    #[test]
    fn test_command_set_path_commands() {
        let mut scene = Scene::new();
        let mut path = VectorPath::new();
        path.move_to(crate::Point::new(0.0, 0.0));
        path.line_to(crate::Point::new(10.0, 0.0));

        let id = scene
            .add_node(
                "Path",
                NodeKind::Shape {
                    shape: ShapeData::Path(path),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 1.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let old_cmds = vec![
            PathCommand::MoveTo(crate::Point::new(0.0, 0.0)),
            PathCommand::LineTo(crate::Point::new(10.0, 0.0)),
        ];
        let new_cmds = vec![
            PathCommand::MoveTo(crate::Point::new(0.0, 0.0)),
            PathCommand::LineTo(crate::Point::new(20.0, 20.0)),
            PathCommand::Close,
        ];

        let mut history = CommandHistory::new(100);
        let cmd = SceneCommand::SetPathCommands {
            id,
            old_commands: old_cmds,
            old_closed: false,
            new_commands: new_cmds,
            new_closed: true,
        };
        history.execute(&mut scene, cmd).unwrap();

        if let NodeKind::Shape {
            shape: ShapeData::Path(ref p),
            ..
        } = scene.get_node(id).unwrap().kind
        {
            assert!(p.is_closed());
            assert_eq!(p.len(), 3);
        } else {
            panic!("Expected path shape");
        }

        history.undo(&mut scene).unwrap();
        if let NodeKind::Shape {
            shape: ShapeData::Path(ref p),
            ..
        } = scene.get_node(id).unwrap().kind
        {
            assert!(!p.is_closed());
            assert_eq!(p.len(), 2);
        } else {
            panic!("Expected path shape");
        }
    }

    #[test]
    fn test_redo_clears_on_new_command() {
        let mut scene = Scene::new();
        let mut history = CommandHistory::new(100);

        let id1 = scene.alloc_next_id();
        history
            .execute(
                &mut scene,
                SceneCommand::AddNode {
                    id: id1,
                    name: "A".to_string(),
                    kind: NodeKind::Group,
                    parent: None,
                    transform: Transform::identity(),
                },
            )
            .unwrap();

        history.undo(&mut scene).unwrap();
        assert_eq!(history.redo_count(), 1);

        // New command should clear redo stack
        let id2 = scene.alloc_next_id();
        history
            .execute(
                &mut scene,
                SceneCommand::AddNode {
                    id: id2,
                    name: "B".to_string(),
                    kind: NodeKind::Group,
                    parent: None,
                    transform: Transform::identity(),
                },
            )
            .unwrap();

        assert_eq!(history.redo_count(), 0);
    }

    #[test]
    fn test_undo_empty_returns_false() {
        let mut scene = Scene::new();
        let mut history = CommandHistory::new(100);
        let result = history.undo(&mut scene).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_redo_empty_returns_false() {
        let mut scene = Scene::new();
        let mut history = CommandHistory::new(100);
        let result = history.redo(&mut scene).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_max_history_trim() {
        let mut scene = Scene::new();
        let mut history = CommandHistory::new(3);

        for _ in 0..5 {
            let id = scene.alloc_next_id();
            history
                .execute(
                    &mut scene,
                    SceneCommand::AddNode {
                        id,
                        name: "N".to_string(),
                        kind: NodeKind::Group,
                        parent: None,
                        transform: Transform::identity(),
                    },
                )
                .unwrap();
        }

        assert_eq!(history.undo_count(), 3);
    }

    #[test]
    fn test_command_move_node_undo() {
        let (mut scene, layer) = make_scene_with_layer();
        let _group = scene.add_node("Group", NodeKind::Group, None).unwrap();
        let child = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let mut history = CommandHistory::new(100);
        let old_index = scene
            .root_children()
            .iter()
            .position(|c| *c == child)
            .unwrap();
        let cmd = SceneCommand::MoveNode {
            id: child,
            old_parent: None,
            old_index,
            new_parent: Some(layer),
            new_index: 0,
        };
        history.execute(&mut scene, cmd).unwrap();

        assert_eq!(scene.get_node(child).unwrap().parent, Some(layer));
        assert_eq!(scene.get_node(layer).unwrap().children.len(), 1);

        history.undo(&mut scene).unwrap();
        assert!(scene.get_node(child).unwrap().parent.is_none());
        assert!(scene.get_node(layer).unwrap().children.is_empty());
    }

    #[test]
    fn test_command_reorder_undo() {
        let mut scene = Scene::new();
        let a = scene.add_node("A", NodeKind::Group, None).unwrap();
        let b = scene.add_node("B", NodeKind::Group, None).unwrap();
        let c = scene.add_node("C", NodeKind::Group, None).unwrap();

        let mut history = CommandHistory::new(100);
        let cmd = SceneCommand::ReorderChild {
            id: c,
            old_index: 2,
            new_index: 0,
        };
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.root_children(), &[c, a, b]);

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.root_children(), &[a, b, c]);
    }

    #[test]
    fn test_command_reorder_sequencer_undo() {
        let mut scene = Scene::new();
        let make_shape = || NodeKind::Shape {
            shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
            fill: Some(Color::new(120, 120, 120, 255)),
            stroke: Some(Color::new(120, 120, 120, 255)),
            stroke_width: 0.4,
            stitch: crate::StitchParams::default(),
        };

        let a = scene.add_node("A", make_shape(), None).unwrap();
        let b = scene.add_node("B", make_shape(), None).unwrap();
        let c = scene.add_node("C", make_shape(), None).unwrap();

        let mut history = CommandHistory::new(100);
        let cmd = SceneCommand::ReorderSequencer {
            id: c,
            old_index: 2,
            new_index: 0,
        };
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.sequencer_shape_ids(), vec![c, a, b]);

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.sequencer_shape_ids(), vec![a, b, c]);
    }

    #[test]
    fn test_command_set_object_routing_overrides_undo() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Path",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: Some(Color::new(0, 0, 0, 255)),
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let mut history = CommandHistory::new(100);
        let old = scene.object_routing_overrides(id);
        let new = ObjectRoutingOverrides {
            allow_reverse: Some(false),
            entry_exit_mode: Some(crate::export_pipeline::EntryExitMode::PreserveShapeStart),
            tie_mode: Some(crate::export_pipeline::TieMode::ColorChange),
        };
        let cmd = SceneCommand::SetObjectRoutingOverrides {
            id,
            old: old.clone(),
            new: new.clone(),
        };
        history.execute(&mut scene, cmd).unwrap();
        assert_eq!(scene.object_routing_overrides(id), new);

        history.undo(&mut scene).unwrap();
        assert_eq!(scene.object_routing_overrides(id), old);
    }
}
