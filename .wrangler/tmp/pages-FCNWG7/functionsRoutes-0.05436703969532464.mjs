import { onRequestGet as __admin_intake__id__ts_onRequestGet } from "/home/qtm/dev/planck/planck-fyi/functions/admin/intake/[id].ts"
import { onRequestPost as __api_submit_ts_onRequestPost } from "/home/qtm/dev/planck/planck-fyi/functions/api/submit.ts"
import { onRequestPut as __api_upload_ts_onRequestPut } from "/home/qtm/dev/planck/planck-fyi/functions/api/upload.ts"
import { onRequestPost as __api_upload_url_ts_onRequestPost } from "/home/qtm/dev/planck/planck-fyi/functions/api/upload-url.ts"
import { onRequestGet as __admin_index_ts_onRequestGet } from "/home/qtm/dev/planck/planck-fyi/functions/admin/index.ts"

export const routes = [
    {
      routePath: "/admin/intake/:id",
      mountPath: "/admin/intake",
      method: "GET",
      middlewares: [],
      modules: [__admin_intake__id__ts_onRequestGet],
    },
  {
      routePath: "/api/submit",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_submit_ts_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_upload_ts_onRequestPut],
    },
  {
      routePath: "/api/upload-url",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_url_ts_onRequestPost],
    },
  {
      routePath: "/admin",
      mountPath: "/admin",
      method: "GET",
      middlewares: [],
      modules: [__admin_index_ts_onRequestGet],
    },
  ]