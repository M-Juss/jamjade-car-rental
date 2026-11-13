import { apiPost } from "@/services/http";

export async function importRuntimeModel(model: File) {
  const body = new FormData();
  body.append("model", model);
  await apiPost("/admin/rc-research/runtime-import", body);
}
