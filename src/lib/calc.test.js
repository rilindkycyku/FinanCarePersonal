/**
 * Tests for the amount-field calculator.
 *
 * The parser reads text the user typed and hands back a number that becomes real money in the
 * database, so precedence, malformed input and the "still typing" case each get their own check.
 */

import { describe, expect, it } from "vitest";
import { evaluateExpression, formatCalcResult, isValidCalcInput } from "./calc";

describe("evaluateExpression", () => {
  it("reads a plain number", () => {
    expect(evaluateExpression("12.5")).toBe(12.5);
    expect(evaluateExpression("  40  ")).toBe(40);
  });

  it("applies the usual operator precedence", () => {
    expect(evaluateExpression("2 + 3 * 4")).toBe(14);
    expect(evaluateExpression("(2 + 3) * 4")).toBe(20);
    expect(evaluateExpression("100 - 20 / 4")).toBe(95);
  });

  it("handles a receipt-style sum", () => {
    expect(evaluateExpression("12.50 + 3 * 2 + 0.99")).toBe(19.49);
  });

  it("accepts a comma as the decimal separator", () => {
    expect(evaluateExpression("12,50 + 1,25")).toBe(13.75);
  });

  it("accepts the keypad's × and ÷ symbols", () => {
    expect(evaluateExpression("6 × 7")).toBe(42);
    expect(evaluateExpression("84 ÷ 2")).toBe(42);
  });

  it("handles a leading minus and negative results", () => {
    expect(evaluateExpression("-15")).toBe(-15);
    expect(evaluateExpression("10 - 25")).toBe(-15);
    expect(evaluateExpression("5 * -3")).toBe(-15);
  });

  it("rounds away binary floating point noise", () => {
    expect(evaluateExpression("0.1 + 0.2")).toBe(0.3);
  });

  it("returns null while the expression is still incomplete", () => {
    expect(evaluateExpression("12 +")).toBeNull();
    expect(evaluateExpression("(12 + 3")).toBeNull();
    expect(evaluateExpression("")).toBeNull();
    expect(evaluateExpression("   ")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(evaluateExpression("12 3")).toBeNull();
    expect(evaluateExpression("1.2.3")).toBeNull();
    expect(evaluateExpression("12 ** 3")).toBeNull();
    expect(evaluateExpression("alert(1)")).toBeNull();
  });

  it("returns null instead of Infinity when dividing by zero", () => {
    expect(evaluateExpression("10 / 0")).toBeNull();
  });
});

describe("isValidCalcInput", () => {
  it("allows digits, operators and separators", () => {
    expect(isValidCalcInput("12.5 + 3 * (2 - 1)")).toBe(true);
    expect(isValidCalcInput("")).toBe(true);
  });

  it("rejects letters and other pasted text", () => {
    expect(isValidCalcInput("12 euro")).toBe(false);
    expect(isValidCalcInput("12 + 3 !")).toBe(false);
  });
});

describe("formatCalcResult", () => {
  it("keeps at most two decimals and drops trailing zeros", () => {
    expect(formatCalcResult(19.49)).toBe("19.49");
    expect(formatCalcResult(33.333333)).toBe("33.33");
    expect(formatCalcResult(20)).toBe("20");
  });

  it("gives an empty string when there is no result", () => {
    expect(formatCalcResult(null)).toBe("");
    expect(formatCalcResult(Infinity)).toBe("");
  });
});
