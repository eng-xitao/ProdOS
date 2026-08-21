import { useEffect, useState } from "react";

function formatBRL(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Campo de valor em reais com prefixo "R$" e máscara automática:
 * cada dígito digitado empurra os centavos, igual caixa eletrônico
 * (ex: digitar "1234" vira "R$ 12,34"). Por fora se comporta como um
 * input controlado normal: `value` é number, `onChange` recebe number.
 */
export default function CurrencyInput({ value, onChange, style, placeholder, disabled, required, id }) {
  const [display, setDisplay] = useState(formatBRL(value));

  useEffect(() => {
    setDisplay(formatBRL(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "");
    const num = digits ? parseInt(digits, 10) / 100 : 0;
    setDisplay(formatBRL(num));
    onChange(num);
  }

  return (
    <div style={styles.wrap}>
      <span style={styles.prefix}>R$</span>
      <input
        id={id}
        style={{ ...styles.input, ...style }}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

const styles = {
  wrap: { position: "relative", width: "100%" },
  prefix: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 13,
    color: "var(--text-dim)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    paddingLeft: 32,
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 10px 9px 32px",
    color: "var(--text)",
    fontSize: 13,
  },
};
