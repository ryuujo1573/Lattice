# Tailwind CSS (v4)

This project uses Tailwind CSS v4 for styling.

## Configuration

Tailwind v4 uses a CSS-first configuration approach. Configuration is typically handled directly in the CSS entry point (e.g., [app.css](file:///Users/bytedance/opensource/Lattice/packages/prism/src/app.css)) using `@import "tailwindcss";` and `@theme`.

## Best Practices

- Use utility classes for styling components.
- Avoid custom CSS unless necessary.
- Leverage the `@theme` block in CSS for design tokens (colors, fonts, etc.).
- Use `@plugin` for official and third-party plugins.

## References

- [Official Documentation](https://tailwindcss.com/docs)
