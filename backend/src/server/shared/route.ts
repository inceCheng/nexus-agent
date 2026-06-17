import { AppError } from "./errors";

type RouteCallback = () => Promise<Response> | Response;

export async function handleRoute(callback: RouteCallback): Promise<Response> {
  try {
    return await callback();
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);

  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
