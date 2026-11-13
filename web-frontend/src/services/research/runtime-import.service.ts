import { apiPost } from "@/services/http";

export async function importRuntimeModel(model: File) {
  const body = new FormData();
  body.append("model", model);
  const response = await apiPost("/admin/rc-research/runtime-import", body);
  if (!response || response.success !== true || response.message !== "Model installed.") {
    throw new Error("The server did not confirm model installation.");
  }
}
