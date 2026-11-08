export async function api(path, options = {}) {
    const isForm = options.form instanceof FormData;
    const res = await fetch(path, {
        method: options.method || "GET",
        headers: options.body ? { "Content-Type": "application/json" } : {},
        body: isForm ? options.form : options.body ? JSON.stringify(options.body) : undefined,
        credentials: "same-origin",
    });
    let data = null;
    try {
        data = await res.json();

    } catch {
        //some replies have no body
    }
    return { ok: res.ok, status: res.status, data };
}