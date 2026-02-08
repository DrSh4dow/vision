//! Vertex types for GPU rendering.

/// A vertex with 2D position and RGBA color.
#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex {
    /// Position in world space (x, y).
    pub position: [f32; 2],
    /// Color (r, g, b, a) normalized to [0, 1].
    pub color: [f32; 4],
}

impl Vertex {
    /// Create a new vertex.
    pub fn new(x: f32, y: f32, r: f32, g: f32, b: f32, a: f32) -> Self {
        Self {
            position: [x, y],
            color: [r, g, b, a],
        }
    }

    /// Vertex buffer layout descriptor for wgpu.
    pub fn buffer_layout() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                // position: vec2<f32>
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x2,
                },
                // color: vec4<f32>
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x4,
                },
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertex_size() {
        // 2 floats position + 4 floats color = 6 * 4 = 24 bytes
        assert_eq!(std::mem::size_of::<Vertex>(), 24);
    }

    #[test]
    fn test_vertex_pod() {
        let v = Vertex::new(1.0, 2.0, 0.5, 0.5, 0.5, 1.0);
        let bytes: &[u8] = bytemuck::bytes_of(&v);
        assert_eq!(bytes.len(), 24);
    }

    #[test]
    fn test_vertex_new() {
        let v = Vertex::new(10.0, 20.0, 1.0, 0.0, 0.0, 1.0);
        assert_eq!(v.position, [10.0, 20.0]);
        assert_eq!(v.color, [1.0, 0.0, 0.0, 1.0]);
    }
}
