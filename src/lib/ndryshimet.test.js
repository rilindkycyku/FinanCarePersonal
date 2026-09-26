import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { krahasoVersionet, lexoNdryshimet, ndajZerin, ndryshimetPas, zeriNeHtml } from "./ndryshimet";
import { version as VERSIONI } from "../../package.json";

const MD = `# Historiku i ndryshimeve

Hyrja e skedarit, që nuk i takon asnjë versioni.

## [2.1.0] - 2026-09-25

### Shtuar
- **Grupet.** Rreshti i parë
  vazhdon këtu.
  <br />Paragrafi i dytë.

  - **Ushqim** merr *Bulmet*.
  - **Riparime** ndahet.
- Zëri i dytë me \`kod\`.

### Rregulluar
- Një rregullim.

## [2.0.0] - 2026-01-01

Versioni ku të dhënat mësuan të dalin nga shfletuesi — pa braktisur
premtimin.

### Shtuar
- Sinkronizimi.

## [1.0.0]

- Pa seksion.
`;

describe("lexoNdryshimet", () => {
  const v = lexoNdryshimet(MD);

  it("gjen çdo version me datën, i riu i pari, dhe e shpërfill hyrjen e skedarit", () => {
    expect(v.map((x) => [x.versioni, x.data])).toEqual([
      ["2.1.0", "2026-09-25"],
      ["2.0.0", "2026-01-01"],
      ["1.0.0", null],
    ]);
  });

  it("i bashkon rreshtat e vazhdimit dhe mban listën e brendshme brenda zërit", () => {
    const [shtuar, rregulluar] = v[0].seksionet;
    expect(shtuar.titulli).toBe("Shtuar");
    expect(shtuar.zerat).toHaveLength(2);
    expect(shtuar.zerat[0]).toBe(
      "**Grupet.** Rreshti i parë vazhdon këtu. <br />Paragrafi i dytë.\n- **Ushqim** merr *Bulmet*.\n- **Riparime** ndahet."
    );
    expect(shtuar.zerat[1]).toBe("Zëri i dytë me `kod`.");
    expect(rregulluar.zerat).toEqual(["Një rregullim."]);
  });

  it("paragrafi para seksioneve bëhet hyrja e versionit", () => {
    expect(v[1].hyrja).toEqual(["Versioni ku të dhënat mësuan të dalin nga shfletuesi — pa braktisur premtimin."]);
    expect(v[1].seksionet[0].zerat).toEqual(["Sinkronizimi."]);
  });

  it("një zë pa seksion shkon te hyrja", () => {
    expect(v[2].hyrja).toEqual(["Pa seksion."]);
  });

  it("lexon CHANGELOG.md e vërtetë, dhe versioni i fundit atje është ai i package.json", () => {
    const lista = lexoNdryshimet(readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8"));
    expect(lista.length).toBeGreaterThan(10);
    expect(lista[0].versioni).toBe(VERSIONI);
    lista.forEach((x) => {
      expect(x.hyrja.length + x.seksionet.reduce((s, sek) => s + sek.zerat.length, 0), x.versioni).toBeGreaterThan(0);
    });
  });
});

describe("krahasoVersionet / ndryshimetPas", () => {
  it("krahason numerikisht, jo si tekst", () => {
    expect(krahasoVersionet("2.10.0", "2.9.3")).toBeGreaterThan(0);
    expect(krahasoVersionet("2.9.3", "2.10.0")).toBeLessThan(0);
    expect(krahasoVersionet("2.26.1", "2.26.1")).toBe(0);
    expect(krahasoVersionet("3", "2.99.99")).toBeGreaterThan(0);
  });

  it("kthen vetëm versionet më të reja se ai që po punon", () => {
    const lista = lexoNdryshimet(MD);
    expect(ndryshimetPas(lista, "2.0.0").map((x) => x.versioni)).toEqual(["2.1.0"]);
    expect(ndryshimetPas(lista, "0.9.0")).toHaveLength(3);
    expect(ndryshimetPas(lista, "2.1.0")).toEqual([]);
  });
});

describe("zeriNeHtml", () => {
  it("vizaton theksimet, kodin, lidhjet dhe ndërprerjet", () => {
    expect(zeriNeHtml("**Bold** dhe *pjerrët* me `kod` [semver](https://semver.org/)<br />më tej")).toBe(
      '<strong>Bold</strong> dhe <em>pjerrët</em> me <code>kod</code> <a href="https://semver.org/" target="_blank" rel="noopener noreferrer">semver</a><br>më tej'
    );
  });

  it("listën e brendshme e shkruan me pika", () => {
    expect(zeriNeHtml("Hyrje:\n- **a**\n- b")).toBe("Hyrje:<br>• <strong>a</strong><br>• b");
  });

  it("çdo HTML tjetër del si tekst, dhe lidhjet jo-http nuk bëhen lidhje", () => {
    expect(zeriNeHtml('<img src=x onerror="x()">')).toBe("&lt;img src=x onerror=&quot;x()&quot;&gt;");
    expect(zeriNeHtml("[x](javascript:alert(1))")).toBe("[x](javascript:alert(1))");
  });

  it("nuk e lexon një yll brenda kodit si pjerrët", () => {
    expect(zeriNeHtml("`a*b*c`")).toBe("<code>a*b*c</code>");
  });

  it("e kthen &apos; në apostrof", () => {
    expect(zeriNeHtml("t&apos;i")).toBe("t'i");
  });
});

describe("ndajZerin", () => {
  it("merr fjalinë me të zeza si titull", () => {
    expect(ndajZerin("**Grupet: si Splitwise.** Deri tani çdo gjë.\n- nën")).toEqual({
      titulli: "**Grupet: si Splitwise.**",
      trupi: "Deri tani çdo gjë.\n- nën",
    });
  });

  it("pa të zeza, titulli është fjalia e parë", () => {
    expect(ndajZerin("Linku u ndreq. Tani punon kudo.")).toEqual({ titulli: "Linku u ndreq.", trupi: "Tani punon kudo." });
  });

  it("një zë i shkurtër nuk ka çka të hapë", () => {
    expect(ndajZerin("Një rregullim.")).toEqual({ titulli: "Një rregullim.", trupi: "" });
    expect(ndajZerin("**Vetëm titull.**")).toEqual({ titulli: "**Vetëm titull.**", trupi: "" });
  });
});
