//! Scene graph for managing embroidery design objects.
//!
//! The scene graph is a tree of `Node`s. Each node has a local transform
//! (position, rotation, scale), a kind (Layer, Group, or Shape), and
//! zero or more children. Layers are named top-level groups.

use std::collections::HashMap;

use crate::Color;
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
}

impl Scene {
    /// Create a new empty scene.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            root_children: Vec::new(),
            next_id: 1,
        }
    }

    /// Allocate a new unique `NodeId`.
    fn alloc_id(&mut self) -> NodeId {
        let id = NodeId(self.next_id);
        self.next_id += 1;
        id
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

        if let Some(pid) = parent {
            // Safe: we validated existence above
            self.nodes.get_mut(&pid).unwrap().children.push(id);
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
            .ok_or_else(|| format!("Node {:?} already removed", id))
    }

    /// Get an immutable reference to a node.
    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    /// Get a mutable reference to a node.
    pub fn get_node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
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
        let old_parent = self.nodes.get(&id).unwrap().parent;
        if let Some(opid) = old_parent {
            if let Some(old_parent_node) = self.nodes.get_mut(&opid) {
                old_parent_node.children.retain(|c| *c != id);
            }
        } else {
            self.root_children.retain(|c| *c != id);
        }

        // Add to new parent
        if let Some(npid) = new_parent {
            let parent_node = self.nodes.get_mut(&npid).unwrap();
            let idx = index.unwrap_or(parent_node.children.len());
            let idx = idx.min(parent_node.children.len());
            parent_node.children.insert(idx, id);
        } else {
            let idx = index.unwrap_or(self.root_children.len());
            let idx = idx.min(self.root_children.len());
            self.root_children.insert(idx, id);
        }

        // Update the node's parent reference
        self.nodes.get_mut(&id).unwrap().parent = new_parent;

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
            &mut self.nodes.get_mut(&pid).unwrap().children
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
                },
                Some(layer),
            )
            .unwrap();

        assert_eq!(scene.node_count(), 3);
        assert_eq!(scene.get_node(layer).unwrap().children.len(), 2);
    }
}
