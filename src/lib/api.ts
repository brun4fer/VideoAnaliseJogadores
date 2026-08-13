import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) { return NextResponse.json(data, { status }); }
export function badRequest(message: string) { return NextResponse.json({ error: message }, { status: 400 }); }
export function notFound(message = "Registo não encontrado.") { return NextResponse.json({ error: message }, { status: 404 }); }
export function serverError(error: unknown) {
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
}
