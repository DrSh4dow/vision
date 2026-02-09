//! Scene graph for managing embroidery design objects.
//!
//! The scene graph is a tree of `Node`s. Each node has a local transform
//! (position, rotation, scale), a kind (Layer, Group, or Shape), and
//! zero or more children. Layers are named top-level groups.

use std::collections::HashMap;

use crate::Color;
use crate::export_pipeline::{EntryExitMode, TieMode};
use crate::path::BoundingBox;
use crate::shapes::ShapeData;

/// Unique identifier for a scene node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct NodeId(pub u64);

/// 2D affine transform for a scene node.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct Transform {
    /// X position (translation).
    pub x: f64,
    /// Y position (translation).
    pub y: f64,
    /// Rotation angle in radians.
    pub rotation: f64,
    /// Horizontal scale factor.
    pub scale_x: f64,
    /// Vertical scale factor.
    pub scale_y: f64,
}

impl Transform {
    /// Identity transform (no translation, no rotation, scale 1x).
    pub fn identity() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        }
    }

    /// Create a translation-only transform.
    pub fn translate(x: f64, y: f64) -> Self {
        Self {
            x,
            y,
            ..Self::identity()
        }
    }

    /// Convert to a column-major 3x3 affine matrix as a flat `[f64; 6]`.
    ///
    /// The matrix encodes: scale -> rotate -> translate, in the form:
    /// `[a, b, c, d, tx, ty]` where the full matrix is:
    /// ```text
    /// | a  c  tx |
    /// | b  d  ty |
    /// | 0  0   1 |
    /// ```
    pub fn to_matrix(&self) -> [f64; 6] {
        let cos = self.rotation.cos();
        let sin = self.rotation.sin();
        let a = self.scale_x * cos;
        let b = self.scale_x * sin;
        let c = -self.scale_y * sin;
        let d = self.scale_y * cos;
        [a, b, c, d, self.x, self.y]
    }
}

impl Default for Transform {
    fn default() -> Self {
        Self::identity()
    }
}

/// The kind of a scene node.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum NodeKind {
    /// A layer — a named top-level group for organizational purposes.
    Layer {
        /// Display name of the layer.
        name: String,
        /// Whether the layer is visible.
        visible: bool,
        /// Whether the layer is locked (non-editable).
        locked: bool,
    },
    /// A group of child nodes.
    Group,
    /// A shape with associated visual data.
    Shape {
        /// The geometric shape data.
        shape: ShapeData,
        /// Fill color (None = no fill).
        fill: Option<Color>,
        /// Stroke color (None = no stroke).
        stroke: Option<Color>,
        /// Stroke width in design units.
        stroke_width: f64,
        /// Stitching parameters for embroidery export.
        #[serde(default)]
        stitch: crate::StitchParams,
    },
}

/// A node in the scene graph tree.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Node {
    /// Unique identifier.
    pub id: NodeId,
    /// Display name.
    pub name: String,
    /// Local transform relative to parent.
    pub transform: Transform,
    /// Node kind (layer, group, or shape).
    pub kind: NodeKind,
    /// Ordered list of child node IDs.
    pub children: Vec<NodeId>,
    /// Parent node ID (None for root-level nodes).
    pub parent: Option<NodeId>,
}

/// The scene graph — manages the tree of design nodes.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Scene {
    /// All nodes indexed by ID.
    nodes: HashMap<NodeId, Node>,
    /// Root-level node IDs in order.
    root_children: Vec<NodeId>,
    /// Next available node ID.
    next_id: u64,
    /// Per-shape sequencer/routing metadata.
    shape_meta: HashMap<NodeId, ShapeSequencerMeta>,
    /// Next sequencer index to assign to new shape objects.
    next_sequencer_index: u64,
    /// First-class embroidery objects keyed by source shape/node id.
    #[serde(default)]
    embroidery_objects: HashMap<NodeId, EmbroideryObject>,
    /// First-class stitch blocks keyed by block id.
    #[serde(default)]
    stitch_blocks: HashMap<NodeId, StitchBlock>,
    /// Stitch execution order independent from layer/render ordering.
    #[serde(default)]
    sequence_track: SequenceTrack,
}

/// Per-shape metadata used by sequencer-first export routing.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ShapeSequencerMeta {
    pub sequencer_index: u64,
    pub allow_reverse_override: Option<bool>,
    pub entry_exit_override: Option<EntryExitMode>,
    pub tie_mode_override: Option<TieMode>,
}

impl ShapeSequencerMeta {
    fn with_index(sequencer_index: u64) -> Self {
        Self {
            sequencer_index,
            allow_reverse_override: None,
            entry_exit_override: None,
            tie_mode_override: None,
        }
    }
}

/// Editable routing overrides for a single stitch object.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
pub struct ObjectRoutingOverrides {
    #[serde(default)]
    pub allow_reverse: Option<bool>,
    #[serde(default)]
    pub entry_exit_mode: Option<EntryExitMode>,
    #[serde(default)]
    pub tie_mode: Option<TieMode>,
}

/// First-class embroidery object derived from scene geometry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EmbroideryObject {
    /// Stable object id (currently source shape node id).
    pub id: NodeId,
    /// Source node id in scene graph.
    pub source_node_id: NodeId,
    /// Stitch parameters captured for deterministic regeneration.
    pub stitch: crate::StitchParams,
    /// Fill color from source shape.
    pub fill: Option<Color>,
    /// Stroke color from source shape.
    pub stroke: Option<Color>,
    /// Stroke width from source shape.
    pub stroke_width: f64,
}

/// First-class stitch block persisted separately from source geometry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StitchBlock {
    /// Stable block id (currently source shape node id).
    pub id: NodeId,
    /// Owning embroidery object id.
    pub object_id: NodeId,
    /// Source node id.
    pub source_node_id: NodeId,
    /// Stitch type for this block.
    pub stitch_type: crate::StitchType,
    /// Primary thread color for sequencing UI.
    pub color: Option<Color>,
    /// Optional per-block routing overrides.
    pub routing_overrides: ObjectRoutingOverrides,
}

/// Ordered stitch block execution track.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct SequenceTrack {
    pub ordered_block_ids: Vec<NodeId>,
}

/// Stitch-plan row consumed by the sequencer panel.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StitchPlanRow {
    /// Stable block id (currently shape node id).
    pub block_id: NodeId,
    /// Source shape node id.
    pub node_id: NodeId,
    /// Parent in scene tree, for reference only.
    pub parent: Option<NodeId>,
    /// Display name.
    pub name: String,
    /// Stitch type from object params.
    pub stitch_type: crate::StitchType,
    /// Primary thread color.
    pub color: Option<Color>,
    /// Effective visibility (layer visibility folded in).
    pub visible: bool,
    /// Effective lock (layer locks folded in).
    pub locked: bool,
    /// Sequencer execution index.
    pub sequence_index: u64,
    /// Optional routing overrides.
    pub overrides: ObjectRoutingOverrides,
}

impl Scene {
    /// Create a new empty scene.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            root_children: Vec::new(),
            next_id: 1,
            shape_meta: HashMap::new(),
            next_sequencer_index: 1,
            embroidery_objects: HashMap::new(),
            stitch_blocks: HashMap::new(),
            sequence_track: SequenceTrack::default(),
        }
    }

    /// Allocate a new unique `NodeId`.
    fn alloc_id(&mut self) -> NodeId {
        let id = NodeId(self.next_id);
        self.next_id += 1;
        id
    }

    /// Allocate and return the next node ID without creating a node.
    /// Used by the command system to pre-allocate IDs.
    pub(crate) fn alloc_next_id(&mut self) -> NodeId {
        self.alloc_id()
    }

    /// Add a new node to the scene.
    ///
    /// # Arguments
    /// * `name` - Display name for the node.
    /// * `kind` - The node kind (Layer, Group, or Shape).
    /// * `parent` - Parent node ID. If `None`, the node is added at root level.
    ///
    /// # Returns
    /// The `NodeId` of the newly created node.
    ///
    /// # Errors
    /// Returns an error string if the parent ID does not exist.
    pub fn add_node(
        &mut self,
        name: &str,
        kind: NodeKind,
        parent: Option<NodeId>,
    ) -> Result<NodeId, String> {
        let id = self.alloc_id();

        // Validate parent exists
        if let Some(pid) = parent
            && !self.nodes.contains_key(&pid)
        {
            return Err(format!("Parent node {:?} does not exist", pid));
        }

        let node = Node {
            id,
            name: name.to_string(),
            transform: Transform::identity(),
            kind,
            children: Vec::new(),
            parent,
        };

        self.nodes.insert(id, node);
        self.ensure_shape_meta(id);
        self.sync_shape_stitch_plan_state(id);

        if let Some(pid) = parent {
            self.nodes
                .get_mut(&pid)
                .expect("parent validated above")
                .children
                .push(id);
        } else {
            self.root_children.push(id);
        }

        Ok(id)
    }

    /// Remove a node and all its descendants from the scene.
    ///
    /// # Returns
    /// The removed node, or an error if the ID does not exist.
    pub fn remove_node(&mut self, id: NodeId) -> Result<Node, String> {
        let node = self
            .nodes
            .get(&id)
            .ok_or_else(|| format!("Node {:?} does not exist", id))?
            .clone();

        // Recursively remove all descendants (depth-first)
        let children: Vec<NodeId> = node.children.clone();
        for child_id in children {
            let _ = self.remove_node(child_id);
        }

        // Remove from parent's children list
        if let Some(pid) = node.parent {
            if let Some(parent) = self.nodes.get_mut(&pid) {
                parent.children.retain(|c| *c != id);
            }
        } else {
            self.root_children.retain(|c| *c != id);
        }

        self.nodes
            .remove(&id)
            .ok_or_else(|| format!("Node {:?} already removed", id))?;
        self.shape_meta.remove(&id);
        self.remove_stitch_plan_state(id);
        Ok(node)
    }

    /// Get an immutable reference to a node.
    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    /// Get a mutable reference to a node.
    pub(crate) fn get_node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(&id)
    }

    /// Returns the root-level node IDs in order.
    pub fn root_children(&self) -> &[NodeId] {
        &self.root_children
    }

    /// Returns the total number of nodes in the scene.
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Get a first-class embroidery object by id.
    pub fn embroidery_object(&self, id: NodeId) -> Option<&EmbroideryObject> {
        self.embroidery_objects.get(&id)
    }

    /// Get a first-class stitch block by id.
    pub fn stitch_block(&self, id: NodeId) -> Option<&StitchBlock> {
        self.stitch_blocks.get(&id)
    }

    /// Get the sequence track (ordered stitch block ids).
    pub fn sequence_track(&self) -> &SequenceTrack {
        &self.sequence_track
    }

    /// Get all first-class embroidery objects ordered by source id.
    pub fn get_embroidery_objects(&self) -> Vec<EmbroideryObject> {
        let mut out: Vec<EmbroideryObject> = self.embroidery_objects.values().cloned().collect();
        out.sort_by_key(|obj| obj.id.0);
        out
    }

    /// Get stitch blocks in sequence-track order.
    pub fn get_stitch_blocks(&self) -> Vec<StitchBlock> {
        let ordered = if self.sequence_track.ordered_block_ids.is_empty() {
            self.sequencer_shape_ids()
        } else {
            self.sequence_track.ordered_block_ids.clone()
        };

        ordered
            .into_iter()
            .filter_map(|id| self.stitch_blocks.get(&id).cloned())
            .collect()
    }

    /// Move a node to a new parent (or to root level if `new_parent` is `None`).
    ///
    /// # Arguments
    /// * `id` - The node to move.
    /// * `new_parent` - The new parent, or `None` for root level.
    /// * `index` - Position within the new parent's children list.
    ///   If `None`, appends to the end.
    pub fn move_node(
        &mut self,
        id: NodeId,
        new_parent: Option<NodeId>,
        index: Option<usize>,
    ) -> Result<(), String> {
        if !self.nodes.contains_key(&id) {
            return Err(format!("Node {:?} does not exist", id));
        }
        if let Some(pid) = new_parent {
            if !self.nodes.contains_key(&pid) {
                return Err(format!("New parent {:?} does not exist", pid));
            }
            // Prevent moving a node into its own subtree
            if self.is_ancestor_of(id, pid) {
                return Err("Cannot move a node into its own subtree".to_string());
            }
        }

        // Remove from old parent
        let old_parent = self.nodes.get(&id).expect("node validated above").parent;
        if let Some(opid) = old_parent {
            if let Some(old_parent_node) = self.nodes.get_mut(&opid) {
                old_parent_node.children.retain(|c| *c != id);
            }
        } else {
            self.root_children.retain(|c| *c != id);
        }

        // Add to new parent
        if let Some(npid) = new_parent {
            let parent_node = self
                .nodes
                .get_mut(&npid)
                .expect("new parent validated above");
            let idx = index.unwrap_or(parent_node.children.len());
            let idx = idx.min(parent_node.children.len());
            parent_node.children.insert(idx, id);
        } else {
            let idx = index.unwrap_or(self.root_children.len());
            let idx = idx.min(self.root_children.len());
            self.root_children.insert(idx, id);
        }

        // Update the node's parent reference
        self.nodes
            .get_mut(&id)
            .expect("node validated above")
            .parent = new_parent;

        Ok(())
    }

    /// Reorder a child within its parent's children list.
    ///
    /// # Arguments
    /// * `id` - The node to reorder.
    /// * `new_index` - The new position within siblings.
    pub fn reorder_child(&mut self, id: NodeId, new_index: usize) -> Result<(), String> {
        let node = self
            .nodes
            .get(&id)
            .ok_or_else(|| format!("Node {:?} does not exist", id))?;
        let parent = node.parent;

        let siblings = if let Some(pid) = parent {
            &mut self
                .nodes
                .get_mut(&pid)
                .expect("parent exists if child exists")
                .children
        } else {
            &mut self.root_children
        };

        let current_index = siblings
            .iter()
            .position(|c| *c == id)
            .ok_or_else(|| format!("Node {:?} not found in siblings list", id))?;

        siblings.remove(current_index);
        let new_index = new_index.min(siblings.len());
        siblings.insert(new_index, id);

        Ok(())
    }

    /// Check if `ancestor` is an ancestor of `descendant`.
    fn is_ancestor_of(&self, ancestor: NodeId, descendant: NodeId) -> bool {
        let mut current = Some(descendant);
        while let Some(cid) = current {
            if cid == ancestor {
                return true;
            }
            current = self.nodes.get(&cid).and_then(|n| n.parent);
        }
        false
    }

    /// Compute the bounding box of a node and all its descendants.
    ///
    /// For shape nodes, returns the shape's bounding box offset by the node's transform.
    /// For group/layer nodes, returns the union of all descendant bounding boxes.
    pub fn node_bounding_box(&self, id: NodeId) -> BoundingBox {
        let Some(node) = self.nodes.get(&id) else {
            return BoundingBox::empty();
        };

        let mut bbox = match &node.kind {
            NodeKind::Shape { shape, .. } => shape.bounding_box(),
            _ => BoundingBox::empty(),
        };

        // Union with children bounding boxes
        for &child_id in &node.children {
            let child_bbox = self.node_bounding_box(child_id);
            bbox.union(&child_bbox);
        }

        // Offset by this node's position (simplified — ignores rotation/scale for now)
        if !bbox.is_empty() {
            bbox.min_x += node.transform.x;
            bbox.min_y += node.transform.y;
            bbox.max_x += node.transform.x;
            bbox.max_y += node.transform.y;
        }

        bbox
    }

    /// Add a node with a specific pre-allocated ID.
    /// Used by the command system for deterministic undo/redo.
    pub fn add_node_with_id(
        &mut self,
        id: NodeId,
        name: &str,
        kind: NodeKind,
        parent: Option<NodeId>,
        transform: Transform,
    ) -> Result<NodeId, String> {
        if let Some(pid) = parent
            && !self.nodes.contains_key(&pid)
        {
            return Err(format!("Parent node {:?} does not exist", pid));
        }

        if self.nodes.contains_key(&id) {
            return Err(format!("Node {:?} already exists", id));
        }

        // Ensure next_id stays ahead
        if id.0 >= self.next_id {
            self.next_id = id.0 + 1;
        }

        let node = Node {
            id,
            name: name.to_string(),
            transform,
            kind,
            children: Vec::new(),
            parent,
        };

        self.nodes.insert(id, node);
        self.ensure_shape_meta(id);
        self.sync_shape_stitch_plan_state(id);

        if let Some(pid) = parent {
            self.nodes
                .get_mut(&pid)
                .expect("parent validated above")
                .children
                .push(id);
        } else {
            self.root_children.push(id);
        }

        Ok(id)
    }

    /// Restore a node directly into the nodes map (for undo).
    /// Does NOT update parent/children linkage — call `reattach_node` after.
    pub(crate) fn restore_node(&mut self, node: Node) -> Result<(), String> {
        let id = node.id;
        if id.0 >= self.next_id {
            self.next_id = id.0 + 1;
        }
        self.nodes.insert(id, node);
        self.ensure_shape_meta(id);
        self.sync_shape_stitch_plan_state(id);
        Ok(())
    }

    /// Get a shape's sequencer/routing metadata.
    pub fn get_shape_meta(&self, id: NodeId) -> Option<&ShapeSequencerMeta> {
        self.shape_meta.get(&id)
    }

    /// Restore shape metadata for a node (used by undo snapshot restore).
    pub fn restore_shape_meta(&mut self, id: NodeId, meta: ShapeSequencerMeta) {
        self.next_sequencer_index = self.next_sequencer_index.max(meta.sequencer_index + 1);
        self.shape_meta.insert(id, meta);
        self.sync_shape_stitch_plan_state(id);
        self.sync_sequence_track_from_shape_meta();
    }

    pub(crate) fn sync_shape_stitch_plan_state(&mut self, id: NodeId) {
        let Some(node) = self.nodes.get(&id) else {
            self.remove_stitch_plan_state(id);
            return;
        };

        let NodeKind::Shape {
            fill,
            stroke,
            stroke_width,
            stitch,
            ..
        } = &node.kind
        else {
            self.remove_stitch_plan_state(id);
            return;
        };

        let object = EmbroideryObject {
            id,
            source_node_id: id,
            stitch: *stitch,
            fill: *fill,
            stroke: *stroke,
            stroke_width: *stroke_width,
        };
        self.embroidery_objects.insert(id, object);

        let routing_overrides = self.object_routing_overrides(id);
        let block = StitchBlock {
            id,
            object_id: id,
            source_node_id: id,
            stitch_type: stitch.stitch_type,
            color: (*stroke).or(*fill),
            routing_overrides,
        };
        self.stitch_blocks.insert(id, block);

        if !self.sequence_track.ordered_block_ids.contains(&id) {
            self.sequence_track.ordered_block_ids.push(id);
        }
    }

    pub(crate) fn sync_all_stitch_plan_state(&mut self) {
        let ids: Vec<NodeId> = self.nodes.keys().copied().collect();
        for id in ids {
            self.ensure_shape_meta(id);
            self.sync_shape_stitch_plan_state(id);
        }
        self.sequence_track
            .ordered_block_ids
            .retain(|id| self.stitch_blocks.contains_key(id));
        self.sync_sequence_track_from_shape_meta();
    }

    fn remove_stitch_plan_state(&mut self, id: NodeId) {
        self.embroidery_objects.remove(&id);
        self.stitch_blocks.remove(&id);
        self.sequence_track
            .ordered_block_ids
            .retain(|bid| *bid != id);
    }

    fn sync_sequence_track_from_shape_meta(&mut self) {
        let ordered = self.sequencer_shape_ids();
        self.sequence_track.ordered_block_ids = ordered
            .into_iter()
            .filter(|id| self.stitch_blocks.contains_key(id))
            .collect();
    }

    fn ensure_shape_meta(&mut self, id: NodeId) {
        let is_shape = self
            .nodes
            .get(&id)
            .is_some_and(|n| matches!(n.kind, NodeKind::Shape { .. }));
        if !is_shape {
            self.shape_meta.remove(&id);
            self.remove_stitch_plan_state(id);
            return;
        }

        self.shape_meta.entry(id).or_insert_with(|| {
            let idx = self.next_sequencer_index;
            self.next_sequencer_index += 1;
            ShapeSequencerMeta::with_index(idx)
        });
    }

    /// Return shape ids sorted by sequencer order.
    pub fn sequencer_shape_ids(&self) -> Vec<NodeId> {
        let mut ids: Vec<NodeId> = self
            .nodes
            .values()
            .filter(|node| matches!(node.kind, NodeKind::Shape { .. }))
            .map(|node| node.id)
            .collect();

        ids.sort_by(|a, b| {
            let ai = self
                .shape_meta
                .get(a)
                .map(|m| m.sequencer_index)
                .unwrap_or(u64::MAX);
            let bi = self
                .shape_meta
                .get(b)
                .map(|m| m.sequencer_index)
                .unwrap_or(u64::MAX);
            ai.cmp(&bi).then_with(|| a.0.cmp(&b.0))
        });
        ids
    }

    /// Reorder a shape within sequencer execution order.
    pub fn reorder_sequencer_shape(&mut self, id: NodeId, new_index: usize) -> Result<(), String> {
        if !self
            .nodes
            .get(&id)
            .is_some_and(|n| matches!(n.kind, NodeKind::Shape { .. }))
        {
            return Err(format!("Node {:?} is not a Shape", id));
        }

        let mut ordered = self.sequencer_shape_ids();
        let current_index = ordered
            .iter()
            .position(|candidate| *candidate == id)
            .ok_or_else(|| format!("Shape {:?} not found in sequencer order", id))?;
        ordered.remove(current_index);
        let target = new_index.min(ordered.len());
        ordered.insert(target, id);

        for (idx, shape_id) in ordered.iter().enumerate() {
            let meta = self
                .shape_meta
                .entry(*shape_id)
                .or_insert_with(|| ShapeSequencerMeta::with_index((idx + 1) as u64));
            meta.sequencer_index = (idx + 1) as u64;
        }
        self.next_sequencer_index = (ordered.len() as u64) + 1;
        self.sync_sequence_track_from_shape_meta();
        Ok(())
    }

    /// Update object-level routing overrides for a shape.
    pub fn set_object_routing_overrides(
        &mut self,
        id: NodeId,
        overrides: ObjectRoutingOverrides,
    ) -> Result<(), String> {
        if !self
            .nodes
            .get(&id)
            .is_some_and(|n| matches!(n.kind, NodeKind::Shape { .. }))
        {
            return Err(format!("Node {:?} is not a Shape", id));
        }
        let meta = self.shape_meta.entry(id).or_insert_with(|| {
            let idx = self.next_sequencer_index;
            self.next_sequencer_index += 1;
            ShapeSequencerMeta::with_index(idx)
        });
        meta.allow_reverse_override = overrides.allow_reverse;
        meta.entry_exit_override = overrides.entry_exit_mode;
        meta.tie_mode_override = overrides.tie_mode;
        if let Some(block) = self.stitch_blocks.get_mut(&id) {
            block.routing_overrides = ObjectRoutingOverrides {
                allow_reverse: meta.allow_reverse_override,
                entry_exit_mode: meta.entry_exit_override,
                tie_mode: meta.tie_mode_override,
            };
        }
        Ok(())
    }

    /// Get object-level routing overrides for a shape.
    pub fn object_routing_overrides(&self, id: NodeId) -> ObjectRoutingOverrides {
        if let Some(meta) = self.shape_meta.get(&id) {
            return ObjectRoutingOverrides {
                allow_reverse: meta.allow_reverse_override,
                entry_exit_mode: meta.entry_exit_override,
                tie_mode: meta.tie_mode_override,
            };
        }
        if let Some(block) = self.stitch_blocks.get(&id) {
            return block.routing_overrides.clone();
        }
        ObjectRoutingOverrides::default()
    }

    /// Build stitch-plan rows in sequencer order.
    pub fn get_stitch_plan_rows(&self) -> Vec<StitchPlanRow> {
        let mut rows = Vec::new();
        let ordered = if self.sequence_track.ordered_block_ids.is_empty() {
            self.sequencer_shape_ids()
        } else {
            self.sequence_track.ordered_block_ids.clone()
        };

        for id in ordered {
            let Some(block) = self.stitch_blocks.get(&id) else {
                continue;
            };
            let Some(node) = self.nodes.get(&id) else {
                continue;
            };
            let sequence_index = self
                .shape_meta
                .get(&id)
                .map(|m| m.sequencer_index)
                .unwrap_or(u64::MAX);
            rows.push(StitchPlanRow {
                block_id: id,
                node_id: id,
                parent: node.parent,
                name: node.name.clone(),
                stitch_type: block.stitch_type,
                color: block.color,
                visible: !self.is_in_hidden_layer(id),
                locked: self.is_in_locked_layer(id),
                sequence_index,
                overrides: block.routing_overrides.clone(),
            });
        }
        rows
    }

    /// Get render items in sequencer order (fallback to render order for shapes
    /// with missing metadata).
    pub fn render_list_sequencer_order(&self) -> Vec<RenderItem> {
        let render_items = self.render_list();
        let mut by_id: HashMap<NodeId, RenderItem> =
            render_items.iter().cloned().map(|it| (it.id, it)).collect();

        let mut ordered = Vec::with_capacity(render_items.len());
        for shape_id in self.sequencer_shape_ids() {
            if let Some(item) = by_id.remove(&shape_id) {
                ordered.push(item);
            }
        }

        for item in render_items {
            let item_id = item.id;
            if by_id.contains_key(&item_id) {
                ordered.push(item);
                by_id.remove(&item_id);
            }
        }

        ordered
    }

    /// Re-attach a restored node to its parent at a specific index (for undo).
    pub(crate) fn reattach_node(
        &mut self,
        id: NodeId,
        parent: Option<NodeId>,
        index: usize,
    ) -> Result<(), String> {
        if let Some(pid) = parent {
            let parent_node = self
                .nodes
                .get_mut(&pid)
                .ok_or_else(|| format!("Parent {:?} not found", pid))?;
            let idx = index.min(parent_node.children.len());
            parent_node.children.insert(idx, id);
        } else {
            let idx = index.min(self.root_children.len());
            self.root_children.insert(idx, id);
        }

        // Also re-attach children of this node to their parent references
        let children: Vec<NodeId> = self
            .nodes
            .get(&id)
            .map(|n| n.children.clone())
            .unwrap_or_default();
        for child_id in children {
            if let Some(child) = self.nodes.get_mut(&child_id) {
                child.parent = Some(id);
            }
        }

        Ok(())
    }

    /// Hit-test: find the topmost node at a given point (in world coordinates).
    ///
    /// Traverses in reverse depth-first order (topmost visually = last drawn = checked first).
    /// Only tests Shape nodes. Respects layer visibility.
    pub fn hit_test(&self, x: f64, y: f64) -> Option<NodeId> {
        // Traverse in reverse drawing order (last drawn = topmost)
        let all_nodes = self.iter_depth_first();
        for &id in all_nodes.iter().rev() {
            let Some(node) = self.nodes.get(&id) else {
                continue;
            };

            // Skip invisible layers and their children
            if self.is_in_hidden_layer(id) {
                continue;
            }

            if let NodeKind::Shape { ref shape, .. } = node.kind {
                // Transform the test point into local space
                let local_x = x - node.transform.x;
                let local_y = y - node.transform.y;
                // TODO: handle rotation/scale in local space transform

                let test_point = crate::Point::new(local_x, local_y);

                // First check bounding box (fast reject)
                let bbox = shape.bounding_box();
                if bbox.contains(test_point) && shape.contains_point(test_point) {
                    return Some(id);
                }

                // For open paths / strokes, check proximity to path
                if !bbox.is_empty() {
                    let tol = crate::constants::HIT_TEST_TOLERANCE;
                    let expanded = crate::path::BoundingBox::new(
                        bbox.min_x - tol,
                        bbox.min_y - tol,
                        bbox.max_x + tol,
                        bbox.max_y + tol,
                    );
                    if expanded.contains(test_point) {
                        // Close enough to bounding box — check stroke hit
                        let path = shape.to_path();
                        if point_near_path(&path, test_point, 3.0) {
                            return Some(id);
                        }
                    }
                }
            }
        }
        None
    }

    /// Check if a node is inside a hidden (invisible) layer.
    fn is_in_hidden_layer(&self, id: NodeId) -> bool {
        let mut current = Some(id);
        while let Some(cid) = current {
            if let Some(node) = self.nodes.get(&cid) {
                if let NodeKind::Layer { visible, .. } = &node.kind
                    && !visible
                {
                    return true;
                }
                current = node.parent;
            } else {
                break;
            }
        }
        false
    }

    /// Check if a node is inside a locked layer.
    fn is_in_locked_layer(&self, id: NodeId) -> bool {
        let mut current = Some(id);
        while let Some(cid) = current {
            if let Some(node) = self.nodes.get(&cid) {
                if let NodeKind::Layer { locked, .. } = &node.kind
                    && *locked
                {
                    return true;
                }
                current = node.parent;
            } else {
                break;
            }
        }
        false
    }

    /// Get the world-space transform for a node by composing parent transforms.
    pub fn world_transform(&self, id: NodeId) -> Transform {
        let mut chain = Vec::new();
        let mut current = Some(id);
        while let Some(cid) = current {
            if let Some(node) = self.nodes.get(&cid) {
                chain.push(node.transform);
                current = node.parent;
            } else {
                break;
            }
        }

        // Compose from root to leaf
        let mut result = Transform::identity();
        for t in chain.into_iter().rev() {
            result = compose_transforms(&result, &t);
        }
        result
    }

    /// Get the render list: depth-first traversal with computed world transforms.
    /// Only returns visible shape nodes.
    pub fn render_list(&self) -> Vec<RenderItem> {
        let mut items = Vec::new();
        for &root_id in &self.root_children {
            self.collect_render_items(root_id, &Transform::identity(), &mut items);
        }
        items
    }

    /// Recursive helper for building the render list.
    fn collect_render_items(
        &self,
        id: NodeId,
        parent_transform: &Transform,
        out: &mut Vec<RenderItem>,
    ) {
        let Some(node) = self.nodes.get(&id) else {
            return;
        };

        // Skip invisible layers
        if let NodeKind::Layer { visible, .. } = &node.kind
            && !visible
        {
            return;
        }

        let world = compose_transforms(parent_transform, &node.transform);

        if let NodeKind::Shape { .. } = &node.kind {
            out.push(RenderItem {
                id,
                world_transform: world.to_matrix(),
                kind: node.kind.clone(),
                name: node.name.clone(),
            });
        }

        for &child_id in &node.children {
            self.collect_render_items(child_id, &world, out);
        }
    }

    /// Get the full tree structure for the layers panel.
    pub fn get_tree(&self) -> Vec<TreeNode> {
        self.root_children
            .iter()
            .filter_map(|&id| self.build_tree_node(id))
            .collect()
    }

    /// Recursive helper for building tree nodes.
    ///
    /// Returns `None` if the node is missing (indicates an inconsistent scene
    /// graph, which is logged but does not crash the WASM module).
    fn build_tree_node(&self, id: NodeId) -> Option<TreeNode> {
        let node = self.nodes.get(&id)?;
        let kind_type = match &node.kind {
            NodeKind::Layer {
                visible, locked, ..
            } => TreeNodeKind::Layer {
                visible: *visible,
                locked: *locked,
            },
            NodeKind::Group => TreeNodeKind::Group,
            NodeKind::Shape { .. } => TreeNodeKind::Shape,
        };

        Some(TreeNode {
            id,
            name: node.name.clone(),
            kind: kind_type,
            children: node
                .children
                .iter()
                .filter_map(|&cid| self.build_tree_node(cid))
                .collect(),
        })
    }

    /// Iterate over all nodes in depth-first order.
    pub fn iter_depth_first(&self) -> Vec<NodeId> {
        let mut result = Vec::new();
        for &root_id in &self.root_children {
            self.collect_depth_first(root_id, &mut result);
        }
        result
    }

    /// Recursive helper for depth-first iteration.
    fn collect_depth_first(&self, id: NodeId, out: &mut Vec<NodeId>) {
        out.push(id);
        if let Some(node) = self.nodes.get(&id) {
            for &child_id in &node.children {
                self.collect_depth_first(child_id, out);
            }
        }
    }
}

impl Default for Scene {
    fn default() -> Self {
        Self::new()
    }
}

/// An item in the render list — a visible shape with its computed world transform.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RenderItem {
    /// Node ID.
    pub id: NodeId,
    /// Computed world transform as `[a, b, c, d, tx, ty]`.
    pub world_transform: [f64; 6],
    /// Node kind (always Shape for render items).
    pub kind: NodeKind,
    /// Display name.
    pub name: String,
}

/// A node in the tree view (for layers panel).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TreeNode {
    /// Node ID.
    pub id: NodeId,
    /// Display name.
    pub name: String,
    /// Kind of this tree node.
    pub kind: TreeNodeKind,
    /// Child tree nodes.
    pub children: Vec<TreeNode>,
}

/// Simplified node kind for the tree view.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum TreeNodeKind {
    Layer { visible: bool, locked: bool },
    Group,
    Shape,
}

/// Compose two 2D affine transforms: result = parent * child.
fn compose_transforms(parent: &Transform, child: &Transform) -> Transform {
    let pm = parent.to_matrix();
    let cm = child.to_matrix();

    // Matrix multiplication of two 2x3 affine matrices
    // [a c tx]   [a' c' tx']   [aa'+cb'  ac'+cd'  atx'+ctx'+tx]
    // [b d ty] x [b' d' ty'] = [ba'+db'  bc'+dd'  btx'+dty'+ty]
    let a = pm[0] * cm[0] + pm[2] * cm[1];
    let b = pm[1] * cm[0] + pm[3] * cm[1];
    let c = pm[0] * cm[2] + pm[2] * cm[3];
    let d = pm[1] * cm[2] + pm[3] * cm[3];
    let tx = pm[0] * cm[4] + pm[2] * cm[5] + pm[4];
    let ty = pm[1] * cm[4] + pm[3] * cm[5] + pm[5];

    // Decompose back to Transform fields
    let scale_x = (a * a + b * b).sqrt();
    let scale_y = (c * c + d * d).sqrt();
    let rotation = b.atan2(a);

    Transform {
        x: tx,
        y: ty,
        rotation,
        scale_x,
        scale_y,
    }
}

/// Check if a point is within `tolerance` distance of any segment in a path.
fn point_near_path(path: &crate::path::VectorPath, test: crate::Point, tolerance: f64) -> bool {
    let points = path.flatten(crate::constants::DEFAULT_FLATTEN_TOLERANCE);
    if points.len() < 2 {
        return false;
    }

    let tol_sq = tolerance * tolerance;
    for pair in points.windows(2) {
        let dist_sq = point_to_segment_dist_sq(test, pair[0], pair[1]);
        if dist_sq <= tol_sq {
            return true;
        }
    }
    false
}

/// Squared distance from a point to a line segment.
fn point_to_segment_dist_sq(p: crate::Point, a: crate::Point, b: crate::Point) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let len_sq = dx * dx + dy * dy;

    if len_sq < f64::EPSILON {
        let ex = p.x - a.x;
        let ey = p.y - a.y;
        return ex * ex + ey * ey;
    }

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len_sq;
    let t = t.clamp(0.0, 1.0);

    let proj_x = a.x + t * dx;
    let proj_y = a.y + t * dy;
    let ex = p.x - proj_x;
    let ey = p.y - proj_y;
    ex * ex + ey * ey
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shapes::{EllipseShape, RectShape};

    #[test]
    fn test_scene_new_is_empty() {
        let scene = Scene::new();
        assert_eq!(scene.node_count(), 0);
        assert!(scene.root_children().is_empty());
    }

    #[test]
    fn test_add_root_layer() {
        let mut scene = Scene::new();
        let id = scene
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

        assert_eq!(scene.node_count(), 1);
        assert_eq!(scene.root_children().len(), 1);

        let node = scene.get_node(id).unwrap();
        assert_eq!(node.name, "Layer 1");
        assert!(node.parent.is_none());
    }

    #[test]
    fn test_add_child_shape() {
        let mut scene = Scene::new();
        let layer_id = scene
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

        let rect_id = scene
            .add_node(
                "Rectangle",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(100.0, 50.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer_id),
            )
            .unwrap();

        assert_eq!(scene.node_count(), 2);
        let layer = scene.get_node(layer_id).unwrap();
        assert_eq!(layer.children.len(), 1);
        assert_eq!(layer.children[0], rect_id);

        let rect = scene.get_node(rect_id).unwrap();
        assert_eq!(rect.parent, Some(layer_id));
    }

    #[test]
    fn test_add_node_invalid_parent() {
        let mut scene = Scene::new();
        let result = scene.add_node("Orphan", NodeKind::Group, Some(NodeId(999)));
        assert!(result.is_err());
    }

    #[test]
    fn test_remove_node() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "Layer".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        assert_eq!(scene.node_count(), 1);
        let removed = scene.remove_node(id).unwrap();
        assert_eq!(removed.name, "Layer");
        assert_eq!(scene.node_count(), 0);
        assert!(scene.root_children().is_empty());
    }

    #[test]
    fn test_remove_node_with_children() {
        let mut scene = Scene::new();
        let layer_id = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "Layer".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        let _child1 = scene
            .add_node("Child 1", NodeKind::Group, Some(layer_id))
            .unwrap();
        let _child2 = scene
            .add_node("Child 2", NodeKind::Group, Some(layer_id))
            .unwrap();

        assert_eq!(scene.node_count(), 3);
        scene.remove_node(layer_id).unwrap();
        assert_eq!(scene.node_count(), 0);
    }

    #[test]
    fn test_remove_nonexistent_node() {
        let mut scene = Scene::new();
        assert!(scene.remove_node(NodeId(999)).is_err());
    }

    #[test]
    fn test_move_node_to_different_parent() {
        let mut scene = Scene::new();
        let layer1 = scene
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
        let layer2 = scene
            .add_node(
                "Layer 2",
                NodeKind::Layer {
                    name: "Layer 2".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();
        let child = scene
            .add_node("Child", NodeKind::Group, Some(layer1))
            .unwrap();

        // Move child from layer1 to layer2
        scene.move_node(child, Some(layer2), None).unwrap();

        assert!(scene.get_node(layer1).unwrap().children.is_empty());
        assert_eq!(scene.get_node(layer2).unwrap().children.len(), 1);
        assert_eq!(scene.get_node(child).unwrap().parent, Some(layer2));
    }

    #[test]
    fn test_move_node_to_root() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "Layer".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();
        let child = scene
            .add_node("Child", NodeKind::Group, Some(layer))
            .unwrap();

        scene.move_node(child, None, None).unwrap();

        assert!(scene.get_node(layer).unwrap().children.is_empty());
        assert_eq!(scene.root_children().len(), 2);
        assert!(scene.get_node(child).unwrap().parent.is_none());
    }

    #[test]
    fn test_move_node_prevent_cycle() {
        let mut scene = Scene::new();
        let parent = scene.add_node("Parent", NodeKind::Group, None).unwrap();
        let child = scene
            .add_node("Child", NodeKind::Group, Some(parent))
            .unwrap();

        // Try to move parent into child — should fail
        let result = scene.move_node(parent, Some(child), None);
        assert!(result.is_err());
    }

    #[test]
    fn test_reorder_child() {
        let mut scene = Scene::new();
        let a = scene.add_node("A", NodeKind::Group, None).unwrap();
        let b = scene.add_node("B", NodeKind::Group, None).unwrap();
        let c = scene.add_node("C", NodeKind::Group, None).unwrap();

        assert_eq!(scene.root_children(), &[a, b, c]);

        // Move C to index 0
        scene.reorder_child(c, 0).unwrap();
        assert_eq!(scene.root_children(), &[c, a, b]);

        // Move A to index 2 (end)
        scene.reorder_child(a, 2).unwrap();
        assert_eq!(scene.root_children(), &[c, b, a]);
    }

    #[test]
    fn test_transform_identity() {
        let t = Transform::identity();
        let m = t.to_matrix();
        // Identity: a=1, b=0, c=0, d=1, tx=0, ty=0
        assert!((m[0] - 1.0).abs() < 1e-10);
        assert!((m[1] - 0.0).abs() < 1e-10);
        assert!((m[2] - 0.0).abs() < 1e-10);
        assert!((m[3] - 1.0).abs() < 1e-10);
        assert!((m[4] - 0.0).abs() < 1e-10);
        assert!((m[5] - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_transform_translate() {
        let t = Transform::translate(10.0, 20.0);
        let m = t.to_matrix();
        assert!((m[4] - 10.0).abs() < 1e-10);
        assert!((m[5] - 20.0).abs() < 1e-10);
    }

    #[test]
    fn test_node_bounding_box_shape() {
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

        // Set a position offset
        scene.get_node_mut(id).unwrap().transform = Transform::translate(100.0, 200.0);

        let bbox = scene.node_bounding_box(id);
        assert!((bbox.min_x - 100.0).abs() < 1e-10);
        assert!((bbox.min_y - 200.0).abs() < 1e-10);
        assert!((bbox.max_x - 110.0).abs() < 1e-10);
        assert!((bbox.max_y - 205.0).abs() < 1e-10);
    }

    #[test]
    fn test_iter_depth_first() {
        let mut scene = Scene::new();
        let a = scene
            .add_node(
                "A",
                NodeKind::Layer {
                    name: "A".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();
        let b = scene.add_node("B", NodeKind::Group, Some(a)).unwrap();
        let c = scene.add_node("C", NodeKind::Group, Some(a)).unwrap();
        let d = scene.add_node("D", NodeKind::Group, Some(b)).unwrap();

        let order = scene.iter_depth_first();
        assert_eq!(order, vec![a, b, d, c]);
    }

    #[test]
    fn test_scene_with_multiple_shapes() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Main",
                NodeKind::Layer {
                    name: "Main".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        let _rect = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(100.0, 50.0, 5.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 1.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let _ellipse = scene
            .add_node(
                "Ellipse",
                NodeKind::Shape {
                    shape: ShapeData::Ellipse(EllipseShape::new(30.0, 20.0)),
                    fill: Some(Color::new(0, 0, 255, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        assert_eq!(scene.node_count(), 3);
        assert_eq!(scene.get_node(layer).unwrap().children.len(), 2);
    }

    #[test]
    fn test_hit_test_shape() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        // Point inside the rect (0,0)→(10,10) at identity transform
        let hit = scene.hit_test(5.0, 5.0);
        assert_eq!(hit, Some(id));

        // Point outside
        let miss = scene.hit_test(50.0, 50.0);
        assert!(miss.is_none());
    }

    #[test]
    fn test_render_list_ordering() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "L1".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        let r1 = scene
            .add_node(
                "R1",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let r2 = scene
            .add_node(
                "R2",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(0, 0, 255, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let items = scene.render_list();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, r1);
        assert_eq!(items[1].id, r2);
    }

    #[test]
    fn test_render_list_hidden_layer_excluded() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Hidden",
                NodeKind::Layer {
                    name: "Hidden".to_string(),
                    visible: false,
                    locked: false,
                },
                None,
            )
            .unwrap();

        scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let items = scene.render_list();
        assert!(items.is_empty(), "Hidden layer shapes should not render");
    }

    #[test]
    fn test_world_transform_nested() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "L1".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        // Set layer transform to (10, 20)
        scene.get_node_mut(layer).unwrap().transform = Transform {
            x: 10.0,
            y: 20.0,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        };

        let rect_id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        // Set rect transform to (3, 4)
        scene.get_node_mut(rect_id).unwrap().transform = Transform {
            x: 3.0,
            y: 4.0,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        };

        let world = scene.world_transform(rect_id);
        // World transform should be (10+3, 20+4) = (13, 24)
        assert!((world.x - 13.0).abs() < 1e-10);
        assert!((world.y - 24.0).abs() < 1e-10);
    }

    #[test]
    fn test_get_tree_structure() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Layer",
                NodeKind::Layer {
                    name: "L1".to_string(),
                    visible: true,
                    locked: false,
                },
                None,
            )
            .unwrap();

        let _r1 = scene
            .add_node(
                "R1",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let _r2 = scene
            .add_node(
                "R2",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let tree = scene.get_tree();
        assert_eq!(tree.len(), 1, "One root node (Layer)");
        assert_eq!(tree[0].name, "Layer");
        assert_eq!(tree[0].children.len(), 2, "Layer has 2 children");
        assert_eq!(tree[0].children[0].name, "R1");
        assert_eq!(tree[0].children[1].name, "R2");
    }

    #[test]
    fn test_sequencer_reorder_updates_shape_order() {
        let mut scene = Scene::new();
        let a = scene
            .add_node(
                "A",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();
        let b = scene
            .add_node(
                "B",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(0, 255, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();
        let c = scene
            .add_node(
                "C",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(0, 0, 255, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        assert_eq!(scene.sequencer_shape_ids(), vec![a, b, c]);
        scene.reorder_sequencer_shape(c, 0).unwrap();
        assert_eq!(scene.sequencer_shape_ids(), vec![c, a, b]);
        assert_eq!(
            scene
                .get_stitch_plan_rows()
                .iter()
                .map(|row| row.block_id)
                .collect::<Vec<NodeId>>(),
            vec![c, a, b]
        );
    }

    #[test]
    fn test_object_routing_overrides_roundtrip() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Path",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.4,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let overrides = ObjectRoutingOverrides {
            allow_reverse: Some(false),
            entry_exit_mode: Some(EntryExitMode::PreserveShapeStart),
            tie_mode: Some(TieMode::ColorChange),
        };
        scene
            .set_object_routing_overrides(id, overrides.clone())
            .unwrap();
        assert_eq!(scene.object_routing_overrides(id), overrides);
    }

    #[test]
    fn test_stitch_plan_rows_include_visibility_and_locked_state() {
        let mut scene = Scene::new();
        let hidden_layer = scene
            .add_node(
                "Hidden",
                NodeKind::Layer {
                    name: "Hidden".to_string(),
                    visible: false,
                    locked: true,
                },
                None,
            )
            .unwrap();
        let shape = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                Some(hidden_layer),
            )
            .unwrap();

        let rows = scene.get_stitch_plan_rows();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].node_id, shape);
        assert!(!rows[0].visible);
        assert!(rows[0].locked);
    }

    #[test]
    fn test_hybrid_state_tracks_shape_lifecycle() {
        let mut scene = Scene::new();
        let shape = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        assert!(scene.embroidery_object(shape).is_some());
        assert!(scene.stitch_block(shape).is_some());
        assert_eq!(scene.sequence_track().ordered_block_ids, vec![shape]);

        scene.remove_node(shape).unwrap();
        assert!(scene.embroidery_object(shape).is_none());
        assert!(scene.stitch_block(shape).is_none());
        assert!(scene.sequence_track().ordered_block_ids.is_empty());
    }

    #[test]
    fn test_hybrid_state_tracks_sequencer_and_overrides() {
        let mut scene = Scene::new();
        let a = scene
            .add_node(
                "A",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();
        let b = scene
            .add_node(
                "B",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: Some(Color::new(0, 255, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        scene.reorder_sequencer_shape(b, 0).unwrap();
        assert_eq!(scene.sequence_track().ordered_block_ids, vec![b, a]);

        let overrides = ObjectRoutingOverrides {
            allow_reverse: Some(false),
            entry_exit_mode: Some(EntryExitMode::PreserveShapeStart),
            tie_mode: Some(TieMode::ColorChange),
        };
        scene
            .set_object_routing_overrides(b, overrides.clone())
            .unwrap();
        assert_eq!(
            scene
                .stitch_block(b)
                .map(|block| block.routing_overrides.clone()),
            Some(overrides)
        );
    }
}
