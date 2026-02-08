//! PEC (Programmable Embroidery Control) block writer.
//!
//! PEC is the low-level stitch format embedded within PES files.
//! It contains stitch commands, color info, and a thumbnail.
//! This implementation targets backward-compatible PEC for PES v1.

use super::{ExportDesign, ExportStitchType};

/// The standard 64-color PEC thread palette (Brother default).
/// Index 0 is "Unknown" (not used), indices 1-64 are the standard colors.
pub static PEC_COLORS: [(u8, u8, u8); 65] = [
    (0, 0, 0),       // 0: Unknown/padding
    (14, 31, 124),   // 1: Prussian Blue
    (10, 85, 163),   // 2: Blue
    (48, 135, 119),  // 3: Teal Green
    (75, 107, 175),  // 4: Cornflower Blue
    (237, 23, 31),   // 5: Red
    (209, 92, 0),    // 6: Reddish Brown
    (145, 54, 151),  // 7: Magenta
    (228, 154, 203), // 8: Light Lilac
    (145, 95, 172),  // 9: Lilac
    (158, 214, 125), // 10: Mint Green
    (232, 169, 0),   // 11: Deep Gold
    (254, 186, 53),  // 12: Orange
    (255, 255, 0),   // 13: Yellow
    (112, 188, 31),  // 14: Lime Green
    (186, 152, 0),   // 15: Brass
    (168, 168, 168), // 16: Silver
    (125, 111, 0),   // 17: Russet Brown
    (255, 255, 179), // 18: Cream Brown
    (79, 85, 86),    // 19: Pewter
    (0, 0, 0),       // 20: Black
    (11, 61, 145),   // 21: Ultramarine
    (119, 1, 118),   // 22: Royal Purple
    (41, 49, 51),    // 23: Dark Gray
    (42, 19, 1),     // 24: Dark Brown
    (246, 74, 138),  // 25: Deep Rose
    (178, 118, 36),  // 26: Light Brown
    (252, 187, 197), // 27: Salmon Pink
    (254, 55, 15),   // 28: Vermillion
    (240, 240, 240), // 29: White
    (106, 28, 138),  // 30: Violet
    (168, 221, 196), // 31: Seacrest
    (37, 132, 187),  // 32: Sky Blue
    (254, 179, 67),  // 33: Pumpkin
    (255, 243, 107), // 34: Cream Yellow
    (208, 166, 96),  // 35: Khaki
    (209, 84, 0),    // 36: Clay Brown
    (102, 186, 73),  // 37: Leaf Green
    (19, 74, 70),    // 38: Peacock Blue
    (135, 135, 135), // 39: Gray
    (216, 204, 198), // 40: Warm Gray
    (67, 86, 7),     // 41: Dark Olive
    (253, 217, 222), // 42: Flesh Pink
    (249, 147, 188), // 43: Pink
    (0, 56, 34),     // 44: Deep Green
    (178, 175, 212), // 45: Lavender
    (104, 106, 176), // 46: Wisteria Blue
    (239, 227, 185), // 47: Beige
    (247, 56, 102),  // 48: Carmine
    (181, 76, 100),  // 49: Amber Red
    (19, 43, 26),    // 50: Olive Green
    (199, 1, 86),    // 51: Dark Fuschia
    (254, 158, 50),  // 52: Tangerine
    (168, 222, 235), // 53: Light Blue
    (0, 103, 62),    // 54: Emerald Green
    (78, 41, 144),   // 55: Purple
    (47, 126, 32),   // 56: Moss Green
    (255, 204, 204), // 57: Flesh Pink (alt)
    (255, 217, 17),  // 58: Harvest Gold
    (9, 91, 166),    // 59: Electric Blue
    (240, 249, 112), // 60: Lemon Yellow
    (227, 243, 91),  // 61: Fresh Green
    (255, 153, 0),   // 62: Orange (alt)
    (255, 240, 141), // 63: Cream Yellow (alt)
    (255, 200, 200), // 64: Applique
];

/// Find the nearest PEC palette index for a given RGB color.
pub fn nearest_pec_color(r: u8, g: u8, b: u8) -> u8 {
    let r = r as i32;
    let g = g as i32;
    let b = b as i32;

    let mut best_idx = 1_u8;
    let mut best_dist = i32::MAX;

    for i in 1..=64 {
        let (pr, pg, pb) = PEC_COLORS[i as usize];
        let dr = r - pr as i32;
        let dg = g - pg as i32;
        let db = b - pb as i32;
        let dist = dr * dr + dg * dg + db * db;

        if dist < best_dist {
            best_dist = dist;
            best_idx = i;
        }
    }

    best_idx
}

/// Write the PEC block for a design.
///
/// Returns the PEC block bytes.
pub fn write_pec_block(design: &ExportDesign) -> Vec<u8> {
    let mut pec = Vec::new();

    // PEC label: "LA:" + 16-char name padded with spaces + \r
    let label = format!(
        "{:<16}",
        if design.name.len() > 16 {
            &design.name[..16]
        } else {
            &design.name
        }
    );
    pec.extend_from_slice(b"LA:");
    pec.extend_from_slice(label.as_bytes());
    pec.push(0x0D); // \r

    // 12 bytes of padding
    pec.extend_from_slice(&[0x20; 12]);

    // Color count = number of color changes + 1 (for the first color)
    let num_colors = (design.color_change_count() + 1).min(255) as u8;
    pec.push(num_colors.saturating_sub(1)); // PEC stores (num_colors - 1)

    // Color index list — map each design color to nearest PEC palette index
    for color in &design.colors {
        pec.push(nearest_pec_color(color.r, color.g, color.b));
    }
    // If we have fewer colors than changes + 1, pad with color 20 (black)
    let needed = num_colors as usize;
    let padding_count = needed.saturating_sub(design.colors.len());
    pec.extend(std::iter::repeat_n(20u8, padding_count));

    // Pad to fixed color list size (always write at least to fill expected area)
    let color_list_size = 463; // Standard PEC header offset before thumbnail
    let current_size = pec.len();
    if current_size < color_list_size {
        pec.extend(std::iter::repeat_n(0x20u8, color_list_size - current_size));
    }

    // Thumbnail (blank — 6 rows x 38 bytes = 228 bytes of zeros)
    // Actually we skip thumbnail for simplicity
    // The thumbnail section is 512 bytes starting from a specific offset
    // For PES v1, we'll keep it minimal

    // Stitch data
    let stitch_data = encode_pec_stitches(design);
    // Write stitch data length (2 bytes LE, only low 12 bits used)
    // Actually PEC uses a graphics offset, not length — for simplicity we just append
    pec.extend_from_slice(&stitch_data);

    pec
}

/// Encode design stitches into PEC stitch format.
fn encode_pec_stitches(design: &ExportDesign) -> Vec<u8> {
    let mut data = Vec::new();

    let unit_stitches = design.stitches_in_units();

    let mut prev_x = 0_i32;
    let mut prev_y = 0_i32;

    for (x, y, stype) in &unit_stitches {
        let dx = x - prev_x;
        let dy = y - prev_y;

        match stype {
            ExportStitchType::Normal => {
                encode_pec_stitch(dx, dy, false, &mut data);
            }
            ExportStitchType::Jump | ExportStitchType::Trim => {
                encode_pec_stitch(dx, dy, true, &mut data);
            }
            ExportStitchType::ColorChange => {
                // PEC color change: 0xFE 0xB0 (+ optional 0x01 for color index)
                data.push(0xFE);
                data.push(0xB0);
                // Then encode the move
                if dx != 0 || dy != 0 {
                    encode_pec_stitch(dx, dy, false, &mut data);
                }
            }
            ExportStitchType::End => {
                data.push(0xFF);
            }
        }

        prev_x = *x;
        prev_y = *y;
    }

    // End marker
    if design
        .stitches
        .last()
        .is_none_or(|s| s.stitch_type != ExportStitchType::End)
    {
        data.push(0xFF);
    }

    data
}

/// Encode a single PEC stitch (1 or 2 bytes per axis).
///
/// PEC uses variable-length encoding:
/// - Small deltas (-63..+63): 1 byte per axis (7-bit signed)
/// - Large deltas (-2048..+2047): 2 bytes per axis (12-bit signed with high bit flag)
fn encode_pec_stitch(dx: i32, dy: i32, is_jump: bool, out: &mut Vec<u8>) {
    encode_pec_axis(dx, is_jump, out);
    encode_pec_axis(dy, is_jump, out);
}

fn encode_pec_axis(val: i32, is_jump: bool, out: &mut Vec<u8>) {
    if val.abs() < 64 && !is_jump {
        // Single byte: 7-bit value
        if val < 0 {
            out.push((val + 128) as u8);
        } else {
            out.push(val as u8);
        }
    } else {
        // Two bytes: 12-bit signed with flag
        let val = val.clamp(-2048, 2047);
        let unsigned_val = if val < 0 {
            (val + 4096) as u16
        } else {
            val as u16
        };

        let mut high = ((unsigned_val >> 8) & 0x0F) as u8;
        high |= 0x80; // Set high bit to indicate 2-byte encoding

        if is_jump {
            high |= 0x10; // Set jump bit
        }

        let low = (unsigned_val & 0xFF) as u8;

        out.push(high);
        out.push(low);
    }
}

#[cfg(test)]
mod tests {
    use super::super::ExportStitch;
    use super::*;
    use crate::Color;

    #[test]
    fn test_nearest_pec_color_black() {
        let idx = nearest_pec_color(0, 0, 0);
        assert_eq!(idx, 20); // Black in PEC palette
    }

    #[test]
    fn test_nearest_pec_color_white() {
        let idx = nearest_pec_color(255, 255, 255);
        assert_eq!(idx, 29); // White in PEC palette
    }

    #[test]
    fn test_nearest_pec_color_red() {
        let idx = nearest_pec_color(255, 0, 0);
        assert_eq!(idx, 5); // Red in PEC palette
    }

    #[test]
    fn test_pec_block_not_empty() {
        let design = ExportDesign {
            name: "test".to_string(),
            stitches: vec![
                ExportStitch {
                    x: 0.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 1.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
            ],
            colors: vec![Color::new(255, 0, 0, 255)],
        };

        let pec = write_pec_block(&design);
        assert!(!pec.is_empty());
        // Should start with "LA:"
        assert_eq!(&pec[..3], b"LA:");
    }

    #[test]
    fn test_pec_stitch_encoding_small() {
        let mut data = Vec::new();
        encode_pec_stitch(5, -3, false, &mut data);
        // Small values should produce 2 bytes (1 per axis)
        assert_eq!(data.len(), 2);
    }

    #[test]
    fn test_pec_stitch_encoding_large() {
        let mut data = Vec::new();
        encode_pec_stitch(500, -200, false, &mut data);
        // Large values should produce 4 bytes (2 per axis)
        assert_eq!(data.len(), 4);
    }

    #[test]
    fn test_pec_end_marker() {
        let design = ExportDesign {
            name: "test".to_string(),
            stitches: vec![ExportStitch {
                x: 0.0,
                y: 0.0,
                stitch_type: ExportStitchType::Normal,
            }],
            colors: vec![Color::new(0, 0, 0, 255)],
        };

        let pec = write_pec_block(&design);
        // Should end with 0xFF (end marker)
        assert_eq!(*pec.last().unwrap(), 0xFF);
    }
}
