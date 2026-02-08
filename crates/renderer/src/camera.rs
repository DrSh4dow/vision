//! 2D camera for infinite canvas with pan and zoom.
//!
//! The camera maps from world space (design coordinates in mm) to
//! normalized device coordinates (NDC) via a view-projection matrix.

/// A 2D camera with position, zoom, and viewport dimensions.
#[derive(Debug, Clone, Copy)]
pub struct Camera2D {
    /// Camera center position in world space.
    pub x: f32,
    /// Camera center position in world space.
    pub y: f32,
    /// Zoom level (1.0 = 100%, 2.0 = 200%, etc.).
    pub zoom: f32,
    /// Viewport width in pixels.
    pub viewport_width: f32,
    /// Viewport height in pixels.
    pub viewport_height: f32,
}

/// Uniform data sent to the GPU for the camera transform.
#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct CameraUniform {
    /// Column-major 4x4 view-projection matrix.
    pub view_proj: [f32; 16],
}

impl Camera2D {
    /// Create a new camera centered at origin with 1x zoom.
    pub fn new(viewport_width: f32, viewport_height: f32) -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
            viewport_width,
            viewport_height,
        }
    }

    /// Pan the camera by a delta in screen pixels.
    pub fn pan(&mut self, dx: f32, dy: f32) {
        self.x -= dx / self.zoom;
        self.y -= dy / self.zoom;
    }

    /// Zoom towards a screen-space point.
    ///
    /// # Arguments
    /// * `factor` - Multiplicative zoom factor (> 1.0 zooms in, < 1.0 zooms out).
    /// * `screen_x` - Screen x coordinate of the zoom focus point.
    /// * `screen_y` - Screen y coordinate of the zoom focus point.
    pub fn zoom_at(&mut self, factor: f32, screen_x: f32, screen_y: f32) {
        // Convert screen point to world space before zoom
        let world_x = self.screen_to_world_x(screen_x);
        let world_y = self.screen_to_world_y(screen_y);

        // Apply zoom
        let new_zoom = (self.zoom * factor).clamp(MIN_ZOOM, MAX_ZOOM);
        self.zoom = new_zoom;

        // Adjust camera position so the world point stays under the cursor
        let new_world_x = self.screen_to_world_x(screen_x);
        let new_world_y = self.screen_to_world_y(screen_y);
        self.x += world_x - new_world_x;
        self.y += world_y - new_world_y;
    }

    /// Convert a screen-space X coordinate to world space.
    pub fn screen_to_world_x(&self, screen_x: f32) -> f32 {
        (screen_x - self.viewport_width * 0.5) / self.zoom + self.x
    }

    /// Convert a screen-space Y coordinate to world space.
    pub fn screen_to_world_y(&self, screen_y: f32) -> f32 {
        (screen_y - self.viewport_height * 0.5) / self.zoom + self.y
    }

    /// Resize the viewport.
    pub fn set_viewport(&mut self, width: f32, height: f32) {
        self.viewport_width = width;
        self.viewport_height = height;
    }

    /// Compute the view-projection matrix as a column-major `[f32; 16]`.
    ///
    /// This is an orthographic projection that maps world coordinates
    /// to NDC `[-1, 1]` based on the camera's position, zoom, and viewport.
    pub fn view_projection_matrix(&self) -> [f32; 16] {
        let half_w = self.viewport_width * 0.5 / self.zoom;
        let half_h = self.viewport_height * 0.5 / self.zoom;

        let left = self.x - half_w;
        let right = self.x + half_w;
        let bottom = self.y + half_h; // Y-down screen space
        let top = self.y - half_h;

        // Orthographic projection matrix (column-major)
        let sx = 2.0 / (right - left);
        let sy = 2.0 / (top - bottom);
        let tx = -(right + left) / (right - left);
        let ty = -(top + bottom) / (top - bottom);

        #[rustfmt::skip]
        let m = [
            sx,  0.0, 0.0, 0.0,
            0.0, sy,  0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            tx,  ty,  0.0, 1.0,
        ];
        m
    }

    /// Build the `CameraUniform` for uploading to the GPU.
    pub fn to_uniform(&self) -> CameraUniform {
        CameraUniform {
            view_proj: self.view_projection_matrix(),
        }
    }
}

/// Minimum allowed zoom level.
const MIN_ZOOM: f32 = 0.01;
/// Maximum allowed zoom level.
const MAX_ZOOM: f32 = 256.0;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camera_new() {
        let cam = Camera2D::new(800.0, 600.0);
        assert_eq!(cam.x, 0.0);
        assert_eq!(cam.y, 0.0);
        assert_eq!(cam.zoom, 1.0);
        assert_eq!(cam.viewport_width, 800.0);
        assert_eq!(cam.viewport_height, 600.0);
    }

    #[test]
    fn test_camera_pan() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.pan(100.0, 50.0);
        assert!((cam.x - (-100.0)).abs() < 1e-5);
        assert!((cam.y - (-50.0)).abs() < 1e-5);
    }

    #[test]
    fn test_camera_pan_with_zoom() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.zoom = 2.0;
        cam.pan(100.0, 50.0);
        // At 2x zoom, 100px screen = 50 world units
        assert!((cam.x - (-50.0)).abs() < 1e-5);
        assert!((cam.y - (-25.0)).abs() < 1e-5);
    }

    #[test]
    fn test_camera_zoom_at_center() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.zoom_at(2.0, 400.0, 300.0);
        assert!((cam.zoom - 2.0).abs() < 1e-5);
        // Zooming at the center should not change position
        assert!(cam.x.abs() < 1e-3);
        assert!(cam.y.abs() < 1e-3);
    }

    #[test]
    fn test_camera_zoom_clamp_min() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.zoom_at(0.001, 400.0, 300.0);
        assert!(cam.zoom >= MIN_ZOOM);
    }

    #[test]
    fn test_camera_zoom_clamp_max() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.zoom = 200.0;
        cam.zoom_at(100.0, 400.0, 300.0);
        assert!(cam.zoom <= MAX_ZOOM);
    }

    #[test]
    fn test_screen_to_world_at_origin() {
        let cam = Camera2D::new(800.0, 600.0);
        // Center of screen should map to camera position (0, 0)
        let wx = cam.screen_to_world_x(400.0);
        let wy = cam.screen_to_world_y(300.0);
        assert!(wx.abs() < 1e-5);
        assert!(wy.abs() < 1e-5);
    }

    #[test]
    fn test_screen_to_world_offset() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.x = 100.0;
        cam.y = 200.0;
        // Center of screen maps to camera position
        let wx = cam.screen_to_world_x(400.0);
        let wy = cam.screen_to_world_y(300.0);
        assert!((wx - 100.0).abs() < 1e-5);
        assert!((wy - 200.0).abs() < 1e-5);
    }

    #[test]
    fn test_view_projection_matrix_identity_like() {
        let cam = Camera2D::new(800.0, 600.0);
        let m = cam.view_projection_matrix();
        // At zoom 1.0 centered at origin:
        // sx = 2.0 / 800.0 = 0.0025
        // sy = 2.0 / (-600.0) = -0.003333...
        assert!((m[0] - 2.0 / 800.0).abs() < 1e-6);
        // tx and ty should be 0
        assert!(m[12].abs() < 1e-6);
        assert!(m[13].abs() < 1e-6);
    }

    #[test]
    fn test_camera_uniform_pod() {
        // Ensure CameraUniform can be used with bytemuck
        let cam = Camera2D::new(800.0, 600.0);
        let uniform = cam.to_uniform();
        let _bytes: &[u8] = bytemuck::bytes_of(&uniform);
        assert_eq!(_bytes.len(), 64); // 16 floats * 4 bytes
    }

    #[test]
    fn test_set_viewport() {
        let mut cam = Camera2D::new(800.0, 600.0);
        cam.set_viewport(1920.0, 1080.0);
        assert_eq!(cam.viewport_width, 1920.0);
        assert_eq!(cam.viewport_height, 1080.0);
    }
}
