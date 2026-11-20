import { describe, expect, test } from "bun:test";
import { ApiError } from "@/api/client";
import { createErpCatalogSource, CatalogNotConfiguredError, type CatalogListQuery } from "@/api/catalog";
import { ErpContractError } from "@/api/contract-schemas";
import { createErpWebsiteSource, WebsiteNotConfiguredError, type CustomerAuth } from "@/api/website";
import type { RfqSubmission } from "@/api/rfq";
import { catalogRoutes } from "./catalog/routes";
import { unwrapEnvelope } from "./envelope";
import { websiteRoutes } from "./website/routes";

const BASE = "http://localhost:3001";
const KEY = "ewk_test_key";

type Call = { url: URL; init: RequestInit };

/** The backend success envelope (`ok()` in apps/backend/src/http/response.ts). */
const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ requestId: "r-1", status, message: "OK", timestamp: 1, data }), {
    status,
    headers: { "content-type": "application/json" },
  });

/** The backend paginated envelope (`okPaginated()`): rows in `data`, the shared `TPaginationMeta` in `pagination`. */
const paginated = (rows: unknown[], pagination = { page: 1, limit: 12, total: rows.length, totalPages: 1 }) =>
  new Response(JSON.stringify({ requestId: "r-1", status: 200, message: "OK", timestamp: 1, pagination, data: rows }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const errorEnvelope = (status: number, message: string) =>
  new Response(JSON.stringify({ requestId: "r-1", status, message, timestamp: 1, data: null, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });

function mockFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: new URL(String(input)), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, fetcher };
}

const catalogWith = (fetcher: typeof fetch, routes = catalogRoutes) =>
  createErpCatalogSource({ baseUrl: BASE, token: KEY, routes, fetcher, retries: 0, timeoutMs: 1000, unwrap: unwrapEnvelope });

const websiteWith = (fetcher: typeof fetch, routes = websiteRoutes) =>
  createErpWebsiteSource({ baseUrl: BASE, token: KEY, routes, fetcher, retries: 0, timeoutMs: 1000, unwrap: unwrapEnvelope });

/** What `PublicCatalogController` returns for a product (TWebProduct). */
const backendProduct = {
  slug: "turnstile-pro",
  name: "Turnstile Pro",
  categorySlug: "turnstile",
  category: "Turnstile",
  shortCategory: "Turnstile",
  specs: "Tripod, 30 persons/min",
  stock: "ready",
  priceCaption: "per unit",
  price: 12_500_000,
  rating: 0,
  applications: ["office"],
  popularity: 10,
  listedAt: "2026-11-01T03:00:00.000Z",
  image: "https://erp.example.com/inventory/public/v1/catalog/products/turnstile-pro/image",
};

const query: CatalogListQuery = {
  q: "turn",
  categories: ["turnstile", "gate"],
  availability: ["ready"],
  applications: [],
  minPrice: 1000,
  maxPrice: null,
  sort: "price-asc",
  page: 2,
  limit: 12,
};

describe("route maps", () => {
  test("every catalog operation is mapped under /inventory/public/v1/catalog", () => {
    const ops = ["listProducts", "getProduct", "listCategories", "getFacets", "getStock", "getPricing", "listSolutions", "search", "priceCart"] as const;
    for (const op of ops) expect(catalogRoutes[op]).toStartWith("/inventory/public/v1/catalog/");
  });

  test("website forms are mapped under /projects/public/v1; unpublished operations stay unmapped", () => {
    expect(websiteRoutes).toEqual({
      submitRfq: "/projects/public/v1/rfq",
      sendContactMessage: "/projects/public/v1/contact",
      requestDemo: "/projects/public/v1/demo",
    });
  });
});

describe("unwrapEnvelope", () => {
  test("returns the data member", () => {
    expect(unwrapEnvelope({ requestId: "x", data: { a: 1 } })).toEqual({ a: 1 });
  });
});

describe("ERP catalog source", () => {
  test("listProducts sends the query with the website key and maps the envelope", async () => {
    const { calls, fetcher } = mockFetch(() => paginated([backendProduct]));
    const page = await catalogWith(fetcher).listProducts(query);

    expect(page.items[0]).toEqual(backendProduct as never);
    expect(page.pagination).toEqual({ page: 1, limit: 12, total: 1, totalPages: 1 });
    const { url, init } = calls[0]!;
    expect(url.pathname).toBe("/inventory/public/v1/catalog/products");
    expect(url.searchParams.getAll("category")).toEqual(["turnstile", "gate"]);
    expect(url.searchParams.getAll("availability")).toEqual(["ready"]);
    expect(url.searchParams.get("min")).toBe("1000");
    expect(url.searchParams.has("max")).toBe(false);
    expect(url.searchParams.get("sort")).toBe("price-asc");
    expect(url.searchParams.get("limit")).toBe("12");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  test("a product without a photo or list price (quotation) still passes the contract", async () => {
    const { image: _image, ...noPhoto } = backendProduct;
    const { fetcher } = mockFetch(() => paginated([{ ...noPhoto, price: null }]));
    const page = await catalogWith(fetcher).listProducts(query);
    expect(page.items[0]!.price).toBeNull();
    expect(page.items[0]!.image).toBeUndefined();
  });

  test("getProduct fills :slug (encoded) and returns the product", async () => {
    const { calls, fetcher } = mockFetch(() => envelope(backendProduct));
    expect((await catalogWith(fetcher).getProduct("turnstile pro"))?.slug).toBe("turnstile-pro");
    expect(calls[0]!.url.pathname).toBe("/inventory/public/v1/catalog/products/turnstile%20pro");
  });

  test("getProduct returns null on the backend's 404 envelope", async () => {
    const { fetcher } = mockFetch(() => errorEnvelope(404, "Product not found"));
    expect(await catalogWith(fetcher).getProduct("missing")).toBeNull();
  });

  test("a payload that breaks the contract raises ErpContractError", async () => {
    const { fetcher } = mockFetch(() => paginated([{ ...backendProduct, stock: "sold-out" }]));
    await expect(catalogWith(fetcher).listProducts(query)).rejects.toBeInstanceOf(ErpContractError);
  });

  test("a hostile image URL is rejected", async () => {
    const { fetcher } = mockFetch(() => paginated([{ ...backendProduct, image: "javascript:alert(1)" }]));
    await expect(catalogWith(fetcher).listProducts(query)).rejects.toBeInstanceOf(ErpContractError);
  });

  test("categories, facets, stock, pricing, solutions pass backend shapes through", async () => {
    const bodies: Record<string, unknown> = {
      "/inventory/public/v1/catalog/categories": [{ slug: "turnstile", name: "Turnstile", productCount: 3 }],
      "/inventory/public/v1/catalog/facets": { total: 3, categories: { turnstile: 3 }, availability: { ready: 2, request: 1 } },
      "/inventory/public/v1/catalog/stock": [{ slug: "turnstile-pro", status: "preorder", leadTimeLabel: "2 weeks" }],
      "/inventory/public/v1/catalog/pricing": [{ slug: "turnstile-pro", price: null, currency: "IDR" }],
      "/inventory/public/v1/catalog/solutions": [{ slug: "entragate-access", name: "Entragate Access", description: "", tags: [] }],
    };
    const { calls, fetcher } = mockFetch(({ url }) => envelope(bodies[url.pathname]));
    const source = catalogWith(fetcher);

    expect(await source.listCategories()).toEqual(bodies["/inventory/public/v1/catalog/categories"] as never);
    expect((await source.getFacets()).availability).toEqual({ ready: 2, request: 1 });
    expect((await source.getStock(["a", "b"]))[0]!.leadTimeLabel).toBe("2 weeks");
    expect((await source.getPricing(["turnstile-pro"]))[0]!.price).toBeNull();
    expect((await source.listSolutions())[0]!.slug).toBe("entragate-access");
    // Repeated `slug` keys, as the backend's slugsQuerySchema expects.
    expect(calls[2]!.url.searchParams.getAll("slug")).toEqual(["a", "b"]);
  });

  test("search sends q and limit; priceCart posts lines as JSON", async () => {
    const { calls, fetcher } = mockFetch(({ url }) =>
      url.pathname.endsWith("/search")
        ? envelope({ products: [{ slug: "turnstile-pro", name: "Turnstile Pro", category: "Turnstile", price: null }], categories: [], solutions: [] })
        : envelope({ lines: [{ productSlug: "turnstile-pro", quantity: 2, unitPrice: null, lineTotal: 0, available: false }], subtotal: 0 }),
    );
    const source = catalogWith(fetcher);
    expect((await source.search("turn", 6)).products).toHaveLength(1);
    expect(calls[0]!.url.searchParams.get("limit")).toBe("6");

    const cart = await source.priceCart([{ productSlug: "turnstile-pro", quantity: 2 }]);
    expect(cart.lines[0]!.available).toBe(false);
    expect(calls[1]!.init.method).toBe("POST");
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ lines: [{ productSlug: "turnstile-pro", quantity: 2 }] });
  });

  test("not configured: an unmapped operation throws CatalogNotConfiguredError without calling the ERP", async () => {
    const { calls, fetcher } = mockFetch(() => envelope([]));
    await expect(catalogWith(fetcher, {}).listCategories()).rejects.toBeInstanceOf(CatalogNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  test("401 from a bad website key surfaces as ApiError with the backend message", async () => {
    const { fetcher } = mockFetch(() => errorEnvelope(401, "Public API key invalid"));
    const error = await catalogWith(fetcher).listCategories().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).messages).toEqual(["Public API key invalid"]);
  });

  test("timeout / network failure becomes ApiError status 0", async () => {
    const fetcher = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation timed out", "TimeoutError")));
      })) as unknown as typeof fetch;
    const source = createErpCatalogSource({ baseUrl: BASE, routes: catalogRoutes, fetcher, retries: 0, timeoutMs: 20, unwrap: unwrapEnvelope });
    const error = await source.listCategories().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  test("GET retries once on 503 and then succeeds", async () => {
    let n = 0;
    const { calls, fetcher } = mockFetch(() => (++n === 1 ? new Response("down", { status: 503 }) : envelope([])));
    const source = createErpCatalogSource({ baseUrl: BASE, routes: catalogRoutes, fetcher, retries: 1, timeoutMs: 1000, unwrap: unwrapEnvelope });
    expect(await source.listCategories()).toEqual([]);
    expect(calls).toHaveLength(2);
  });
});

const rfq: RfqSubmission = {
  company: { contactName: "Budi", email: "budi@example.com", phone: "+6281234567890" },
  project: { siteLocation: "Jakarta", type: "new-installation" },
  items: [{ productSlug: "turnstile-pro", quantity: 2 }],
  sendCopyToPortal: false,
  source: "web",
};

describe("ERP website source", () => {
  test("submitRfq posts JSON with an Idempotency-Key and returns the reference", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ reference: "RFQ-2026-00001", linkedToAccount: false }, 201));
    const receipt = await websiteWith(fetcher).submitRfq(rfq, []);
    expect(receipt).toEqual({ reference: "RFQ-2026-00001", linkedToAccount: false });
    const { url, init } = calls[0]!;
    expect(url.pathname).toBe("/projects/public/v1/rfq");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  test("submitRfq with attachments sends multipart payload + attachments", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ reference: "RFQ-2026-00002", linkedToAccount: false }, 201));
    await websiteWith(fetcher).submitRfq(rfq, [new File(["x"], "plan.pdf", { type: "application/pdf" })]);
    const body = calls[0]!.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(JSON.parse(String(body.get("payload")))).toEqual(rfq);
    expect((body.getAll("attachments")[0] as File).name).toBe("plan.pdf");
    // The multipart boundary header must be left to fetch.
    expect((calls[0]!.init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  test("a signed-in RFQ still authenticates with the website key, never the customer token", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ reference: "RFQ-2026-00003", linkedToAccount: false }, 201));
    const auth: CustomerAuth = { accessToken: "customer-token", customerId: "c-1" };
    await websiteWith(fetcher).submitRfq(rfq, [], auth);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  test("contact and demo post to their routes and return the reference", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ reference: "WEB-0001" }, 201));
    const source = websiteWith(fetcher);
    expect(await source.sendContactMessage({ topic: "sales", name: "Budi", email: "b@example.com", message: "Halo", source: "web" })).toEqual({ reference: "WEB-0001" });
    expect(
      await source.requestDemo({ name: "Budi", email: "b@example.com", whatsapp: "+6281234567890", organisation: "PT A", interests: [], format: "online", date: "2026-12-01", time: "10:00", source: "web" }),
    ).toEqual({ reference: "WEB-0001" });
    expect(calls.map((c) => c.url.pathname)).toEqual(["/projects/public/v1/contact", "/projects/public/v1/demo"]);
  });

  test("a 200 replay (Idempotency-Key reused) is mapped like a 201", async () => {
    const { fetcher } = mockFetch(() => envelope({ reference: "WEB-0001" }, 200));
    expect(await websiteWith(fetcher).sendContactMessage({ topic: "sales", name: "B", email: "b@example.com", message: "x", source: "web" })).toEqual({ reference: "WEB-0001" });
  });

  test("a 422 validation error is an ApiError the action layer can report", async () => {
    const { fetcher } = mockFetch(() => errorEnvelope(422, "Validation failed"));
    const error = await websiteWith(fetcher).sendContactMessage({ topic: "sales", name: "B", email: "b@example.com", message: "x", source: "web" }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(422);
  });

  test("a 422 reports the envelope's field errors, not just the top-level message", async () => {
    const { fetcher } = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            requestId: "r-2",
            status: 422,
            message: "Validation failed",
            timestamp: 1,
            data: null,
            errors: [
              { field: "email", message: "Invalid email" },
              { field: null, message: "Message is too short" },
            ],
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
    );
    const error = await websiteWith(fetcher).sendContactMessage({ topic: "sales", name: "B", email: "bad", message: "x", source: "web" }).catch((e: unknown) => e);
    expect((error as ApiError).errors).toEqual([
      { field: "email", message: "Invalid email" },
      { field: null, message: "Message is too short" },
    ]);
    expect((error as ApiError).messages).toEqual(["Invalid email", "Message is too short"]);
  });

  test("not configured: operations the ERP does not publish throw WebsiteNotConfiguredError", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({}));
    const source = websiteWith(fetcher);
    await expect(source.trackOrder({ orderNumber: "SO-1", contact: "x" })).rejects.toBeInstanceOf(WebsiteNotConfiguredError);
    await expect(source.applyPromo("PROMO", 1000)).rejects.toBeInstanceOf(WebsiteNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  test("timeout becomes ApiError status 0", async () => {
    const fetcher = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation timed out", "TimeoutError")));
      })) as unknown as typeof fetch;
    const source = createErpWebsiteSource({ baseUrl: BASE, routes: websiteRoutes, fetcher, timeoutMs: 20, unwrap: unwrapEnvelope });
    const error = await source.requestDemo({ name: "B", email: "b@example.com", whatsapp: "+6281234567890", organisation: "PT", interests: [], format: "online", date: "2026-12-01", time: "10:00", source: "web" }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(0);
  });
});
