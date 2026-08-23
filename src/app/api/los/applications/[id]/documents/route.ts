import { requireUser } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";
import { assertApplicationAccess } from "@/lib/los/access";
import { prisma } from "@/lib/db/prisma";
import { readJson, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/documents — metadata-only document registration (storage pending) */
export async function POST(
  request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const body = await readJson(request);

    const kind = String(body.kind ?? "UPLOAD");
    const originalName = String(body.originalName ?? body.name ?? "document");
    const mimeType = String(body.mimeType ?? "application/octet-stream");
    const byteSize = Number(body.byteSize ?? 0);
    const packageName = String(body.package ?? "OTHER");

    const app = await prisma.mortgageApplication.findUniqueOrThrow({
      where: { id },
      select: { clientId: true },
    });

    const storageKey = `pending/${id}/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const doc = await prisma.document.create({
      data: {
        clientId: app.clientId,
        name: originalName,
        mimeType,
        storageKey,
        category: "MORTGAGE_LOS",
        uploadedById: user.id,
      },
    });

    const mortgageFile = await prisma.mortgageDocumentFile.create({
      data: {
        applicationId: id,
        documentId: doc.id,
        package: packageName as "IDENTITY" | "INCOME" | "ASSETS" | "CREDIT" | "OTHER",
        kind,
        originalName,
        mimeType,
        storageKey,
        byteSize,
        uploadedByRole: user.role,
      },
    });

    await prisma.losAutomationEvent.create({
      data: {
        applicationId: id,
        type: "DOCUMENT_ATTACHED",
        payloadJson: JSON.stringify({ documentId: doc.id, kind, originalName }),
      },
    });

  if (user.role === Role.CLIENT) {
      await prisma.applicationSectionState.updateMany({
        where: { applicationId: id, section: "DOCUMENTS" },
        data: { status: "IN_PROGRESS", lastSavedAt: new Date() },
      });
    }

    return Response.json({ document: doc, mortgageFile }, { status: 201 });
  } catch (err) {
    return toHttpResponse(err);
  }
}

/** GET /api/los/applications/:id/documents */
export async function GET(
  _request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);

    const files = await prisma.mortgageDocumentFile.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: "desc" },
      include: { document: true },
    });

    return Response.json({ files });
  } catch (err) {
    return toHttpResponse(err);
  }
}
