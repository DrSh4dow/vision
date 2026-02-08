//! GPU renderer implementation (WASM-only).
//!
//! This module contains the wgpu-based renderer that creates a WebGPU/WebGL2
//! surface from an HTML canvas element. It is only compiled for wasm32 targets.

use wasm_bindgen::prelude::*;
use wgpu::util::DeviceExt;

use vision_engine::scene::Scene;

use crate::camera::Camera2D;
use crate::mesh::{self, MeshBatch};
use crate::vertex::Vertex;

/// GPU-accelerated renderer for the Vision embroidery design canvas.
///
/// Manages the wgpu device, queue, surface, and render pipelines.
/// Renders scene graph shapes, grid overlay, and stitch previews.
#[wasm_bindgen]
pub struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    surface_config: wgpu::SurfaceConfiguration,
    fill_pipeline: wgpu::RenderPipeline,
    line_pipeline: wgpu::RenderPipeline,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    camera: Camera2D,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl Renderer {
    /// Create a new renderer from an HTML canvas element.
    ///
    /// This is async because GPU adapter and device requests are async.
    /// Initializes WebGPU with WebGL2 fallback.
    #[wasm_bindgen(js_name = "fromCanvas")]
    pub async fn from_canvas(canvas: web_sys::HtmlCanvasElement) -> Result<Renderer, JsError> {
        let width = canvas.client_width().max(1) as u32;
        let height = canvas.client_height().max(1) as u32;

        // Set canvas resolution to match client size
        canvas.set_width(width);
        canvas.set_height(height);

        // Create wgpu instance with all available backends
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL,
            ..Default::default()
        });

        // Create surface from canvas
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(|e| JsError::new(&format!("Failed to create surface: {e}")))?;

        // Request adapter compatible with our surface
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| JsError::new("No suitable GPU adapter found"))?;

        let info = adapter.get_info();
        log::info!("GPU adapter: {} (backend: {:?})", info.name, info.backend);

        // Request device and queue
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Vision Renderer Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    memory_hints: wgpu::MemoryHints::MemoryUsage,
                    ..Default::default()
                },
                None,
            )
            .await
            .map_err(|e| JsError::new(&format!("Failed to create device: {e}")))?;

        // Configure surface
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(surface_caps.formats[0]);

        let surface_config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width,
            height,
            present_mode: wgpu::PresentMode::AutoVsync,
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &surface_config);

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Vision Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
        });

        // Camera uniform buffer and bind group
        let camera = Camera2D::new(width as f32, height as f32);
        let camera_uniform = camera.to_uniform();

        let camera_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Camera Uniform Buffer"),
            contents: bytemuck::cast_slice(&[camera_uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let camera_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Camera Bind Group Layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });

        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Camera Bind Group"),
            layout: &camera_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: camera_buffer.as_entire_binding(),
            }],
        });

        // Pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Vision Pipeline Layout"),
            bind_group_layouts: &[&camera_bind_group_layout],
            push_constant_ranges: &[],
        });

        // Fill pipeline (triangle list)
        let fill_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Fill Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::buffer_layout()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None, // No culling for 2D
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        // Line pipeline (line list)
        let line_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Line Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::buffer_layout()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::LineList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        log::info!(
            "Vision Renderer initialized: {}x{}, format: {:?}",
            width,
            height,
            surface_format
        );

        Ok(Renderer {
            device,
            queue,
            surface,
            surface_config,
            fill_pipeline,
            line_pipeline,
            camera_buffer,
            camera_bind_group,
            camera,
            width,
            height,
        })
    }

    /// Resize the render surface.
    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.width = width;
        self.height = height;
        self.surface_config.width = width;
        self.surface_config.height = height;
        self.surface.configure(&self.device, &self.surface_config);
        self.camera.set_viewport(width as f32, height as f32);
        log::info!("Renderer resized: {}x{}", width, height);
    }

    /// Pan the camera by screen-space delta pixels.
    pub fn pan(&mut self, dx: f32, dy: f32) {
        self.camera.pan(dx, dy);
    }

    /// Zoom towards a screen-space point.
    ///
    /// # Arguments
    /// * `factor` - Multiplicative zoom factor (> 1.0 zooms in).
    /// * `screen_x` - X coordinate of the zoom focus in screen pixels.
    /// * `screen_y` - Y coordinate of the zoom focus in screen pixels.
    #[wasm_bindgen(js_name = "zoomAt")]
    pub fn zoom_at(&mut self, factor: f32, screen_x: f32, screen_y: f32) {
        self.camera.zoom_at(factor, screen_x, screen_y);
    }

    /// Get the current zoom level.
    pub fn zoom(&self) -> f32 {
        self.camera.zoom
    }

    /// Get the camera X position in world space.
    #[wasm_bindgen(js_name = "cameraX")]
    pub fn camera_x(&self) -> f32 {
        self.camera.x
    }

    /// Get the camera Y position in world space.
    #[wasm_bindgen(js_name = "cameraY")]
    pub fn camera_y(&self) -> f32 {
        self.camera.y
    }

    /// Get renderer width.
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Get renderer height.
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Render a frame with the given scene (passed as JSON).
    ///
    /// This is the main render loop entry point. Call this from
    /// `requestAnimationFrame` in JavaScript.
    #[wasm_bindgen(js_name = "renderScene")]
    pub fn render_scene(&self, scene_json: &str) -> Result<(), JsError> {
        let scene: Scene = serde_json::from_str(scene_json)
            .map_err(|e| JsError::new(&format!("Failed to parse scene: {e}")))?;
        self.render_internal(&scene)
    }

    /// Render a frame with just the grid (no scene data).
    ///
    /// Useful for initial rendering before any design objects exist.
    #[wasm_bindgen(js_name = "renderEmpty")]
    pub fn render_empty(&self) -> Result<(), JsError> {
        let scene = Scene::new();
        self.render_internal(&scene)
    }
}

impl Renderer {
    /// Internal render method shared by all render entry points.
    fn render_internal(&self, scene: &Scene) -> Result<(), JsError> {
        // Update camera uniform
        let camera_uniform = self.camera.to_uniform();
        self.queue.write_buffer(
            &self.camera_buffer,
            0,
            bytemuck::cast_slice(&[camera_uniform]),
        );

        // Get surface texture
        let output = self
            .surface
            .get_current_texture()
            .map_err(|e| JsError::new(&format!("Failed to get surface texture: {e}")))?;

        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        // Build mesh from scene
        let batch = MeshBatch::from_scene(scene);

        // Generate grid
        let grid_verts = mesh::generate_grid_vertices(
            self.camera.x,
            self.camera.y,
            self.camera.viewport_width,
            self.camera.viewport_height,
            self.camera.zoom,
        );

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Main Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.051, // #0d1117 — matches --color-bg
                            g: 0.067,
                            b: 0.090,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);

            // 1. Render grid lines
            if !grid_verts.is_empty() {
                let grid_buffer =
                    self.device
                        .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                            label: Some("Grid Vertex Buffer"),
                            contents: bytemuck::cast_slice(&grid_verts),
                            usage: wgpu::BufferUsages::VERTEX,
                        });

                render_pass.set_pipeline(&self.line_pipeline);
                render_pass.set_vertex_buffer(0, grid_buffer.slice(..));
                render_pass.draw(0..grid_verts.len() as u32, 0..1);
            }

            // 2. Render filled shapes
            if !batch.fill_vertices.is_empty() && !batch.fill_indices.is_empty() {
                let fill_vb = self
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("Fill Vertex Buffer"),
                        contents: bytemuck::cast_slice(&batch.fill_vertices),
                        usage: wgpu::BufferUsages::VERTEX,
                    });
                let fill_ib = self
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("Fill Index Buffer"),
                        contents: bytemuck::cast_slice(&batch.fill_indices),
                        usage: wgpu::BufferUsages::INDEX,
                    });

                render_pass.set_pipeline(&self.fill_pipeline);
                render_pass.set_vertex_buffer(0, fill_vb.slice(..));
                render_pass.set_index_buffer(fill_ib.slice(..), wgpu::IndexFormat::Uint32);
                render_pass.draw_indexed(0..batch.fill_indices.len() as u32, 0, 0..1);
            }

            // 3. Render line strokes
            if !batch.line_vertices.is_empty() {
                let line_vb = self
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("Line Vertex Buffer"),
                        contents: bytemuck::cast_slice(&batch.line_vertices),
                        usage: wgpu::BufferUsages::VERTEX,
                    });

                render_pass.set_pipeline(&self.line_pipeline);
                render_pass.set_vertex_buffer(0, line_vb.slice(..));
                render_pass.draw(0..batch.line_vertices.len() as u32, 0..1);
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        Ok(())
    }
}
