//! DST (Data Stitch Tajima) file format exporter.
//!
//! DST is the most universal embroidery format. Files contain stitch commands
//! with 3-byte ternary-encoded position deltas. Max stitch/jump length: 121 units.
//!
//! Reference: <https://edutechwiki.unige.ch/en/Embroidery_format_DST>

use std::fmt::Write;

use super::{ExportDesign, ExportStitchType};

/// Maximum stitch/jump delta per single DST command (in 0.1mm units).
const MAX_DELTA: i32 = 121;

/// DST header size in bytes — always 512.
const HEADER_SIZE: usize = 512;

/// Export a design to DST format.
///
/// Returns the binary DST file data.
pub fn export_dst(design: &ExportDesign) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();

    // Write header
    write_header(design, &mut output)?;

    // Write stitch body
    write_body(design, &mut output)?;

    Ok(output)
}

/// Write the 512-byte DST header.
fn write_header(design: &ExportDesign, out: &mut Vec<u8>) -> Result<(), String> {
    let mut header = String::with_capacity(HEADER_SIZE);

    // LA: Label (max 16 chars, name max 8 chars)
    let label = if design.name.len() > 16 {
        &design.name[..16]
    } else {
        &design.name
    };
    write!(header, "LA:{:16}\r", label).map_err(|e| e.to_string())?;

    // ST: Stitch count (7 digits)
    let stitch_count = design.stitches.len();
    write!(header, "ST:{:07}\r", stitch_count).map_err(|e| e.to_string())?;

    // CO: Color changes (3 digits)
    let color_changes = design.color_change_count();
    write!(header, "CO:{:03}\r", color_changes).map_err(|e| e.to_string())?;

    // Extents in 0.1mm units
    let (min_x, min_y, max_x, max_y) = design.extents();
    let pos_x = (max_x * 10.0).round() as i32;
    let neg_x = (-min_x * 10.0).round().max(0.0) as i32;
    let pos_y = (max_y * 10.0).round() as i32;
    let neg_y = (-min_y * 10.0).round().max(0.0) as i32;

    write!(header, "+X:{:05}\r", pos_x).map_err(|e| e.to_string())?;
    write!(header, "-X:{:05}\r", neg_x).map_err(|e| e.to_string())?;
    write!(header, "+Y:{:05}\r", pos_y).map_err(|e| e.to_string())?;
    write!(header, "-Y:{:05}\r", neg_y).map_err(|e| e.to_string())?;

    write!(header, "AX:+    0\r").map_err(|e| e.to_string())?;
    write!(header, "AY:+    0\r").map_err(|e| e.to_string())?;
    write!(header, "MX:+    0\r").map_err(|e| e.to_string())?;
    write!(header, "MY:+    0\r").map_err(|e| e.to_string())?;
    write!(header, "PD:******\r").map_err(|e| e.to_string())?;

    // Write header bytes, pad to 512 with 0x20
    let header_bytes = header.as_bytes();
    out.extend_from_slice(header_bytes);

    // Pad to 512 bytes
    let padding = HEADER_SIZE.saturating_sub(header_bytes.len());
    out.extend(std::iter::repeat_n(0x20u8, padding));

    Ok(())
}

/// Write the stitch body as 3-byte ternary-encoded commands.
fn write_body(design: &ExportDesign, out: &mut Vec<u8>) -> Result<(), String> {
    let unit_stitches = design.stitches_in_units();

    let mut prev_x = 0_i32;
    let mut prev_y = 0_i32;

    for (x, y, stype) in &unit_stitches {
        let dx = x - prev_x;
        let dy = y - prev_y;

        match stype {
            ExportStitchType::Normal => {
                encode_move(dx, dy, MoveType::Stitch, out);
            }
            ExportStitchType::Jump => {
                encode_move(dx, dy, MoveType::Jump, out);
            }
            ExportStitchType::Trim => {
                // DST handles trims via multiple small jumps
                // Insert 3 small jump stitches: +1,+1 / -2,-2 / +1,+1
                encode_3byte(1, 1, MoveType::Jump, out);
                encode_3byte(-2, -2, MoveType::Jump, out);
                encode_3byte(1, 1, MoveType::Jump, out);
                // Then do the actual move
                encode_move(dx, dy, MoveType::Jump, out);
            }
            ExportStitchType::ColorChange => {
                encode_move(dx, dy, MoveType::ColorChange, out);
            }
            ExportStitchType::End => {
                out.extend_from_slice(&crate::constants::DST_END_MARKER);
            }
        }

        prev_x = *x;
        prev_y = *y;
    }

    // If we didn't end with an End command, add one
    let needs_end = design
        .stitches
        .last()
        .is_none_or(|s| s.stitch_type != ExportStitchType::End);

    if needs_end {
        out.extend_from_slice(&crate::constants::DST_END_MARKER);
    }

    Ok(())
}

#[derive(Debug, Clone, Copy)]
enum MoveType {
    Stitch,
    Jump,
    ColorChange,
}

/// Encode a move that may need to be split into multiple 3-byte commands
/// if the delta exceeds the maximum of 121 units.
fn encode_move(dx: i32, dy: i32, move_type: MoveType, out: &mut Vec<u8>) {
    let mut remaining_dx = dx;
    let mut remaining_dy = dy;

    // Split large moves into chunks of MAX_DELTA
    while remaining_dx.abs() > MAX_DELTA || remaining_dy.abs() > MAX_DELTA {
        let chunk_dx = remaining_dx.clamp(-MAX_DELTA, MAX_DELTA);
        let chunk_dy = remaining_dy.clamp(-MAX_DELTA, MAX_DELTA);

        // Intermediate moves are always jumps
        encode_3byte(chunk_dx, chunk_dy, MoveType::Jump, out);

        remaining_dx -= chunk_dx;
        remaining_dy -= chunk_dy;
    }

    encode_3byte(remaining_dx, remaining_dy, move_type, out);
}

/// Decompose a value into balanced ternary digits for DST encoding.
///
/// Returns 5 digits [d0, d1, d2, d3, d4] where each is -1, 0, or 1,
/// representing val = d0*1 + d1*3 + d2*9 + d3*27 + d4*81.
fn balanced_ternary(val: i32) -> [i8; 5] {
    let mut digits = [0i8; 5];
    let mut v = val;

    for digit in &mut digits {
        let rem = ((v % 3) + 3) % 3; // Always positive modulo
        if rem == 0 {
            *digit = 0;
            v /= 3;
        } else if rem == 1 {
            *digit = 1;
            v = (v - 1) / 3;
        } else {
            // rem == 2, use -1 and carry
            *digit = -1;
            v = (v + 1) / 3;
        }
    }

    digits
}

/// Encode a single 3-byte DST command.
///
/// DST encoding uses balanced ternary with powers {1, 3, 9, 27, 81}
/// for each axis. Each power has two bits: one for positive, one for negative.
fn encode_3byte(dx: i32, dy: i32, move_type: MoveType, out: &mut Vec<u8>) {
    let mut b0: u8 = 0;
    let mut b1: u8 = 0;
    let mut b2: u8 = 0x03; // Bits 0 and 1 are always set

    // Set control bits based on move type
    match move_type {
        MoveType::Stitch => {} // b2 bits 6,7 = 0,0
        MoveType::Jump => {
            b2 |= 0x80; // bit 7 = 1 (c0=1)
        }
        MoveType::ColorChange => {
            b2 |= 0xC0; // bits 6,7 = 1,1 (c0=1, c1=1)
        }
    }

    // Decompose Y into balanced ternary: [1, 3, 9, 27, 81]
    let yd = balanced_ternary(dy);
    // y±1  -> b0 bits 7(+) / 6(-)
    // y±3  -> b1 bits 7(+) / 6(-)
    // y±9  -> b0 bits 5(+) / 4(-)
    // y±27 -> b1 bits 5(+) / 4(-)
    // y±81 -> b2 bits 5(+) / 4(-)
    if yd[0] > 0 {
        b0 |= 0x80;
    } else if yd[0] < 0 {
        b0 |= 0x40;
    }
    if yd[1] > 0 {
        b1 |= 0x80;
    } else if yd[1] < 0 {
        b1 |= 0x40;
    }
    if yd[2] > 0 {
        b0 |= 0x20;
    } else if yd[2] < 0 {
        b0 |= 0x10;
    }
    if yd[3] > 0 {
        b1 |= 0x20;
    } else if yd[3] < 0 {
        b1 |= 0x10;
    }
    if yd[4] > 0 {
        b2 |= 0x20;
    } else if yd[4] < 0 {
        b2 |= 0x10;
    }

    // Decompose X into balanced ternary: [1, 3, 9, 27, 81]
    let xd = balanced_ternary(dx);
    // x±1  -> b0 bits 2(+) / 3(-)
    // x±3  -> b1 bits 2(+) / 3(-)
    // x±9  -> b0 bits 0(+) / 1(-)
    // x±27 -> b1 bits 0(+) / 1(-)
    // x±81 -> b2 bits 2(+) / 3(-)
    if xd[0] > 0 {
        b0 |= 0x04;
    } else if xd[0] < 0 {
        b0 |= 0x08;
    }
    if xd[1] > 0 {
        b1 |= 0x04;
    } else if xd[1] < 0 {
        b1 |= 0x08;
    }
    if xd[2] > 0 {
        b0 |= 0x01;
    } else if xd[2] < 0 {
        b0 |= 0x02;
    }
    if xd[3] > 0 {
        b1 |= 0x01;
    } else if xd[3] < 0 {
        b1 |= 0x02;
    }
    if xd[4] > 0 {
        b2 |= 0x04;
    } else if xd[4] < 0 {
        b2 |= 0x08;
    }

    out.push(b0);
    out.push(b1);
    out.push(b2);
}

/// Decode a 3-byte DST command back to dx, dy and move type (for testing).
#[cfg(test)]
fn decode_3byte(b0: u8, b1: u8, b2: u8) -> (i32, i32, MoveType) {
    let mut dx: i32 = 0;
    let mut dy: i32 = 0;

    // Decode Y
    if b0 & 0x80 != 0 {
        dy += 1;
    }
    if b0 & 0x40 != 0 {
        dy -= 1;
    }
    if b0 & 0x20 != 0 {
        dy += 9;
    }
    if b0 & 0x10 != 0 {
        dy -= 9;
    }
    if b1 & 0x80 != 0 {
        dy += 3;
    }
    if b1 & 0x40 != 0 {
        dy -= 3;
    }
    if b1 & 0x20 != 0 {
        dy += 27;
    }
    if b1 & 0x10 != 0 {
        dy -= 27;
    }
    if b2 & 0x20 != 0 {
        dy += 81;
    }
    if b2 & 0x10 != 0 {
        dy -= 81;
    }

    // Decode X
    if b0 & 0x04 != 0 {
        dx += 1;
    }
    if b0 & 0x08 != 0 {
        dx -= 1;
    }
    if b0 & 0x01 != 0 {
        dx += 9;
    }
    if b0 & 0x02 != 0 {
        dx -= 9;
    }
    if b1 & 0x04 != 0 {
        dx += 3;
    }
    if b1 & 0x08 != 0 {
        dx -= 3;
    }
    if b1 & 0x01 != 0 {
        dx += 27;
    }
    if b1 & 0x02 != 0 {
        dx -= 27;
    }
    if b2 & 0x04 != 0 {
        dx += 81;
    }
    if b2 & 0x08 != 0 {
        dx -= 81;
    }

    let move_type = match (b2 & 0x80 != 0, b2 & 0x40 != 0) {
        (false, false) => MoveType::Stitch,
        (true, false) => MoveType::Jump,
        (true, true) | (false, true) => MoveType::ColorChange,
    };

    (dx, dy, move_type)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Color;

    fn simple_design() -> ExportDesign {
        use super::super::ExportStitch;
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
    fn test_dst_header_size() {
        let design = simple_design();
        let data = export_dst(&design).unwrap();
        assert!(data.len() >= HEADER_SIZE);
        // Header should be exactly 512 bytes
        assert_eq!(&data[..2], b"LA");
    }

    #[test]
    fn test_dst_header_label() {
        let design = simple_design();
        let data = export_dst(&design).unwrap();
        let header = String::from_utf8_lossy(&data[..HEADER_SIZE]);
        assert!(header.starts_with("LA:test"));
    }

    #[test]
    fn test_dst_body_starts_after_header() {
        let design = simple_design();
        let data = export_dst(&design).unwrap();
        // Body should start at byte 512
        assert!(data.len() > HEADER_SIZE);
        // Body should be multiples of 3 bytes (plus end marker)
        let body_len = data.len() - HEADER_SIZE;
        assert_eq!(
            body_len % 3,
            0,
            "Body length {} is not a multiple of 3",
            body_len
        );
    }

    #[test]
    fn test_ternary_encode_decode_zero() {
        let mut buf = Vec::new();
        encode_3byte(0, 0, MoveType::Stitch, &mut buf);
        let (dx, dy, _) = decode_3byte(buf[0], buf[1], buf[2]);
        assert_eq!(dx, 0);
        assert_eq!(dy, 0);
    }

    #[test]
    fn test_ternary_encode_decode_positive() {
        for val in [1, 3, 9, 27, 81, 121, 42, 100] {
            let mut buf = Vec::new();
            encode_3byte(val, val, MoveType::Stitch, &mut buf);
            let (dx, dy, _) = decode_3byte(buf[0], buf[1], buf[2]);
            assert_eq!(dx, val, "X encode/decode mismatch for {val}");
            assert_eq!(dy, val, "Y encode/decode mismatch for {val}");
        }
    }

    #[test]
    fn test_ternary_encode_decode_negative() {
        for val in [-1, -3, -9, -27, -81, -121, -42, -100] {
            let mut buf = Vec::new();
            encode_3byte(val, val, MoveType::Stitch, &mut buf);
            let (dx, dy, _) = decode_3byte(buf[0], buf[1], buf[2]);
            assert_eq!(dx, val, "X encode/decode mismatch for {val}");
            assert_eq!(dy, val, "Y encode/decode mismatch for {val}");
        }
    }

    #[test]
    fn test_ternary_encode_decode_mixed() {
        let mut buf = Vec::new();
        encode_3byte(50, -30, MoveType::Jump, &mut buf);
        let (dx, dy, _) = decode_3byte(buf[0], buf[1], buf[2]);
        assert_eq!(dx, 50);
        assert_eq!(dy, -30);
    }

    #[test]
    fn test_large_move_splitting() {
        let mut buf = Vec::new();
        encode_move(200, 150, MoveType::Stitch, &mut buf);
        // Should produce multiple 3-byte commands
        assert!(buf.len() > 3, "Large move should produce multiple commands");
        assert_eq!(buf.len() % 3, 0);

        // Verify total displacement
        let mut total_dx = 0;
        let mut total_dy = 0;
        for chunk in buf.chunks(3) {
            let (dx, dy, _) = decode_3byte(chunk[0], chunk[1], chunk[2]);
            total_dx += dx;
            total_dy += dy;
        }
        assert_eq!(total_dx, 200);
        assert_eq!(total_dy, 150);
    }

    #[test]
    fn test_dst_end_marker() {
        let design = simple_design();
        let data = export_dst(&design).unwrap();
        let body = &data[HEADER_SIZE..];
        // Last 3 bytes should be end marker
        let end = &body[body.len() - 3..];
        assert_eq!(end, &[0x00, 0x00, 0xF3]);
    }

    #[test]
    fn test_dst_color_change() {
        use super::super::ExportStitch;
        let design = ExportDesign {
            name: "colors".to_string(),
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
            ],
            colors: vec![Color::new(255, 0, 0, 255), Color::new(0, 0, 255, 255)],
        };

        let data = export_dst(&design).unwrap();
        assert!(data.len() > HEADER_SIZE);
    }

    #[test]
    fn test_dst_empty_design() {
        let design = ExportDesign {
            name: "empty".to_string(),
            stitches: vec![],
            colors: vec![],
        };

        let data = export_dst(&design).unwrap();
        // Should still have header + end marker
        assert!(data.len() >= HEADER_SIZE + 3);
    }
}
