import { createServerFn } from "@tanstack/react-start";

export const authAction = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async (args) => {
    console.log("[authAction server fn] data:", args?.data);
    const { handleAuthAction } = await import("./sqlite-service.server");
    return handleAuthAction(args?.data);
  });

export const executeDbQuery = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async (args) => {
    console.log("[executeDbQuery server fn] data:", args?.data);
    const { handleDbQuery } = await import("./sqlite-service.server");
    return handleDbQuery(args?.data);
  });
