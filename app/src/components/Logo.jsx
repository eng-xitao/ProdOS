/**
 * Logo ProdOS — quadrado com borda contendo a letra "P" e dois
 * pontos, seguido do nome por extenso. Usado no menu lateral,
 * na tela de login e na de redefinição de senha.
 */
export default function Logo({ size = 30, showName = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          border: `2px solid var(--amber)`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: size * 0.53,
            color: "var(--amber)",
            lineHeight: 1,
          }}
        >
          P
        </span>
        <span
          style={{
            position: "absolute",
            bottom: size * 0.2,
            right: size * 0.16,
            width: size * 0.1,
            height: size * 0.1,
            borderRadius: "50%",
            background: "var(--amber)",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: size * 0.2,
            right: size * 0.32,
            width: size * 0.1,
            height: size * 0.1,
            borderRadius: "50%",
            background: "var(--amber)",
          }}
        />
      </span>
      {showName && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.43, letterSpacing: "0.12em", color: "var(--text)" }}>
          PRODOS
        </span>
      )}
    </span>
  );
}
