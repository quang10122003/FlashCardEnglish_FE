import { showErrorMessage } from "./alertHelper";
import { RenewalTokenAPI } from "../services/User/userService";

const API_DOMAIN = process.env.DOMAIN_BE || "http://localhost:8080";

const ACCEPT_ONLY = { Accept: "application/json" };

function buildHeaders(method, requireAuth, body) {
  const headers = { ...ACCEPT_ONLY };

  const token = localStorage.getItem("accessToken");
  if (requireAuth && token) headers.Authorization = `Bearer ${token}`;

  // Chỉ set Content-Type khi thực sự có JSON body và không phải GET/HEAD
  const hasJsonBody = body && !(body instanceof FormData);
  if (hasJsonBody && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function joinUrl(base, path) {
  const p = path.startsWith("/") ? path : "/" + path; // thêm leading slash
  return `${base}${p}`;
}

async function silentRenew() {
  const rt = localStorage.getItem("renewalToken");
  if (!rt) return false;
  try {
    const res = await RenewalTokenAPI(rt);
    if (!res?.token) return false;
    localStorage.setItem("accessToken", res.token);
    return true;
  } catch {
    return false;
  }
}

/** fetch wrapper:
 *  - requireAuth: nếu 401 thì thử silent refresh 1 lần rồi retry
 */
async function apiFetch(path, options = {}, requireAuth = false) {
  const method = (options.method || "GET").toUpperCase();
  const url = joinUrl(API_DOMAIN, path);

  const headers =
    options.headers || buildHeaders(method, requireAuth, options.body);
  const fetchOpts = { ...options, method, headers };
  // Force fresh GETs to avoid stale cached responses
  if (method === "GET") {
    fetchOpts.cache = "no-store";
  }

  let res = await fetch(url, fetchOpts);
  console.log("Check res in apiFetch:", res);
  if (requireAuth && res.status === 401) {
    const ok = await silentRenew();
    if (ok) {
      const retryHeaders =
        options.headers || buildHeaders(method, requireAuth, options.body);
      if (retryHeaders.Authorization) {
        retryHeaders.Authorization = `Bearer ${localStorage.getItem(
          "accessToken",
        )}`;
      }
      res = await fetch(url, { ...fetchOpts, headers: retryHeaders });
    }
  }

  let bodyText = "";
  let json = null;
  try {
    bodyText = await res.text();
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}

  // 🔴 ƯU TIÊN data.detail
  if (!res.ok) {
    let msg =
      (json &&
        (json.data?.detail ||
          json.error?.detail ||
          json.error_description ||
          json.message ||
          json.error)) ||
      (bodyText && (res.headers.get("content-type") || "").includes("text/")
        ? bodyText
        : "") ||
      `HTTP ${res.status} ${res.statusText}`;

    const err = new Error(msg);
    err.status = res.status;
    err.url = url;
    err.body = bodyText;
    err.raw = json;
    throw err;
  }
  // if (json.status === 400) {
  //   const err = new Error(json.message);
  //   throw err;
  // }
  return json ? json.data : null;
}

// ============================Những api lấy giá trị thông thường===========================

export const getWithParams = async (path, params = {}, requireAuth = false) => {
  const query = new URLSearchParams(params).toString();
  const fullPath = path + (query ? `?${query}` : "");
  console.log("Check resulccccc");
  console.log("Check fullPath", fullPath);
  try {
    const result = await apiFetch(fullPath, { method: "GET" }, requireAuth);

    return result;
  } catch (error) {
    showErrorMessage(error.message);
  }
};

export const get = async (path, requireAuth = true) => {
  try {
    return await apiFetch(path, { method: "GET" }, requireAuth);
  } catch (error) {
    showErrorMessage(`Lỗi khi gọi API: ${error.message}`);
  }
};

export const getNoAuth = async (path) => {
  try {
    return await apiFetch(path, { method: "GET" }, false);
  } catch (error) {
    showErrorMessage(`Lỗi khi gọi API: ${error.message}`);
  }
};

export const post = async (values, path, auth = false) => {
  try {
    // headers sẽ do apiFetch tự build
    const data = await apiFetch(
      path,
      { method: "POST", body: JSON.stringify(values) },
      auth,
    );
    // console.log("Check data in request:", data);
    return data;
  } catch (error) {
    setTimeout(() => showErrorMessage(error.message), 1000);
  }
};

export const del = async (path, auth = true) => {
  try {
    await apiFetch(path, { method: "DELETE" }, auth);
    return true;
  } catch (error) {
    showErrorMessage(error.message);
  }
};

// export const patch = async (value, path, auth = true) => {
//   try {
//     return await apiFetch(
//       path,
//       { method: "PATCH", body: JSON.stringify(value) },
//       auth
//     );
//   } catch (error) {
//     showErrorMessage(`Lỗi khi gọi API: ${error.message}`);
//   }
// };
export const patch = async (value, path, auth = true) => {
  try {
    const options = { method: "PATCH" };

    if (value !== null && value !== undefined) {
      options.body = JSON.stringify(value);
    }

    return await apiFetch(path, options, auth);
  } catch (error) {
    showErrorMessage(`Lỗi khi gọi API: ${error.message}`);
  }
};
export const put = async (values, path, auth = true) => {
  try {
    await apiFetch(path, { method: "PUT", body: JSON.stringify(values) }, auth);
    return true;
  } catch (error) {
    setTimeout(() => showErrorMessage(error.message), 2000);
  }
};

// =============================những api có gửi file (multipart/form-data)===========================

export const postFormData = async (path, formData, auth = true) => {
  try {
    // KHÔNG set Content-Type để fetch tự gắn boundary
    return await apiFetch(path, { method: "POST", body: formData }, auth);
  } catch (error) {
    showErrorMessage(error.message);
  }
};
export const putFormData = async (path, formData, auth = true) => {
  try {
    const result = await apiFetch(
      path,
      { method: "PUT", body: formData },
      auth,
    );
    return result;
  } catch (error) {
    showErrorMessage(error.message);
    throw error; // 🔥 QUAN TRỌNG: ném lỗi ra để onFinish catch
  }
};
