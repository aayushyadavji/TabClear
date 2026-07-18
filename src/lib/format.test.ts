import { describe, it, expect } from "vitest";
import {
  stroopsToXlm,
  xlmToStroops,
  readContractError,
  encodeRequestPayload,
  decodeRequestPayload,
} from "./format";

describe("stroops <-> XLM conversion", () => {
  it("converts whole XLM to stroops", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("100")).toBe(1_000_000_000n);
  });

  it("converts fractional XLM to stroops (7 dp)", () => {
    expect(xlmToStroops("1.5")).toBe(15_000_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
  });

  it("renders stroops back to XLM, trimming trailing zeros", () => {
    expect(stroopsToXlm(10_000_000n)).toBe("1");
    expect(stroopsToXlm(15_000_000n)).toBe("1.5");
    expect(stroopsToXlm(1n)).toBe("0.0000001");
  });

  it("round-trips arbitrary amounts", () => {
    const cases = ["0", "1", "1.5", "250.25", "9999.9999999", "0.0000001"];
    for (const amt of cases) {
      expect(stroopsToXlm(xlmToStroops(amt))).toBe(amt);
    }
  });
});

describe("readContractError", () => {
  it("maps AlreadyPaid (#2)", () => {
    expect(readContractError("Error(Contract, #2)")).toMatch(/already/i);
  });
  it("maps NotFound (#1)", () => {
    expect(readContractError("Error(Contract, #1)")).toMatch(/doesn't exist/i);
  });
  it("maps RequestNotOpen / InvalidAmount (#3)", () => {
    expect(readContractError("Error(Contract, #3)")).toMatch(/can't be paid|settled|cancelled/i);
  });
  it("maps Cancelled (#5)", () => {
    expect(readContractError("Error(Contract, #5)")).toMatch(/cancelled/i);
  });
  it("falls back for unknown errors", () => {
    expect(readContractError("boom")).toMatch(/Contract call failed/);
  });
});

describe("QR request payload", () => {
  it("round-trips encode/decode", () => {
    const raw = encodeRequestPayload("CABC", 7, "12.5", "GMERCHANT");
    const decoded = decodeRequestPayload(raw);
    expect(decoded).toEqual({
      contractId: "CABC",
      id: 7,
      amount: "12.5",
      merchant: "GMERCHANT",
    });
  });

  it("throws on malformed payload", () => {
    expect(() => decodeRequestPayload('{"c":"X"}')).toThrow();
  });
});
