# runtime

Plugin host runtime.

## Responsibilities

- Plugin registry and lifecycle (load/enable/disable/update)
- Capability gating and permissions
- Worker sandboxing + message transport
- Version compatibility checks

## Security

- Assume plugins are untrusted by default
- Prefer executing plugin code in Web Workers
