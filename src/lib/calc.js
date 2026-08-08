/**
 * A tiny arithmetic evaluator for the amount fields. Money is very often typed as a small sum
 * ("12.50 + 3 * 2" for a receipt with three items), so the amount inputs let the user write the
 * calculation instead of reaching for a separate calculator.
 *
 * This is a hand-written recursive-descent parser rather than `eval` or a maths library: the
 * expression comes straight from the user, and nothing outside `+ - * / ( )` and numbers is ever
 * executed.
 */

// The keypad prints prettier operators than the ones the parser reads, and a phone keyboard set to
// a European locale gives a comma for the decimal point.
const NORMALISE = { "×": "*", x: "*", X: "*", "÷": "/", ":": "/", "−": "-", "–": "-", ",": "." };

/** Characters an expression may contain — used to reject pasted text before it reaches the field. */
export function isValidCalcInput(value) {
  return /^[\d\s+\-*/.,():×÷−–xX]*$/.test(String(value ?? ""));
}

function tokenize(expression) {
  const tokens = [];
  const src = String(expression ?? "");
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[\d.,]/.test(ch)) {
      let raw = "";
      while (i < src.length && /[\d.,]/.test(src[i])) {
        raw += src[i] === "," ? "." : src[i];
        i += 1;
      }
      // "1.2.3" is a typo, not a number — bail out rather than silently reading "1.2".
      if (raw.split(".").length > 2) return null;
      const num = parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      tokens.push({ type: "number", value: num });
      continue;
    }

    const op = NORMALISE[ch] || ch;
    if ("+-*/()".includes(op)) {
      tokens.push({ type: op });
      i += 1;
      continue;
    }

    return null;
  }

  return tokens;
}

/**
 * Evaluates an arithmetic expression and returns its value, or `null` when the expression is
 * incomplete or malformed. `null` is deliberate: the calculator shows a live preview while the
 * user is still typing, and a half-written "12 +" must read as "no result yet", not as an error.
 */
export function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  let failed = false;

  // expression := term (('+' | '-') term)*
  function parseExpression() {
    let left = parseTerm();
    while (!failed && peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[pos].type;
      pos += 1;
      const right = parseTerm();
      if (failed) return 0;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // term := factor (('*' | '/') factor)*
  function parseTerm() {
    let left = parseFactor();
    while (!failed && peek() && (peek().type === "*" || peek().type === "/")) {
      const op = tokens[pos].type;
      pos += 1;
      const right = parseFactor();
      if (failed) return 0;
      if (op === "/" && right === 0) {
        failed = true;
        return 0;
      }
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  // factor := ('+' | '-') factor | number | '(' expression ')'
  function parseFactor() {
    const token = peek();
    if (!token) {
      failed = true;
      return 0;
    }

    if (token.type === "+" || token.type === "-") {
      pos += 1;
      const value = parseFactor();
      return token.type === "-" ? -value : value;
    }

    if (token.type === "number") {
      pos += 1;
      return token.value;
    }

    if (token.type === "(") {
      pos += 1;
      const value = parseExpression();
      if (failed || !peek() || peek().type !== ")") {
        failed = true;
        return 0;
      }
      pos += 1;
      return value;
    }

    failed = true;
    return 0;
  }

  const result = parseExpression();
  if (failed || pos !== tokens.length || !Number.isFinite(result)) return null;

  // Binary floating point turns 0.1 + 0.2 into 0.30000000000000004; amounts never need more than
  // a couple of decimals, so the result is rounded back to something a person would have written.
  return Math.round(result * 1e6) / 1e6;
}

/** The value written back into an amount field: at most two decimals, no trailing zeros. */
export function formatCalcResult(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}
