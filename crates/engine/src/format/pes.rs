//! PES (Brother Embroidery System) file format exporter.
//!
//! PES v1 is the simplest and most compatible version. It contains:
//! - PES header with version string and PEC offset
//! - CEmbOne + CSewSeg blocks with stitch data
//! - PEC block with machine-readable stitch commands
//!
//! Reference: <https://edutechwiki.unige.ch/en/Embroidery_format_PES>

use super::ExportDesign;

/// Export a design to PES v1 format.
///
/// Returns the binary PES file data.
pub fn export_pes(design: &ExportDesign) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();

    // We'll write a placeholder for the PEC offset and come back to fill it in
    // PES Header: "#PES0001" (8 bytes) + PEC offset (4 bytes LE)
    output.extend_from_slice(b"#PES0001");

    let pec_offset_pos = output.len();
    output.extend_from_slice(&[0u8; 4]); // Placeholder for PEC offset

    // PES v1 body: hoop size + use existing design area + segment block count
    // Hoop size: 0 = 100x100mm, 1 = 130x180mm
    write_u16_le(&mut output, 1); // 130x180mm hoop
    write_u16_le(&mut output, 1); // Use existing design area

    // Number of CSewSeg blocks (we write 1)
    write_u16_le(&mut output, 1);

    // CEmbOne block
    write_cembone(&mut output, design);

    // CSewSeg block
    write_csewseg(&mut output, design);

    // Now write the PEC block and record its offset
    let pec_offset = output.len() as u32;

    // Go back and fill in the PEC offset
    output[pec_offset_pos] = (pec_offset & 0xFF) as u8;
    output[pec_offset_pos + 1] = ((pec_offset >> 8) & 0xFF) as u8;
    output[pec_offset_pos + 2] = ((pec_offset >> 16) & 0xFF) as u8;
    output[pec_offset_pos + 3] = ((pec_offset >> 24) & 0xFF) as u8;

    // Write PEC block
    let pec_block = super::pec::write_pec_block(design);
    output.extend_from_slice(&pec_block);

    Ok(output)
}

/// Write the CEmbOne block (transformation data).
fn write_cembone(out: &mut Vec<u8>, design: &ExportDesign) {
    let (min_x, min_y, max_x, max_y) = design.extents();

    // Convert to 0.1mm units (PES s16 coordinate space)
    let left = (min_x * 10.0).round() as i16;
    let top = (min_y * 10.0).round() as i16;
    let right = (max_x * 10.0).round() as i16;
    let bottom = (max_y * 10.0).round() as i16;

    // Extents (8 x s16 = 16 bytes, written twice per spec)
    write_s16_le(out, left);
    write_s16_le(out, top);
    write_s16_le(out, right);
    write_s16_le(out, bottom);
    write_s16_le(out, left);
    write_s16_le(out, top);
    write_s16_le(out, right);
    write_s16_le(out, bottom);

    // Affine transform (identity): 6 x f32 = 24 bytes
    write_f32_le(out, 1.0); // scale X
    write_f32_le(out, 0.0); // skew Y
    write_f32_le(out, 0.0); // skew X
    write_f32_le(out, 1.0); // scale Y
    write_f32_le(out, 0.0); // translate X
    write_f32_le(out, 0.0); // translate Y
}

/// Write the CSewSeg block (stitch segment data).
fn write_csewseg(out: &mut Vec<u8>, design: &ExportDesign) {
    let unit_stitches = design.stitches_in_units();

    // Segment block: we write all stitches as a single segment
    // Stitch type: 0 = normal, 1 = jump, 2 = trim
    // Color list count
    let num_colors = (design.color_change_count() + 1).max(1) as u16;
    write_u16_le(out, num_colors);

    // For each color, write color index
    for (i, color) in design.colors.iter().enumerate() {
        write_u16_le(out, i as u16); // Block index
        let pec_idx = super::pec::nearest_pec_color(color.r, color.g, color.b);
        write_u16_le(out, pec_idx as u16);
    }

    // If no colors, write a default
    if design.colors.is_empty() {
        write_u16_le(out, 0);
        write_u16_le(out, 20); // Black
    }

    // Stitch count
    write_u16_le(out, unit_stitches.len() as u16);

    // Write each stitch coordinate (s16 LE pairs)
    for (x, y, _) in &unit_stitches {
        write_s16_le(out, *x as i16);
        write_s16_le(out, *y as i16);
    }
}

fn write_u16_le(out: &mut Vec<u8>, val: u16) {
    out.push((val & 0xFF) as u8);
    out.push(((val >> 8) & 0xFF) as u8);
}

fn write_s16_le(out: &mut Vec<u8>, val: i16) {
    write_u16_le(out, val as u16);
}

fn write_f32_le(out: &mut Vec<u8>, val: f32) {
    out.extend_from_slice(&val.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::super::{ExportStitch, ExportStitchType};
    use super::*;
    use crate::Color;

    fn simple_design() -> ExportDesign {
        ExportDesign {
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
                ExportStitch {
                    x: 2.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 2.0,
                    y: 1.0,
                    stitch_type: ExportStitchType::Normal,
                },
            ],
            colors: vec![Color::new(255, 0, 0, 255)],
        }
    }

    #[test]
    fn test_pes_header_magic() {
        let design = simple_design();
        let data = export_pes(&design).unwrap();
        assert_eq!(&data[..8], b"#PES0001");
    }

    #[test]
    fn test_pes_pec_offset_valid() {
        let design = simple_design();
        let data = export_pes(&design).unwrap();

        // Read PEC offset (bytes 8-11, little-endian u32)
        let offset = data[8] as u32
            | (data[9] as u32) << 8
            | (data[10] as u32) << 16
            | (data[11] as u32) << 24;

        // PEC offset should point within the file
        assert!(
            (offset as usize) < data.len(),
            "PEC offset {offset} should be within file length {}",
            data.len()
        );

        // At the PEC offset, we should find "LA:" (PEC label start)
        let pec_start = offset as usize;
        assert_eq!(
            &data[pec_start..pec_start + 3],
            b"LA:",
            "PEC block should start with LA:"
        );
    }

    #[test]
    fn test_pes_not_empty() {
        let design = simple_design();
        let data = export_pes(&design).unwrap();
        assert!(
            data.len() > 12,
            "PES file should have content beyond header"
        );
    }

    #[test]
    fn test_pes_with_color_changes() {
        let design = ExportDesign {
            name: "multi".to_string(),
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
                ExportStitch {
                    x: 1.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::ColorChange,
                },
                ExportStitch {
                    x: 2.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 3.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
            ],
            colors: vec![Color::new(255, 0, 0, 255), Color::new(0, 0, 255, 255)],
        };

        let data = export_pes(&design).unwrap();
        assert_eq!(&data[..8], b"#PES0001");
    }

    #[test]
    fn test_pes_empty_design() {
        let design = ExportDesign {
            name: "empty".to_string(),
            stitches: vec![],
            colors: vec![],
        };

        let data = export_pes(&design).unwrap();
        assert_eq!(&data[..8], b"#PES0001");
    }

    #[test]
    fn test_pes_pec_has_end_marker() {
        let design = simple_design();
        let data = export_pes(&design).unwrap();
        // PEC block should end with 0xFF
        assert_eq!(*data.last().unwrap(), 0xFF);
    }
}
