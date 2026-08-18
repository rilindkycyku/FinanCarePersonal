/**
 * The Edge Function, exercised where it can be: it is the one piece of this app that runs on a
 * server, and the server belongs to the user - so it is also the piece nobody can fix remotely
 * once it is deployed. What is checked here is everything except Resend itself, which is replaced
 * by a stub: the health answer the settings card reads, the refusals, and the exact shape of what
 * is handed on.
 *
 * `Deno.serve` is stubbed to capture the handler instead of listening, which is the only thing
 * standing between this file and an ordinary function call.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

let handler;

async function ngarko({ celes = "re_test_key" } = {}) {
  // Note for the next reader: pass "" for "no secret set", never undefined - a default parameter
  // treats an explicit undefined as absent and would hand the function a key after all.
  vi.resetModules();
  vi.stubGlobal("Deno", {
    serve: (fn) => {
      handler = fn;
    },
    env: { get: (emri) => (emri === "RESEND_API_KEY" ? celes : undefined) },
  });
  await import("../../supabase/functions/raporti/index.ts");
  return handler;
}

const emaili = {
  to: "une@shembull.com",
  subject: "Pasqyra e korrikut 2026",
  html: "<p>shifrat</p>",
  text: "shifrat",
  pdf: "JVBERi0xLjM=",
  filename: "pasqyra.pdf",
};

const kerkesa = (trupi, method = "POST") =>
  new Request("https://projekti.supabase.co/functions/v1/raporti", {
    method,
    headers: { "Content-Type": "application/json" },
    body: trupi === undefined ? undefined : JSON.stringify(trupi),
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("funksioni raporti", () => {
  it("answers the preflight, so a browser may call it at all", async () => {
    const fn = await ngarko();
    const res = await fn(new Request("https://x/functions/v1/raporti", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
  });

  it("reports its version and whether the key is set - the settings card's health check", async () => {
    const fn = await ngarko();
    const gati = await (await fn(kerkesa(undefined, "GET"))).json();
    expect(gati).toMatchObject({ ok: true, versioni: 1, celes: true });

    const pa = await ngarko({ celes: "" });
    const bosh = await (await pa(kerkesa(undefined, "GET"))).json();
    expect(bosh).toMatchObject({ ok: true, celes: false });
  });

  it("refuses to send with no key rather than failing silently", async () => {
    const fn = await ngarko({ celes: "" });
    const res = await fn(kerkesa(emaili));
    expect(res.status).toBe(424);
    expect((await res.json()).kodi).toBe("pa-celes");
  });

  it("refuses an email with no recipient or no body", async () => {
    const fn = await ngarko();
    expect((await fn(kerkesa({ subject: "x", html: "y" }))).status).toBe(400);
    expect((await fn(kerkesa({ to: "a@b.c", subject: "x" }))).status).toBe(400);
  });

  it("hands Resend the message as it arrived, attachment and all", async () => {
    const fn = await ngarko();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_42" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fn(kerkesa(emaili));
    expect(await res.json()).toMatchObject({ ok: true, id: "re_42" });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers.Authorization).toBe("Bearer re_test_key");
    const derguar = JSON.parse(opts.body);
    expect(derguar).toMatchObject({
      from: "FinanCarePersonal <onboarding@resend.dev>",
      to: ["une@shembull.com"],
      subject: "Pasqyra e korrikut 2026",
    });
    expect(derguar.attachments).toEqual([{ filename: "pasqyra.pdf", content: "JVBERi0xLjM=" }]);
  });

  it("sends from a verified domain when one was given", async () => {
    const fn = await ngarko();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_43" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fn(kerkesa({ ...emaili, from: "Raporte <raporte@shembull.dev>" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe("Raporte <raporte@shembull.dev>");
  });

  it("passes Resend's own complaint back, because it is the useful one", async () => {
    const fn = await ngarko();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "You can only send testing emails to your own address" }), {
          status: 403,
        })
      )
    );
    const res = await fn(kerkesa(emaili));
    expect(res.status).toBe(401);
    expect((await res.json()).gabim).toMatch(/your own address/);
  });

  it("survives a request body that is not JSON", async () => {
    const fn = await ngarko();
    const res = await fn(
      new Request("https://x/functions/v1/raporti", { method: "POST", body: "jo json" })
    );
    expect(res.status).toBe(400);
  });
});
