# Ennvo - Ultra-Fast Android Optimization Guidelines

See [prompt.md](./prompt.md) for the full architectural specification.

### Quick Summary
- **Target:** Android Low-End Devices (1GB/2GB RAM support).
- **Speed:** Instant click response (<16ms 60fps frame rate).
- **Optimization:** Code-splitting (`React.lazy`), GPU hardware acceleration, image lazy-loading, memory cleanup on unmount, `React.memo` component memoization.
- **UI:** Preserve exact current UI design & features without any visual compromise.
