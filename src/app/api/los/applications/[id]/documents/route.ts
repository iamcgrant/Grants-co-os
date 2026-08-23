import { requireUser } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";
import { assertApplicationAccess } from "@/lib/los/access";
import { storeDocumentBytes } from "@/lib/los/document-storage";
import { prisma } from "@/lib/db/prisma";
import { readJson, readParams, toHttpResponse } from "../../../_handler";

const MAX_BYTES = 15 * 1024 * 1024;

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/** POST /api/los/applications/:id/documents — upload file bytes + attach to LoanFile */
export async function POST(
  request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);

    const contentType = request.headers.get("content-type") || "";
    let kind = "UPLOAD";
    let originalName = "document";
    let mimeType = "application/octet-stream";
    let byteSize = 0;
    let packageName = "OTHER";
    let fileBytes: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      kind = String(form.get("kind") ?? "UPLOAD");
      packageName = String(form.get("package") ?? "OTHER");
      if (file instanceof File) {
        originalName = file.name || "document";
        mimeType = file.type || "application/octet-stream";
        const arr = await file.arrayBuffer();
        fileBytes = Buffer.from(arr);
        byteSize = fileBytes.length;
      }
    } else {
      const body = await readJson(request);
      kind = String(body.kind ?? "UPLOAD");
      originalName = String(body.originalName ?? body.name ?? "document");
      mimeType = String(body.mimeType ?? "application/octet-stream");
      packageName = String(body.package ?? "OTHER");
      if (typeof body.contentBase64 === "string" && body.contentBase64.length > 0) {
        fileBytes = Buffer.from(body.contentBase64, "base64");
        byteSize = fileBytes.length;
      } else {
        byteSize = Number(body.byteSize ?? 0);
      }
    }

    if (fileBytes && fileBytes.length > MAX_BYTES) {
      return Response.json({ code: "FILE_TOO_LARGE", message: "File exceeds 15MB limit" }, { status: 413 });
    }

    const app = await prisma.mortgageApplication.findUniqueOrThrow({
      where: { id },
      select: { clientId: true },
    });

    const storageKey = `los/${id}/${Date.now()}-${sanitizeName(originalName)}`;

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

    if (fileBytes && fileBytes.length > 0) {
      await storeDocumentBytes({ documentId: doc.id, bytes: fileBytes, storageKey });
      byteSize = fileBytes.length;
    }

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
        payloadJson: JSON.stringify({
          documentId: doc.id,
          kind,
          originalName,
          byteSize,
          stored: Boolean(fileBytes && fileBytes.length > 0),
        }),
      },
    });

    if (user.role === Role.CLIENT) {
      await prisma.applicationSectionState.updateMany({
        where: { applicationId: id, section: "DOCUMENTS" },
        data: { status: "IN_PROGRESS", lastSavedAt: new Date() },
      });
    }

    return Response.json(
      {
        document: doc,
        mortgageFile,
        stored: Boolean(fileBytes && fileBytes.length > 0),
      },
      { status: 201 },
    );
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
