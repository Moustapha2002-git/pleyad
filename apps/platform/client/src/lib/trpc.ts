import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

// End-to-end types: this pulls the API's router type straight from the server,
// so every query/mutation is fully typed with zero code generation.
export const trpc = createTRPCReact<AppRouter>();
